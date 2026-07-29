"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getGetNoteSharedChatMessagesQueryKey } from "@/lib/api/generated/note-shared-chat/note-shared-chat";
import { getGetNoteQueryKey } from "@/lib/api/generated/notes/notes";
import { getGetNoteTranscriptQueryKey } from "@/lib/api/generated/transcription/transcription";
import {
  endStream,
  initialStreamState,
  reduceStreamEvent,
  type ChatStreamState,
} from "@/lib/chat/stream-protocol";
import {
  getNoteTopicWebSocketUrl,
  NoteTopicClient,
} from "@/lib/notes/note-topic-client";
import type {
  NoteTopicEvent,
  NoteTopicFinalSegment,
} from "@/lib/notes/note-topic-protocol";
import { isProjectNotesQueryKey } from "@/lib/notes/query-keys";

type NoteRealtimeState = {
  partialByUtteranceId: Record<string, string>;
  partialSessionIdByUtteranceId: Record<string, string>;
  finalSegments: NoteTopicFinalSegment[];
  chatStream: ChatStreamState;
  chatLocked: boolean | null;
};

type NoteRealtimeAction =
  | { type: "reset" }
  | { type: "event"; event: NoteTopicEvent }
  | { type: "chat.interrupted" };

const initialState: NoteRealtimeState = {
  partialByUtteranceId: {},
  partialSessionIdByUtteranceId: {},
  finalSegments: [],
  chatStream: initialStreamState,
  chatLocked: null,
};
const TRANSCRIPT_CATCH_UP_DELAY_MS = 500;

function reducer(
  state: NoteRealtimeState,
  action: NoteRealtimeAction
): NoteRealtimeState {
  if (action.type === "reset") return initialState;
  if (action.type === "chat.interrupted") {
    return {
      ...state,
      chatStream: endStream(state.chatStream, "stalled"),
      chatLocked: false,
    };
  }

  const event = action.event;
  switch (event.type) {
    case "transcript.partial":
      return {
        ...state,
        partialByUtteranceId: {
          ...state.partialByUtteranceId,
          [event.utteranceId]: event.text,
        },
        partialSessionIdByUtteranceId: {
          ...state.partialSessionIdByUtteranceId,
          [event.utteranceId]: event.transcriptionSessionId,
        },
      };
    case "transcript.final": {
      const partialByUtteranceId = { ...state.partialByUtteranceId };
      const partialSessionIdByUtteranceId = {
        ...state.partialSessionIdByUtteranceId,
      };
      delete partialByUtteranceId[event.utteranceId];
      delete partialSessionIdByUtteranceId[event.utteranceId];
      const index = state.finalSegments.findIndex(
        (segment) => segment.segmentId === event.segmentId
      );
      const finalSegments =
        index < 0
          ? [...state.finalSegments, event]
          : state.finalSegments.map((segment, current) =>
              current === index ? event : segment
            );
      return {
        ...state,
        partialByUtteranceId,
        partialSessionIdByUtteranceId,
        finalSegments,
      };
    }
    case "recording.stopped": {
      const partialByUtteranceId = { ...state.partialByUtteranceId };
      const partialSessionIdByUtteranceId = {
        ...state.partialSessionIdByUtteranceId,
      };
      Object.entries(partialSessionIdByUtteranceId).forEach(
        ([utteranceId, sessionId]) => {
          if (sessionId !== event.transcriptionSessionId) return;
          delete partialByUtteranceId[utteranceId];
          delete partialSessionIdByUtteranceId[utteranceId];
        }
      );
      return {
        ...state,
        partialByUtteranceId,
        partialSessionIdByUtteranceId,
      };
    }
    case "meeting.ended":
      return {
        ...state,
        partialByUtteranceId: {},
        partialSessionIdByUtteranceId: {},
      };
    case "chat.token":
      return {
        ...state,
        chatStream: reduceStreamEvent(state.chatStream, {
          event: "token",
          data: JSON.stringify({ delta: event.delta }),
        }),
      };
    case "chat.message_end":
      return {
        ...state,
        chatStream: reduceStreamEvent(state.chatStream, {
          event: "message_end",
          data: JSON.stringify(event),
        }),
        chatLocked: false,
      };
    case "chat.lock":
      return {
        ...state,
        chatLocked: event.locked,
        chatStream: event.locked ? initialStreamState : state.chatStream,
      };
    default:
      return state;
  }
}

type NoteRealtimeValue = {
  transcript: Pick<NoteRealtimeState, "partialByUtteranceId" | "finalSegments">;
  chat: {
    stream: ChatStreamState;
    text: string;
    interrupted: boolean;
    locked: boolean | null;
  };
};

const NoteRealtimeContext = createContext<NoteRealtimeValue | null>(null);

export function NoteRealtimeProvider({
  noteId,
  children,
}: {
  noteId: string;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(reducer, initialState);
  const turnRef = useRef(0);
  const endedTurnRef = useRef<number | null>(null);
  const interruptionTimerRef = useRef<number | null>(null);
  const transcriptTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearInterruption = () => {
      if (interruptionTimerRef.current !== null) {
        window.clearTimeout(interruptionTimerRef.current);
        interruptionTimerRef.current = null;
      }
    };
    const invalidateNote = () =>
      void queryClient.invalidateQueries({
        queryKey: getGetNoteQueryKey(noteId),
      });
    const invalidateNoteLists = () =>
      void queryClient.invalidateQueries({
        predicate: ({ queryKey }) => isProjectNotesQueryKey(queryKey),
      });
    const invalidateLifecycle = () => {
      invalidateNote();
      invalidateNoteLists();
    };
    const invalidateTranscript = () =>
      void queryClient.invalidateQueries({
        queryKey: getGetNoteTranscriptQueryKey(noteId),
      });
    const clearTranscriptCatchUp = () => {
      if (transcriptTimerRef.current !== null) {
        window.clearTimeout(transcriptTimerRef.current);
        transcriptTimerRef.current = null;
      }
    };
    const scheduleTranscriptCatchUp = () => {
      clearTranscriptCatchUp();
      transcriptTimerRef.current = window.setTimeout(() => {
        transcriptTimerRef.current = null;
        invalidateTranscript();
      }, TRANSCRIPT_CATCH_UP_DELAY_MS);
    };
    const invalidateChat = () =>
      void queryClient.invalidateQueries({
        queryKey: getGetNoteSharedChatMessagesQueryKey(noteId),
      });
    const catchUp = () => {
      clearInterruption();
      clearTranscriptCatchUp();
      dispatch({ type: "reset" });
      invalidateLifecycle();
      invalidateTranscript();
      invalidateChat();
    };
    const client = new NoteTopicClient({
      url: getNoteTopicWebSocketUrl(),
      noteId,
      onCatchUp: catchUp,
      onEvent: (event) => {
        dispatch({ type: "event", event });
        switch (event.type) {
          case "meeting.started":
            invalidateLifecycle();
            break;
          case "meeting.ended":
            clearTranscriptCatchUp();
            invalidateLifecycle();
            invalidateTranscript();
            invalidateChat();
            break;
          case "recording.started":
            invalidateLifecycle();
            break;
          case "recording.stopped":
            clearTranscriptCatchUp();
            invalidateLifecycle();
            invalidateTranscript();
            break;
          case "transcript.final":
            scheduleTranscriptCatchUp();
            break;
          case "chat.lock":
            invalidateChat();
            if (event.locked) {
              clearInterruption();
              turnRef.current += 1;
              endedTurnRef.current = null;
            } else {
              const turn = turnRef.current;
              clearInterruption();
              // 정상 순서도 unlock 뒤 message_end다. 짧은 유예 동안 terminal이 안 오면
              // 그때만 중단으로 확정한다.
              interruptionTimerRef.current = window.setTimeout(() => {
                if (endedTurnRef.current === turn) return;
                dispatch({ type: "chat.interrupted" });
                invalidateChat();
              }, 1_000);
            }
            break;
          case "chat.message_end":
            endedTurnRef.current = turnRef.current;
            clearInterruption();
            invalidateChat();
            break;
          default:
            break;
        }
      },
    });
    client.connect();
    return () => {
      clearInterruption();
      clearTranscriptCatchUp();
      void client.close();
    };
  }, [noteId, queryClient]);

  const value = useMemo<NoteRealtimeValue>(
    () => ({
      transcript: {
        partialByUtteranceId: state.partialByUtteranceId,
        finalSegments: state.finalSegments,
      },
      chat: {
        stream: state.chatStream,
        text: state.chatStream.text,
        interrupted: state.chatStream.phase === "stalled",
        locked: state.chatLocked,
      },
    }),
    [state]
  );
  return (
    <NoteRealtimeContext.Provider value={value}>
      {children}
    </NoteRealtimeContext.Provider>
  );
}

export function useNoteRealtime() {
  const value = useContext(NoteRealtimeContext);
  if (!value) {
    throw new Error("useNoteRealtime must be used within NoteRealtimeProvider");
  }
  return value;
}
