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

import { getGetNoteQueryKey } from "@/lib/api/generated/notes/notes";
import { getGetNoteTranscriptQueryKey } from "@/lib/api/generated/transcription/transcription";
import {
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
};

type NoteRealtimeAction = { type: "reset" } | { type: "event"; event: NoteTopicEvent };

const initialState: NoteRealtimeState = {
  partial: null,
  finalSegments: [],
};
const TRANSCRIPT_CATCH_UP_DELAY_MS = 500;

function reducer(
  state: NoteRealtimeState,
  action: NoteRealtimeAction
): NoteRealtimeState {
  if (action.type === "reset") return initialState;

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
    default:
      return state;
  }
}

type NoteRealtimeValue = {
  transcript: Pick<NoteRealtimeState, "partial" | "finalSegments">;
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
  const transcriptTimerRef = useRef<number | null>(null);

  useEffect(() => {
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
    const catchUp = () => {
      clearTranscriptCatchUp();
      dispatch({ type: "reset" });
      invalidateLifecycle();
      invalidateTranscript();
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
          default:
            break;
        }
      },
    });
    client.connect();
    return () => {
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
