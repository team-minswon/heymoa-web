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
import { noteSocketOpened } from "@/lib/events/note-sockets";
import { useQueryClient } from "@tanstack/react-query";

import {
  getGetNoteAgendasQueryKey,
  useGetNote,
} from "@/lib/api/generated/notes/notes";
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
  noteId: string;
  subscriptionIssue: SubscriptionIssue | null;
  reconnecting: boolean;
  retrySubscription: () => void;
  transcript: Pick<NoteRealtimeState, "partial" | "finalSegments">;
  context: {
    cards: ContextCard[];
    state: ContextState;
    failed: boolean;
    loading: boolean;
    retry: () => void;
  };
};

const TRANSCRIPT_CATCH_UP_DELAY_MS = 500;
const RECONNECT_CATCH_UP_JITTER_MS = 3_000;

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
  const [reconnectingFor, setReconnectingFor] = useState<string | null>(null);
  const reconnecting = reconnectingFor === noteId;
  const retrySubscription = useCallback(() => {
    retrySubscriptionRef.current?.();
  }, []);
  const needsRefetchRef = useRef(false);
  useEffect(() => {
    needsRefetchRef.current = state.context.needsRefetch;
  }, [state.context.needsRefetch]);

  const noteQuery = useGetNote(noteId);
  const meetingStatus =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data.meetingStatus
      : undefined;
  const [socketFor, setSocketFor] = useState<string | null>(null);
  const shouldOpen = meetingStatus !== undefined && meetingStatus !== "ENDED";
  if (shouldOpen && socketFor !== noteId) setSocketFor(noteId);
  const socketOpen = socketFor === noteId;

  useEffect(() => {
    dispatch({ type: "reset", noteId });
  }, [noteId]);

  useEffect(
    () => (socketOpen ? noteSocketOpened(noteId) : undefined),
    [noteId, socketOpen]
  );

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
    let fullCatchUpPending = false;
    const clearTranscriptCatchUp = () => {
      fullCatchUpPending = false;
      if (transcriptTimerRef.current !== null) {
        window.clearTimeout(transcriptTimerRef.current);
        transcriptTimerRef.current = null;
      }
    };
    const catchUpPendingCovers = () => {
      if (fullCatchUpPending) return true;
      clearTranscriptCatchUp();
      return false;
    };
    const scheduleTranscriptCatchUp = () => {
      if (fullCatchUpPending) return;
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
    const invalidateAgendas = () =>
      void queryClient.invalidateQueries({
        queryKey: getGetNoteAgendasQueryKey(noteId),
      });
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
    const runCatchUp = () => {
      clearTranscriptCatchUp();
      lastSequence = null;
      dispatch({
        type: "transcript-reset",
        persistedThrough: persistedLastSequence(),
      });
      invalidateLifecycle();
      invalidateTranscript();
      invalidateContext();
      invalidateAgendas();
    };
    let caughtUpOnce = false;
    const catchUp = () => {
      if (!caughtUpOnce) {
        caughtUpOnce = true;
        runCatchUp();
        return;
      }
      if (fullCatchUpPending) return;
      clearTranscriptCatchUp();
      fullCatchUpPending = true;
      transcriptTimerRef.current = window.setTimeout(() => {
        transcriptTimerRef.current = null;
        runCatchUp();
      }, Math.random() * RECONNECT_CATCH_UP_JITTER_MS);
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
      onReconnectingChange: (next) => setReconnectingFor(next ? noteId : null),
      onEvent: (event) => {
        clearRetry();
        retryDelayMs = 5_000;
        setSubscriptionIssueState(null);
        dispatch({ type: "event", event });
        switch (event.type) {
          case "meeting.started":
            applyNoteLifecycleEvent(queryClient, noteId, event);
            invalidateLifecycle();
            break;
          case "meeting.ended":
            applyNoteLifecycleEvent(queryClient, noteId, event);
            if (catchUpPendingCovers()) break;
            invalidateLifecycle();
            invalidateTranscript();
            invalidateContext();
            invalidateAgendas();
            break;
          case "recording.started":
            if (!applyNoteLifecycleEvent(queryClient, noteId, event))
              invalidateLifecycle();
            break;
          case "recording.stopped": {
            const covered = catchUpPendingCovers();
            if (
              !applyNoteLifecycleEvent(queryClient, noteId, event) &&
              !covered
            )
              invalidateLifecycle();
            if (!covered) invalidateTranscript();
            break;
          }
          case "transcript.final": {
            // 번호는 노트 안에서 빈틈없이 이어지므로 건너뛴 번호가 곧 Pub/Sub 이 흘린 final 이다. 그때만 REST 로 메운다.
            const seen = lastSequence ?? persistedLastSequence();
            const skipped = seen !== null && event.sequence > seen + 1;
            lastSequence = Math.max(seen ?? 0, event.sequence);
            const failed =
              queryClient.getQueryState(getGetNoteTranscriptQueryKey(noteId))
                ?.status === "error";
            if (skipped || failed) scheduleTranscriptCatchUp();
            break;
          }
          case "proposal.changed":
            if (needsRefetchRef.current) invalidateContext();
            break;
          case "transcript-analysis-run.applied":
            invalidateContext();
            break;
          case "agendas.changed":
            invalidateAgendas();
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
      setReconnectingFor(null);
      void client.close();
    };
  }, [noteId, onNotMember, queryClient, socketOpen]);

  const snapshotQuery = useGetProposals(noteId, {
    query: {
      staleTime: 10_000,
      select: selectContextSnapshot,
    },
  });
  const snapshot = snapshotQuery.data;
  /** `data` 가 아니라 `dataUpdatedAt` 을 본다 — TanStack 은 구조가 같으면 재조회에도 같은 객체를 돌려줘 effect 가 다시 안 돈다. */
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

  const needsRefetch = state.context.needsRefetch;
  const refetchSnapshot = snapshotQuery.refetch;
  useEffect(() => {
    if (!needsRefetch) return;
    void refetchSnapshot();
  }, [needsRefetch, refetchSnapshot]);

  const contextFailed = snapshotQuery.isLoadingError;
  const contextLoading = snapshotQuery.isPending;
  const retryContext = useCallback(() => {
    void refetchSnapshot();
  }, [refetchSnapshot]);

  const cards = useMemo(() => selectCards(state.context), [state.context]);
  const value = useMemo<NoteRealtimeValue>(
    () => ({
      noteId,
      subscriptionIssue,
      reconnecting,
      retrySubscription,
      transcript: {
        partial: state.partial,
        finalSegments: state.finalSegments,
      },
      context: {
        cards,
        state: state.context,
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
      reconnecting,
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
