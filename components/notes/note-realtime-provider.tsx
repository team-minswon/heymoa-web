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
  initialContextState,
  reduceContextEvent,
  selectCards,
  type ContextCard,
  type ContextState,
} from "@/lib/notes/context-candidates/reducer";
import {
  getNoteTopicWebSocketUrl,
  NoteTopicClient,
} from "@/lib/notes/note-topic-client";
import { getContextCandidatesQueryKey } from "@/lib/notes/context-candidates/query-keys";
import type {
  NoteTopicEvent,
  NoteTopicFinalSegment,
} from "@/lib/notes/note-topic-protocol";
import { isProjectNotesQueryKey } from "@/lib/notes/query-keys";

/**
 * 뷰어도 살아 있는 partial은 하나만 든다 — 근거는 `lib/transcription/transcript-reducer.ts`의
 * `LivePartial` 주석과 같다. 여기는 어느 세션의 발화인지도 알아야 `recording.stopped`에서
 * 그 세션 것만 지울 수 있다.
 */
type ViewerLivePartial = {
  utteranceId: string;
  transcriptionSessionId: string;
  /** 두 토막인 근거는 `lib/transcription/protocol.ts` 의 partial 주석에 있다. */
  confirmedText: string;
  pendingText: string;
};

type NoteRealtimeState = {
  partial: ViewerLivePartial | null;
  finalSegments: NoteTopicFinalSegment[];
  chatStream: ChatStreamState;
  chatLocked: boolean | null;
  context: ContextState;
};

type NoteRealtimeAction =
  | { type: "reset" }
  | { type: "event"; event: NoteTopicEvent }
  | { type: "chat.interrupted" };

const initialState: NoteRealtimeState = {
  partial: null,
  finalSegments: [],
  chatStream: initialStreamState,
  chatLocked: null,
  context: initialContextState,
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
      // 다른 utteranceId면 이전 발화를 대체한다 — 그것이 계약이 말하는 정리 기준이다.
      return {
        ...state,
        partial: {
          utteranceId: event.utteranceId,
          transcriptionSessionId: event.transcriptionSessionId,
          confirmedText: event.confirmedText,
          pendingText: event.pendingText,
        },
      };
    case "transcript.final": {
      const index = state.finalSegments.findIndex(
        (segment) => segment.segmentId === event.segmentId
      );
      const finalSegments =
        index < 0
          ? [...state.finalSegments, event]
          : state.finalSegments.map((segment, current) =>
              current === index ? event : segment
            );
      // final이 오면 id와 무관하게 현재 partial을 비운다 — 근거는
      // `lib/transcription/transcript-reducer.ts`의 같은 분기 주석에 있다.
      return { ...state, partial: null, finalSegments };
    }
    case "recording.stopped":
      return {
        ...state,
        partial:
          state.partial?.transcriptionSessionId === event.transcriptionSessionId
            ? null
            : state.partial,
      };
    case "meeting.ended":
      return { ...state, partial: null };
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
    // 맥락 후보는 통째로 순수 리듀서에 넘긴다 — 이 파일은 이벤트 의미를 모른다.
    case "context.candidate.changed":
    case "context.classification.batch.applied":
      return { ...state, context: reduceContextEvent(state.context, event) };
    default:
      return state;
  }
}

type NoteRealtimeValue = {
  transcript: Pick<NoteRealtimeState, "partial" | "finalSegments">;
  context: {
    cards: ContextCard[];
    state: ContextState;
  };
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
    const invalidateContext = () =>
      void queryClient.invalidateQueries({
        queryKey: getContextCandidatesQueryKey(noteId),
      });
    const catchUp = () => {
      clearInterruption();
      clearTranscriptCatchUp();
      dispatch({ type: "reset" });
      invalidateLifecycle();
      invalidateTranscript();
      invalidateChat();
      invalidateContext();
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
            invalidateContext();
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
          // **REAFFIRM 수렴 지점이다.** REAFFIRM 은 candidate event 를 안 만들면서 서버에서는
          // evidence 를 늘리고 `lastEvidenceSequence` 를 전진시킨다. 배치가 적용될 때마다
          // snapshot 을 다시 받아야 그 변화가 화면에 온다.
          case "context.classification.batch.applied":
            invalidateContext();
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
        partial: state.partial,
        finalSegments: state.finalSegments,
      },
      chat: {
        stream: state.chatStream,
        text: state.chatStream.text,
        interrupted: state.chatStream.phase === "stalled",
        locked: state.chatLocked,
      },
      context: {
        cards: selectCards(state.context),
        state: state.context,
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
