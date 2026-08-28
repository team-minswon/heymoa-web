"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getGetNoteQueryKey } from "@/lib/api/generated/notes/notes";
import { getGetNoteTranscriptQueryKey } from "@/lib/api/generated/transcription/transcription";
import type {
  AppliedRange,
  ContextCandidateHead,
} from "@/lib/notes/context-candidates/contract";
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
import {
  getGetContextCandidatesQueryKey,
  useGetContextCandidates,
} from "@/lib/api/generated/context-candidates/context-candidates";
import { selectContextSnapshot } from "@/lib/notes/context-candidates/select";
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
  context: ContextState;
};

type NoteRealtimeAction =
  | { type: "reset" }
  | { type: "event"; event: NoteTopicEvent }
  | {
      type: "snapshot";
      candidates: ContextCandidateHead[];
      appliedRanges: AppliedRange[];
    };

const initialState: NoteRealtimeState = {
  partial: null,
  finalSegments: [],
  context: initialContextState,
};
const TRANSCRIPT_CATCH_UP_DELAY_MS = 500;

function reducer(
  state: NoteRealtimeState,
  action: NoteRealtimeAction
): NoteRealtimeState {
  if (action.type === "reset") return initialState;
  if (action.type === "snapshot") {
    // REST가 정본이다. 임시로 접어 둔 것을 버리고 이걸로 다시 선다.
    return { ...state, context: reduceContextEvent(state.context, action) };
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
    /** 원장 조회가 실패했다. **정상 빈 상태와 갈라야 한다.** */
    failed: boolean;
    /** 첫 조회가 아직 안 왔다. **이것도 빈 상태가 아니다** — 모르는 것을 없다고 하면 안 된다. */
    loading: boolean;
    retry: () => void;
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
  const transcriptTimerRef = useRef<number | null>(null);
  /**
   * WS 콜백은 연결 effect 안에서 한 번 만들어져 그 시점의 값을 가둔다. 재조회가 필요한지는
   * event 가 올 때마다 **지금** 값을 봐야 하므로 ref 로 읽는다.
   */
  const needsRefetchRef = useRef(false);
  useEffect(() => {
    needsRefetchRef.current = state.context.needsRefetch;
  }, [state.context.needsRefetch]);

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
    const invalidateContext = () =>
      void queryClient.invalidateQueries({
        queryKey: getGetContextCandidatesQueryKey(noteId),
      });
    const catchUp = () => {
      clearTranscriptCatchUp();
      dispatch({ type: "reset" });
      invalidateLifecycle();
      invalidateTranscript();
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
          /**
           * **재조회가 실패한 채 갇히지 않게 한다.** `needsRefetch` 는 sticky 이고 그것을
           * 보는 effect 의 deps 가 안 바뀌어서, 한 번 실패하면 스스로는 다시 안 돈다.
           * 그 뒤 오는 candidate event 는 gap 을 못 메운다 — 빠진 revision 은 다시 안 온다.
           *
           * batch 는 아래에서 늘 invalidate 하므로 이미 복구 경로가 있다. 배치가 멎은
           * 구간에서 candidate event 만 오는 경우가 남아서, **그때만** 같은 경로를 연다.
           */
          case "context.candidate.changed":
            if (needsRefetchRef.current) invalidateContext();
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
      clearTranscriptCatchUp();
      void client.close();
    };
  }, [noteId, queryClient]);

  /**
   * **원장의 정본은 REST다.** 전달이 best-effort라 event만 쌓으면 새로고침·재연결·회의 종료
   * 뒤에 화면이 빈다 — 실제로 그렇게 만들었다가 잡았다.
   *
   * `phase`로 막지 않는다. **회의가 끝나도 원장은 남는다** — 사용자가 회의 중에 본 것을
   * 나중에 되짚는 것이 이 화면의 절반이다.
   */
  const snapshotQuery = useGetContextCandidates(noteId, {
    query: {
      staleTime: 10_000,
      /** 두 겹 봉투를 벗기고 성공만 zod 로 통과시킨다 — 근거는 `select.ts` 주석에 있다. */
      select: selectContextSnapshot,
    },
  });
  const snapshot = snapshotQuery.data;
  /**
   * **`data` 가 아니라 `dataUpdatedAt` 을 본다.** TanStack 은 구조가 같으면 재조회에도 같은
   * 객체를 돌려주므로, 재연결 catch-up 이 `reset` 으로 상태를 비운 **뒤에** 온 재조회가
   * effect 를 다시 안 띄운다 — 그러면 화면이 영영 빈 채로 남는다. 실제로 그렇게 비었다.
   */
  const snapshotUpdatedAt = snapshotQuery.dataUpdatedAt;

  useEffect(() => {
    if (!snapshot) return;
    dispatch({
      type: "snapshot",
      candidates: snapshot.candidates,
      appliedRanges: snapshot.appliedRanges,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 위 주석: 갱신 시각이 트리거다.
  }, [snapshotUpdatedAt]);

  /**
   * revision gap을 봤으면 다시 받는다. **event로는 못 메운다** — 빠진 revision은 다시 안 온다.
   */
  const needsRefetch = state.context.needsRefetch;
  const refetchSnapshot = snapshotQuery.refetch;
  useEffect(() => {
    if (!needsRefetch) return;
    void refetchSnapshot();
  }, [needsRefetch, refetchSnapshot]);

  const contextFailed = snapshotQuery.isError;
  // `isPending` 으로 가른다. `isFetching` 은 이미 그려진 데이터의 갱신까지 잡아서,
  // 배치가 올 때마다 읽던 목록이 skeleton 으로 덮인다.
  const contextLoading = snapshotQuery.isPending;
  const retryContext = useCallback(() => {
    void refetchSnapshot();
  }, [refetchSnapshot]);

  const value = useMemo<NoteRealtimeValue>(
    () => ({
      transcript: {
        partial: state.partial,
        finalSegments: state.finalSegments,
      },
      context: {
        cards: selectCards(state.context),
        state: state.context,
        // 실패를 화면까지 올린다. 안 올리면 레일이 「사건이 없다」로 그려서 사용자가
        // 후보 0건을 사실로 믿는다.
        failed: contextFailed,
        loading: contextLoading,
        retry: retryContext,
      },
    }),
    [contextFailed, contextLoading, retryContext, state]
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
