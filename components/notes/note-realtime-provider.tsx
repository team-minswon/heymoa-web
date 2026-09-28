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

import { useGetNote } from "@/lib/api/generated/notes/notes";
import {
  getGetNoteTranscriptQueryKey,
  type getNoteTranscript,
} from "@/lib/api/generated/transcription/transcription";
import {
  selectCards,
  type ContextCard,
  type ContextState,
} from "@/lib/notes/proposals/reducer";
import {
  initialNoteRealtimeState,
  noteRealtimeReducer,
  type NoteRealtimeState,
} from "@/lib/notes/note-realtime-reducer";
import { NoteTopicClient } from "@/lib/notes/note-topic-client";
import { transcriptionWebSocketUrl } from "@/lib/transcription/socket";
import {
  getGetProposalsQueryKey,
  useGetProposals,
} from "@/lib/api/generated/proposals/proposals";
import { selectContextSnapshot } from "@/lib/notes/proposals/select";
import type { NoteSubscriptionRejected } from "@/lib/notes/note-topic-protocol";
import {
  invalidateNoteLifecycle,
  invalidateNoteTranscript,
} from "@/lib/notes/invalidate";
import { applyNoteLifecycleEvent } from "@/lib/notes/note-lifecycle-cache";

type SubscriptionIssue = Exclude<
  NoteSubscriptionRejected["reason"],
  "NOT_MEMBER"
>;

type NoteRealtimeValue = {
  /** 이 컨텍스트가 지금 어느 노트의 것인가. 노트 전환에 지역 상태를 리셋할 주어다. */
  noteId: string;
  subscriptionIssue: SubscriptionIssue | null;
  retrySubscription: () => void;
  transcript: Pick<NoteRealtimeState, "partial" | "finalSegments">;
  context: {
    cards: ContextCard[];
    state: ContextState;
    /** 원장 조회가 실패했다. 정상 빈 상태와 갈라야 한다. */
    failed: boolean;
    /** 첫 조회가 아직 안 왔다. 이것도 빈 상태가 아니다 — 모르는 것을 없다고 하면 안 된다. */
    loading: boolean;
    retry: () => void;
  };
};

const TRANSCRIPT_CATCH_UP_DELAY_MS = 500;

const NoteRealtimeContext = createContext<NoteRealtimeValue | null>(null);

export function NoteRealtimeProvider({
  noteId,
  onNotMember,
  children,
}: {
  noteId: string;
  onNotMember?: () => void;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [rawState, dispatch] = useReducer(
    noteRealtimeReducer,
    initialNoteRealtimeState
  );
  // 렌더에서 주어를 대조한다. 노트가 바뀐 첫 커밋은 위 reset effect보다 먼저라,
  // 여기서 거르지 않으면 이전 노트의 상태로 새 노트의 자식들이 한 프레임 그려진다.
  const state =
    rawState.noteId === noteId ? rawState : initialNoteRealtimeState;
  const transcriptTimerRef = useRef<number | null>(null);
  const retrySubscriptionRef = useRef<(() => void) | null>(null);
  const [subscriptionIssueState, setSubscriptionIssueState] = useState<{
    noteId: string;
    reason: SubscriptionIssue;
  } | null>(null);
  const subscriptionIssue =
    subscriptionIssueState?.noteId === noteId
      ? subscriptionIssueState.reason
      : null;
  const retrySubscription = useCallback(() => {
    retrySubscriptionRef.current?.();
  }, []);
  /**
   * WS 콜백은 연결 effect 안에서 한 번 만들어져 그 시점의 값을 가둔다. 재조회가 필요한지는
   * event 가 올 때마다 지금 값을 봐야 하므로 ref 로 읽는다.
   */
  const needsRefetchRef = useRef(false);
  useEffect(() => {
    needsRefetchRef.current = state.context.needsRefetch;
  }, [state.context.needsRefetch]);

  /**
   * 소켓은 아직 무언가 올 수 있는 노트에만 연다.
   *
   * 이 토픽으로 끝난 회의에서 올 수 있는 것은 회의 직후 분석이 도는 동안의 후보·배치뿐이다.
   * 지난 노트를 읽는 탭마다 연결이 하나씩 서 있었고, 2대에서 배포하면 그 전부가 재연결을 한다.
   * 시작 전 노트는 연다 — 동료가 녹음을 시작하면 이 소켓으로 `meeting.started` 가 온다.
   *
   * 판정은 노트 조회의 `meetingStatus` 다. 노트 화면이 서버에서 미리 받아 오므로 요청이 늘지
   * 않고, 아직 모르면 알 때까지 안 연다. 한 번 열었으면 상태가 바뀌어도 나갈 때까지 유지한다
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
    // 노트가 바뀌면 즉시 비운다. catch-up 의 reset 만 믿으면 WS 가 붙기 전까지
    // (또는 못 붙으면 영영) 이전 노트의 partial·후보·처리 내역이 새 노트에 그대로 보인다.
    // 마운트 직후에는 이미 초기 상태라 no-op 이다.
    dispatch({ type: "reset", noteId });
  }, [noteId]);

  useEffect(() => {
    if (!socketOpen) return;
    let retryTimer: number | null = null;
    let retryDelayMs = 5_000;
    const clearRetry = () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      retryTimer = null;
    };
    const invalidateLifecycle = () =>
      void invalidateNoteLifecycle(queryClient, noteId);
    const invalidateTranscript = () =>
      void invalidateNoteTranscript(queryClient, noteId);
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
        queryKey: getGetProposalsQueryKey(noteId),
      });
    // catch-up 뒤에는 REST 가 가진 마지막 번호가 기준이다. 첫 final 로 기준을 세우면 그 앞의
    // 유실을 못 본다. REST 가 아직 없으면 모르므로 첫 final 이 기준이 된다.
    let lastSequence: number | null = null;
    const persistedLastSequence = () => {
      const response = queryClient.getQueryData<
        Awaited<ReturnType<typeof getNoteTranscript>>
      >(getGetNoteTranscriptQueryKey(noteId));
      if (response?.status !== 200 || !response.data.success) return null;
      return response.data.data.segments.reduce(
        (max, segment) => Math.max(max, segment.sequence),
        0
      );
    };
    const catchUp = () => {
      clearTranscriptCatchUp();
      lastSequence = null;
      dispatch({
        type: "transcript-reset",
        persistedThrough: persistedLastSequence(),
      });
      invalidateLifecycle();
      invalidateTranscript();
      invalidateContext();
    };
    const client = new NoteTopicClient({
      url: transcriptionWebSocketUrl(),
      noteId,
      onSubscriptionRejected: (rejection: NoteSubscriptionRejected) => {
        clearRetry();
        if (rejection.reason === "NOT_MEMBER") {
          onNotMember?.();
          return;
        }
        setSubscriptionIssueState({ noteId, reason: rejection.reason });
        if (rejection.reason !== "ALREADY_SUBSCRIBED") {
          retryTimer = window.setTimeout(
            () => client.retrySubscription(),
            retryDelayMs
          );
          retryDelayMs = Math.min(retryDelayMs * 2, 30_000);
        }
      },
      onCatchUp: catchUp,
      onEvent: (event) => {
        clearRetry();
        retryDelayMs = 5_000;
        setSubscriptionIssueState(null);
        dispatch({ type: "event", event });
        switch (event.type) {
          case "meeting.started":
            applyNoteLifecycleEvent(queryClient, noteId, event);
            // 이벤트는 시작자와 updatedAt을 싣지 않는다. 즉시 반영한 상태 뒤에
            // REST를 읽어 두 필드와 목록 행을 서버 값으로 수렴시킨다.
            invalidateLifecycle();
            break;
          case "meeting.ended":
            clearTranscriptCatchUp();
            applyNoteLifecycleEvent(queryClient, noteId, event);
            // 종료 시각과 updatedAt도 이벤트에 없으므로 상세·목록을 다시 읽는다.
            invalidateLifecycle();
            invalidateTranscript();
            invalidateContext();
            break;
          case "recording.started":
            if (!applyNoteLifecycleEvent(queryClient, noteId, event))
              invalidateLifecycle();
            break;
          case "recording.stopped":
            clearTranscriptCatchUp();
            if (!applyNoteLifecycleEvent(queryClient, noteId, event))
              invalidateLifecycle();
            invalidateTranscript();
            break;
          case "transcript.final": {
            // 발화는 이벤트가 다 싣는다 — 받을 때마다 전사 전체를 다시 받으면 보는 사람 수만큼
            // DB 조회가 곱해진다. 번호는 노트 안에서 빈틈없이 이어지므로, 건너뛴
            // 번호가 곧 Pub/Sub 이 흘린 final 이다. 그때만 REST 로 메운다.
            const seen = lastSequence ?? persistedLastSequence();
            const skipped = seen !== null && event.sequence > seen + 1;
            lastSequence = Math.max(seen ?? 0, event.sequence);
            // 조회가 실패해 있으면 다음 final 이 다시 받을 계기다.
            const failed =
              queryClient.getQueryState(getGetNoteTranscriptQueryKey(noteId))
                ?.status === "error";
            if (skipped || failed) scheduleTranscriptCatchUp();
            break;
          }
          /**
           * 재조회가 실패한 채 갇히지 않게 한다. `needsRefetch` 는 sticky 이고 그것을
           * 보는 effect 의 deps 가 안 바뀌어서, 한 번 실패하면 스스로는 다시 안 돈다.
           * 그 뒤 오는 proposal event 는 gap 을 못 메운다 — 빠진 revision 은 다시 안 온다.
           *
           * batch 는 아래에서 늘 invalidate 하므로 이미 복구 경로가 있다. 배치가 멎은
           * 구간에서 proposal event 만 오는 경우가 남아서, 그때만 같은 경로를 연다.
           */
          case "proposal.changed":
            if (needsRefetchRef.current) invalidateContext();
            break;
          // REAFFIRM 수렴 지점이다. REAFFIRM 은 proposal event 를 안 만들면서 서버에서는
          // citations 를 늘리고 `lastEvidenceSequence` 를 전진시킨다. 배치가 적용될 때마다
          // snapshot 을 다시 받아야 그 변화가 화면에 온다.
          case "transcript-analysis-run.applied":
            invalidateContext();
            break;
          default:
            break;
        }
      },
    });
    retrySubscriptionRef.current = () => {
      clearRetry();
      client.retrySubscription();
    };
    client.connect();
    return () => {
      clearTranscriptCatchUp();
      clearRetry();
      retrySubscriptionRef.current = null;
      void client.close();
    };
  }, [noteId, onNotMember, queryClient, socketOpen]);

  /**
   * 원장의 정본은 REST다. 전달이 best-effort라 event만 쌓으면 새로고침·재연결·회의 종료
   * 뒤에 화면이 빈다 — 실제로 그렇게 만들었다가 잡았다.
   *
   * `phase`로 막지 않는다. 회의가 끝나도 원장은 남는다 — 사용자가 회의 중에 본 것을
   * 나중에 되짚는 것이 이 화면의 절반이다.
   */
  const snapshotQuery = useGetProposals(noteId, {
    query: {
      staleTime: 10_000,
      /** 두 겹 봉투를 벗기고 성공만 zod 로 통과시킨다 — 근거는 `select.ts` 주석에 있다. */
      select: selectContextSnapshot,
    },
  });
  const snapshot = snapshotQuery.data;
  /**
   * `data` 가 아니라 `dataUpdatedAt` 을 본다. TanStack 은 구조가 같으면 재조회에도 같은
   * 객체를 돌려주므로, 재연결 catch-up 이 `reset` 으로 상태를 비운 뒤에 온 재조회가
   * effect 를 다시 안 띄운다 — 그러면 화면이 영영 빈 채로 남는다. 실제로 그렇게 비었다.
   */
  const snapshotUpdatedAt = snapshotQuery.dataUpdatedAt;

  useEffect(() => {
    if (!snapshot) return;
    dispatch({
      type: "snapshot",
      proposals: snapshot.proposals,
      runs: snapshot.runs,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 위 주석: 갱신 시각이 트리거다.
  }, [snapshotUpdatedAt]);

  /**
   * revision gap을 봤으면 다시 받는다. event로는 못 메운다 — 빠진 revision은 다시 안 온다.
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

  // 전사 조각은 context 를 안 건드린다. 거기에 묶어야 조각마다 카드 수백 장이 다시 안 그려진다
  const cards = useMemo(() => selectCards(state.context), [state.context]);
  const value = useMemo<NoteRealtimeValue>(
    () => ({
      noteId,
      subscriptionIssue,
      retrySubscription,
      transcript: {
        partial: state.partial,
        finalSegments: state.finalSegments,
      },
      context: {
        cards,
        state: state.context,
        // 실패를 화면까지 올린다. 안 올리면 레일이 「사건이 없다」로 그려서 사용자가
        // 후보 0건을 사실로 믿는다.
        failed: contextFailed,
        loading: contextLoading,
        retry: retryContext,
      },
    }),
    [
      cards,
      contextFailed,
      contextLoading,
      noteId,
      retryContext,
      retrySubscription,
      state,
      subscriptionIssue,
    ]
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
