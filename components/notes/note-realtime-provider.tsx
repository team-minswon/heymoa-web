"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getGetNoteQueryKey, useGetNote } from "@/lib/api/generated/notes/notes";
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
  /** 이 상태가 어느 노트의 것인가. **렌더에서 거르는 주어다** — effect 초기화만 믿으면
      노트 전환 첫 커밋에 이전 노트의 카드·partial이 한 프레임 그려진다. */
  noteId: string | null;
  partial: ViewerLivePartial | null;
  finalSegments: NoteTopicFinalSegment[];
  context: ContextState;
};

type NoteRealtimeAction =
  | { type: "reset"; noteId: string }
  /**
   * 재연결 catch-up 용. **전사만 비운다** — 원장까지 비우면 그 직후의 snapshot 재조회가
   * 실패했을 때(캐시가 남아 `isLoadingError`도 거짓) 다시 채울 경로가 없어, 실제로 있던
   * 원장이 「정리된 사건이 없습니다」로 영구히 사라진다. 원장은 snapshot 병합이 수렴시킨다.
   */
  | { type: "transcript-reset" }
  | { type: "event"; event: NoteTopicEvent }
  | {
      type: "snapshot";
      candidates: ContextCandidateHead[];
      appliedRanges: AppliedRange[];
    };

const initialState: NoteRealtimeState = {
  noteId: null,
  partial: null,
  finalSegments: [],
  context: initialContextState,
};
const TRANSCRIPT_CATCH_UP_DELAY_MS = 500;
/** 토픽 무이벤트 구간의 안전 폴링 주기. 노트 조회의 안전 폴링과 같은 값이다. */
const CONTEXT_SAFETY_POLL_MS = 30_000;

function reducer(
  state: NoteRealtimeState,
  action: NoteRealtimeAction
): NoteRealtimeState {
  if (action.type === "reset") {
    return { ...initialState, noteId: action.noteId };
  }
  if (action.type === "transcript-reset") {
    return { ...state, partial: null, finalSegments: [] };
  }
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
  /** 이 컨텍스트가 지금 어느 노트의 것인가. 노트 전환에 지역 상태를 리셋할 주어다. */
  noteId: string;
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
  const [rawState, dispatch] = useReducer(reducer, initialState);
  // **렌더에서 주어를 대조한다.** 노트가 바뀐 첫 커밋은 위 reset effect보다 먼저라,
  // 여기서 거르지 않으면 이전 노트의 상태로 새 노트의 자식들이 한 프레임 그려진다.
  const state = rawState.noteId === noteId ? rawState : initialState;
  const transcriptTimerRef = useRef<number | null>(null);
  /**
   * WS 콜백은 연결 effect 안에서 한 번 만들어져 그 시점의 값을 가둔다. 재조회가 필요한지는
   * event 가 올 때마다 **지금** 값을 봐야 하므로 ref 로 읽는다.
   */
  const needsRefetchRef = useRef(false);
  useEffect(() => {
    needsRefetchRef.current = state.context.needsRefetch;
  }, [state.context.needsRefetch]);

  /**
   * ★ **소켓은 아직 무언가 올 수 있는 노트에만 연다.**
   *
   * 이 토픽으로 끝난 회의에서 올 수 있는 것은 회의 직후 분석이 도는 동안의 후보·배치뿐이다.
   * 지난 노트를 읽는 탭마다 연결이 하나씩 서 있었고, 2대에서 배포하면 그 전부가 재연결을 한다.
   * **시작 전 노트는 연다** — 동료가 녹음을 시작하면 이 소켓으로 `meeting.started` 가 온다.
   *
   * 판정은 노트 조회의 `meetingStatus` 다. 노트 화면이 서버에서 미리 받아 오므로 요청이 늘지
   * 않고, 아직 모르면 알 때까지 안 연다. **한 번 열었으면 상태가 바뀌어도 나갈 때까지 유지한다**
   * — 회의를 끝내는 순간 닫으면 그 직후 오는 분석 배치를 놓친다. `socketFor` 가 그 래치다.
   */
  const noteQuery = useGetNote(noteId);
  const meetingStatus =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data.meetingStatus
      : undefined;
  const [socketFor, setSocketFor] = useState<string | null>(null);
  const shouldOpen = meetingStatus !== undefined && meetingStatus !== "ENDED";
  // 렌더 중에 세우는 파생 상태다. effect 로 미루면 한 렌더 늦고 lint 도 막는다.
  if (shouldOpen && socketFor !== noteId) setSocketFor(noteId);
  const socketOpen = socketFor === noteId;

  useEffect(() => {
    // **노트가 바뀌면 즉시 비운다.** catch-up 의 reset 만 믿으면 WS 가 붙기 전까지
    // (또는 못 붙으면 영영) 이전 노트의 partial·후보·처리 내역이 새 노트에 그대로 보인다.
    // 마운트 직후에는 이미 initialState 라 no-op 이다.
    dispatch({ type: "reset", noteId });
  }, [noteId]);

  useEffect(() => {
    if (!socketOpen) return;
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
      dispatch({ type: "transcript-reset" });
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
  }, [noteId, queryClient, socketOpen]);

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
      /**
       * **토픽이 조용히 거절되는 server 계약의 복구망.** 구독 상한·권한 재검사는 오류
       * 프레임 없이 구독만 끊는다(asyncapi) — 그러면 이벤트도 재연결도 없어 REST 정본이
       * 회의 내내 안 움직인다. 노트 조회의 안전 폴링과 같은 무늬로, 종료 전에만
       * 저주기로 확인한다. 종료 뒤에는 원장이 더 안 자라 폴링할 이유가 없다.
       */
      refetchInterval: () => {
        const response = queryClient.getQueryData(getGetNoteQueryKey(noteId)) as
          | { status: number; data: { success: boolean; data: { meetingStatus?: string } } }
          | undefined;
        const note =
          response?.status === 200 && response.data.success
            ? response.data.data
            : undefined;
        return note?.meetingStatus === "ENDED" ? false : CONTEXT_SAFETY_POLL_MS;
      },
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

  // `isLoadingError` 로 가른다. 초기 조회가 성공한 뒤의 재조회(배치 무효화·gap 복구) 실패는
  // 캐시가 남아 있으므로 그려진 카드를 유지한다 — 이미 그려진 데이터의 갱신은 덮지 않는다는
  // 규칙(rule `error-loading`)과 같은 이유다.
  const contextFailed = snapshotQuery.isLoadingError;
  // `isPending` 으로 가른다. `isFetching` 은 이미 그려진 데이터의 갱신까지 잡아서,
  // 배치가 올 때마다 읽던 목록이 skeleton 으로 덮인다.
  const contextLoading = snapshotQuery.isPending;
  const retryContext = useCallback(() => {
    void refetchSnapshot();
  }, [refetchSnapshot]);

  const value = useMemo<NoteRealtimeValue>(
    () => ({
      noteId,
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
    [contextFailed, contextLoading, noteId, retryContext, state]
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
