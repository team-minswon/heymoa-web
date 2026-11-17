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
import { useTranslations } from "next-intl";

import { track, trackConversion } from "@/lib/analytics/track";
import { REQUEST_TIMEOUT_MS } from "@/lib/api/fetcher";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { errorCodeOf } from "@/lib/api/error-message";
import { toast } from "@/lib/ui/toast";
import {
  useGetTranscriptionSession,
  useStartTranscriptionSession,
} from "@/lib/api/generated/transcription/transcription";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import {
  getRecordedDurationMs,
  recordingClockOriginMs,
} from "@/lib/notes/meeting-state";
import { useAlignedNow } from "@/lib/notes/use-aligned-now";
import {
  invalidateNoteLifecycle,
  invalidateNoteTranscript,
} from "@/lib/notes/invalidate";
import { forgetWorkspace } from "@/lib/workspace/cache";
import { notifyWorkspaceGone } from "@/lib/workspace/gone-notice";
import { createRecordingSession } from "@/lib/desktop/recording-runtime";
import type { MicrophoneState } from "@/lib/transcription/audio";
import { logTranscription } from "@/lib/transcription/log";
import {
  ACTIVE_PHASES,
  initialRecordingState,
  recordingReducer,
  type RecordingAction,
  type RecordingFailure,
  type RecordingPhase,
  type RecordingSession,
} from "@/lib/transcription/recording-state";
import {
  interruptedMessage,
  meetingEndedMessage,
  runtimeFailureMessage,
  isQuotaExceeded,
  startErrorMessage,
} from "@/lib/transcription/recording-messages";
import { transcriptionWebSocketUrl } from "@/lib/transcription/socket";
import {
  adoptDeadRecorder,
  beatRecording,
  clientInstanceId,
  expireRecording,
  forgetRecording,
  RECORDING_BEAT_MS,
  touchRecording,
} from "@/lib/transcription/recorder-lease";
import {
  type BufferState,
  type ConnectionNotice,
  type RealtimeSessionController,
  type RealtimeSessionOptions,
} from "@/lib/transcription/realtime-session";
import {
  isTerminalError,
  type ServerEvent,
} from "@/lib/transcription/protocol";
import {
  initialTranscriptState,
  transcriptReducer,
  type TranscriptState,
} from "@/lib/transcription/transcript-reducer";

export type RecordingRuntime = {
  createSession: (options: RealtimeSessionOptions) => RealtimeSessionController;
};

export type RecordingApi = {
  startSession: (noteId: string) => Promise<RecordingSession>;
};

export type { RecordingPhase };

export type RecordingContextValue = {
  session: RecordingSession | null;
  activeNoteId: string | null;
  activeWorkspaceId: string | null;
  phase: RecordingPhase;
  elapsedMs: number;
  clockOriginMs: number | null;
  transcriptionDegraded: boolean;
  connectionNotice: ConnectionNotice | null;
  buffer: BufferState | null;
  microphone: MicrophoneState;
  systemAudio?: MicrophoneState | null;
  error: string | null;
  quotaExceeded: boolean;
  start: (noteId: string, workspaceId: string) => Promise<void>;
  stop: () => Promise<boolean>;
  disconnect: (noteId?: string) => Promise<void>;
};

export type RecordingMeterValue = {
  level: number;
  levelHistory: number[];
};

const RecordingContext = createContext<RecordingContextValue | null>(null);
const RecordingTranscriptContext = createContext<TranscriptState | null>(null);
const RecordingMeterContext = createContext<RecordingMeterValue | null>(null);
const RecordingNoteContext = createContext<string | null>(null);

export function isRecordingLive(
  recording: Pick<RecordingContextValue, "session" | "phase">
): boolean {
  if (ACTIVE_PHASES.has(recording.phase)) return true;
  const sessionOpen =
    recording.session?.status === "READY" ||
    recording.session?.status === "ACTIVE";
  return recording.phase === "failed" && sessionOpen;
}

export function isNoteRecordingActive(
  recording: Pick<RecordingContextValue, "activeNoteId" | "session" | "phase">,
  noteId: string
): boolean {
  return recording.activeNoteId === noteId && isRecordingLive(recording);
}

export function isWorkspaceRecordingActive(
  recording: Pick<
    RecordingContextValue,
    "activeWorkspaceId" | "session" | "phase"
  >,
  workspaceId: string
): boolean {
  return (
    recording.activeWorkspaceId === workspaceId && isRecordingLive(recording)
  );
}

export function isRecordingStarting(
  recording: Pick<RecordingContextValue, "activeNoteId" | "phase">,
  noteId: string
): boolean {
  return (
    recording.activeNoteId === noteId &&
    (recording.phase === "requesting-permission" ||
      recording.phase === "connecting")
  );
}

const browserRuntime: RecordingRuntime = {
  createSession: createRecordingSession,
};

/** 받아쓰기가 이만큼 이어서 멈춰 있을 때만 알린다. 업체 503 은 대개 1초 안에 풀린다. */
const DEGRADED_NOTICE_AFTER_MS = 5_000;

const LEVEL_HISTORY_LENGTH = 24;

export function RecordingProvider({
  children,
  api: apiOverride,
  runtime = browserRuntime,
  enablePolling = true,
}: {
  children: React.ReactNode;
  api?: RecordingApi;
  runtime?: RecordingRuntime;
  enablePolling?: boolean;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("recording.errors");
  const tToast = useTranslations("recording.errorToast");
  const startSessionMutation = useStartTranscriptionSession({
    mutation: { meta: { suppressErrorToast: true } },
    request: { timeoutMs: REQUEST_TIMEOUT_MS },
  });
  const latest = useRef(initialRecordingState);
  const [state, setState] = useState(initialRecordingState);
  const dispatch = useCallback((action: RecordingAction) => {
    const previous = latest.current;
    const next = recordingReducer(previous, action);
    if (next === previous) return;
    if (next.phase !== previous.phase) {
      logTranscription("phase", { from: previous.phase, to: next.phase });
    }
    latest.current = next;
    setState(next);
  }, []);
  const { session, activeNoteId, activeWorkspaceId, phase } = state;
  const [transcript, dispatchTranscript] = useReducer(
    transcriptReducer,
    initialTranscriptState
  );
  const [level, setLevel] = useState(0);
  const [levelHistory, setLevelHistory] = useState<number[]>(() =>
    Array(LEVEL_HISTORY_LENGTH).fill(0)
  );
  const smoothedLevelRef = useRef(0);
  const degradedTimerRef = useRef<number | undefined>(undefined);
  const controllerRef = useRef<RealtimeSessionController | null>(null);
  const cancelledControllerRef = useRef<RealtimeSessionController | null>(null);
  const stopPromiseRef = useRef<Promise<boolean> | null>(null);
  const teardownCountRef = useRef(0);
  const live = isRecordingLive({ phase, session });
  const shouldPoll = enablePolling && Boolean(session?.sessionId) && live;
  const sessionQuery = useGetTranscriptionSession(session?.sessionId ?? "", {
    query: {
      enabled: shouldPoll,
      staleTime: 0,
      refetchInterval: shouldPoll ? 3_000 : false,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
    },
  });
  const watchMeetingEnd =
    enablePolling &&
    phase === "failed" &&
    state.windowExhausted &&
    activeNoteId !== null;
  const noteQuery = useGetNote(activeNoteId ?? "", {
    query: {
      enabled:
        enablePolling &&
        activeNoteId !== null &&
        (ACTIVE_PHASES.has(phase) || watchMeetingEnd),
      refetchInterval: watchMeetingEnd ? 3_000 : false,
      refetchIntervalInBackground: true,
    },
  });
  const recordingNote =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;
  const [activatedAt, setActivatedAt] = useState<number | null>(null);
  const noteIsCurrent =
    recordingNote !== undefined &&
    activatedAt !== null &&
    noteQuery.dataUpdatedAt >= activatedAt;
  const clockOriginMs =
    phase === "recording" && noteIsCurrent
      ? recordingClockOriginMs(recordingNote)
      : null;
  // 브라우저 타이머를 쌓지 않는다 — 숨긴 탭에서 조여지면 늦어진다. 매번 지금 시각을 다시 읽고, 원점에 맞춰 초가 넘어간다.
  const clockNow = useAlignedNow(
    1_000,
    clockOriginMs !== null,
    clockOriginMs === null ? [] : [clockOriginMs]
  );
  const [heldClock, setHeldClock] = useState(0);
  const liveClock =
    clockOriginMs !== null && recordingNote
      ? getRecordedDurationMs(recordingNote, clockNow ?? Number.NaN)
      : null;
  if (liveClock !== null && liveClock !== heldClock) setHeldClock(liveClock);
  const elapsedMs = liveClock ?? heldClock;
  const meetingEndedAfterDrop =
    watchMeetingEnd && recordingNote?.meetingStatus === "ENDED";

  useEffect(() => {
    if (!meetingEndedAfterDrop) return;
    const { droppedMs } = latest.current;
    logTranscription("notice", {
      state: "shown",
      cause: "meeting_ended_after_drop",
      droppedMs,
    });
    dispatch({ type: "error", message: meetingEndedMessage(t, droppedMs) });
  }, [dispatch, meetingEndedAfterDrop, t]);

  useEffect(() => () => window.clearTimeout(degradedTimerRef.current), []);

  const cancelDegradedTimer = useCallback(() => {
    window.clearTimeout(degradedTimerRef.current);
    degradedTimerRef.current = undefined;
  }, []);

  const liveNoteId = activeNoteId && live ? activeNoteId : null;
  useEffect(() => {
    if (!liveNoteId && phase !== "idle") {
      forgetRecording();
      return;
    }
    const beat = () =>
      liveNoteId ? beatRecording(liveNoteId) : touchRecording();
    beat();
    const timer = window.setInterval(beat, RECORDING_BEAT_MS);
    window.addEventListener("pagehide", expireRecording);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", expireRecording);
    };
  }, [liveNoteId, phase]);

  const publishLevel = useCallback((nextLevel: number) => {
    const previous = smoothedLevelRef.current;
    const factor = nextLevel > previous ? 0.72 : 0.2;
    const smoothed = previous + (nextLevel - previous) * factor;
    smoothedLevelRef.current = smoothed;
    setLevel(smoothed);
    setLevelHistory((history) => [...history.slice(1), smoothed]);
  }, []);

  const clearLevel = useCallback(() => {
    smoothedLevelRef.current = 0;
    setLevel(0);
    setLevelHistory(Array(LEVEL_HISTORY_LENGTH).fill(0));
  }, []);

  const api = useMemo<RecordingApi>(
    () =>
      apiOverride ?? {
        startSession: async (noteId) => {
          const response = await startSessionMutation.mutateAsync({
            noteId,
            data: { clientInstanceId: clientInstanceId() },
          });
          const opened = response.status === 201 || response.status === 200;
          if (!opened || !response.data.success || !response.data.data) {
            throw new Error("SESSION_CREATE_FAILED");
          }
          return response.data.data;
        },
      },
    [apiOverride, startSessionMutation]
  );

  const invalidateTranscriptQueries = useCallback(
    (noteId: string) => void invalidateNoteTranscript(queryClient, noteId),
    [queryClient]
  );

  const invalidateLifecycleQueries = useCallback(
    (noteId: string, transcript = false) => {
      void invalidateNoteLifecycle(queryClient, noteId);
      if (transcript) {
        invalidateTranscriptQueries(noteId);
        const workspaceId = latest.current.activeWorkspaceId;
        if (workspaceId) void invalidateWorkspaceBilling(queryClient, workspaceId);
      }
    },
    [invalidateTranscriptQueries, queryClient]
  );

  const failRecording = useCallback(
    (failure: RecordingFailure) => {
      dispatchTranscript({ type: "clear-partials" });
      cancelDegradedTimer();
      dispatch(failure);
      clearLevel();
      const controller = controllerRef.current;
      controllerRef.current = null;
      void controller?.close();
      const current = latest.current.session;
      if (current) invalidateTranscriptQueries(current.noteId);
    },
    [cancelDegradedTimer, clearLevel, dispatch, invalidateTranscriptQueries]
  );

  const completeRecording = useCallback(
    (completed: RecordingSession | null) => {
      cancelDegradedTimer();
      dispatch({ type: "completed", session: completed });
      clearLevel();
    },
    [cancelDegradedTimer, clearLevel, dispatch]
  );

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      if (
        event.type === "completed" &&
        event.sessionId !== latest.current.session?.sessionId
      ) {
        return;
      }
      dispatchTranscript(event);

      if (event.type === "capture_state") {
        cancelDegradedTimer();
        if (event.state === "DEGRADED") {
          degradedTimerRef.current = window.setTimeout(() => {
            degradedTimerRef.current = undefined;
            logTranscription("notice", { state: "shown", cause: "degraded" });
            dispatch({ type: "degraded", shown: true });
          }, DEGRADED_NOTICE_AFTER_MS);
        } else {
          if (latest.current.transcriptionDegraded) {
            logTranscription("notice", { state: "cleared", cause: "degraded" });
          }
          dispatch({ type: "degraded", shown: false });
        }
      }

      if (event.type === "completed") {
        const current = latest.current.session;
        completeRecording(
          current && {
            ...current,
            status: "COMPLETED",
            endedAt: new Date().toISOString(),
          }
        );
        if (current) invalidateLifecycleQueries(current.noteId, true);
      }

      if (event.type === "error" && isTerminalError(event)) {
        failRecording({
          type: "failed",
          message:
            event.reason === "MEETING_ENDED"
              ? meetingEndedMessage(t, latest.current.buffer?.pendingMs ?? 0)
              : event.message,
        });
      }

      if (event.type === "superseded") {
        failRecording({ type: "failed", message: t("superseded") });
        dispatch({ type: "session", session: null });
      }
    },
    [
      cancelDegradedTimer,
      completeRecording,
      dispatch,
      failRecording,
      invalidateLifecycleQueries,
      t,
    ]
  );

  useEffect(() => {
    const response = sessionQuery.data;
    const serverSession =
      response?.status === 200 && response.data.success
        ? response.data.data
        : undefined;
    if (
      !serverSession ||
      serverSession.sessionId !== latest.current.session?.sessionId
    ) {
      return;
    }

    if (serverSession.status === "ACTIVE") {
      controllerRef.current?.reconcile("ACTIVE");
      return;
    }
    const timer = window.setTimeout(() => {
      if (serverSession.status === "COMPLETED" && phase !== "completed") {
        const controller = controllerRef.current;
        controller?.reconcile("COMPLETED");
        if (!stopPromiseRef.current && controllerRef.current === controller) {
          controllerRef.current = null;
        }
        dispatchTranscript({
          type: "completed",
          sessionId: serverSession.sessionId,
        });
        completeRecording(serverSession);
        invalidateLifecycleQueries(serverSession.noteId, true);
        return;
      }
      if (serverSession.status !== "INTERRUPTED") return;
      const meetingDecision =
        serverSession.endReason === "MEETING_ENDED" ||
        serverSession.endReason === "MEETING_PAUSED";
      if (ACTIVE_PHASES.has(phase) && !meetingDecision) return;
      dispatch({ type: "session", session: serverSession });
      invalidateLifecycleQueries(serverSession.noteId, true);
      const { buffer, connectionNotice } = latest.current;
      const pendingMs = buffer?.pendingMs ?? 0;
      const lostMessage =
        serverSession.endReason === "MEETING_ENDED" &&
        pendingMs > 0 &&
        (phase === "failed" || connectionNotice?.cause === "disconnected")
          ? meetingEndedMessage(t, pendingMs)
          : null;
      if (phase !== "failed") {
        controllerRef.current?.reconcile("INTERRUPTED");
        failRecording({
          type: "failed",
          message: lostMessage ?? interruptedMessage(t, serverSession.endReason),
        });
      } else if (lostMessage) {
        dispatch({ type: "error", message: lostMessage });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    completeRecording,
    dispatch,
    failRecording,
    invalidateLifecycleQueries,
    phase,
    sessionQuery.data,
    t,
  ]);

  const stop = useCallback((): Promise<boolean> => {
    if (stopPromiseRef.current) return stopPromiseRef.current;
    const controller = controllerRef.current;
    if (!controller) return Promise.resolve(false);
    cancelledControllerRef.current = controller;
    const attempt = (async () => {
      dispatch({ type: "phase", phase: "stopping" });
      clearLevel();
      try {
        await controller.stop();
      } catch {
        failRecording({ type: "failed", message: t("stopFailed") });
        return false;
      }
      const reconciled =
        controllerRef.current === controller &&
        latest.current.session?.status === "COMPLETED";
      if (!reconciled) {
        if (controllerRef.current === controller) {
          failRecording({
            type: "failed",
            message: t("stopUnconfirmed"),
            unconfirmedStop: true,
          });
        }
        return false;
      }
      if (controllerRef.current === controller) controllerRef.current = null;
      return true;
    })();
    const stopPromise = attempt.then((result) => {
      if (!result && stopPromiseRef.current === stopPromise) {
        stopPromiseRef.current = null;
      }
      return result;
    });
    stopPromiseRef.current = stopPromise;
    return stopPromise;
  }, [clearLevel, dispatch, failRecording, t]);

  const start = useCallback(
    async (noteId: string, workspaceId: string) => {
      if (controllerRef.current || ACTIVE_PHASES.has(phase)) return;

      const current = latest.current.session;
      stopPromiseRef.current = null;
      cancelledControllerRef.current = null;
      const reusableSession =
        current?.noteId === noteId &&
        current.status === "READY" &&
        Date.parse(current.readyExpiresAt) > Date.now()
          ? current
          : null;
      const adopted = reusableSession ? null : adoptDeadRecorder(noteId);
      if (adopted) logTranscription("takeover", { noteId, ...adopted });

      dispatchTranscript({ type: "reset" });
      cancelDegradedTimer();
      dispatch({
        type: "started",
        noteId,
        workspaceId,
        session: reusableSession,
      });
      const teardownCount = teardownCountRef.current;
      const controller = runtime.createSession({
        url: transcriptionWebSocketUrl(),
        onEvent: handleEvent,
        onLevel: publishLevel,
        onFailure: (kind, { droppedMs }) => {
          if (controllerRef.current !== controller) return;
          const message = runtimeFailureMessage(t, kind, droppedMs);
          failRecording(
            kind === "resume_window_exhausted"
              ? { type: "window-exhausted", message, droppedMs }
              : { type: "failed", message }
          );
        },
        onNoticeChange: (notice) => dispatch({ type: "notice", notice }),
        onBufferChange: (buffer) => dispatch({ type: "buffer", buffer }),
        onMicrophoneChange: (microphone) =>
          dispatch({ type: "microphone", microphone }),
        onSystemAudioChange: (systemAudio) =>
          dispatch({ type: "system-audio", systemAudio }),
        onCaptureError: (code) => {
          if (controllerRef.current !== controller) return;
          logTranscription("capture_error", { noteId, code });
          dispatch({ type: "error", message: t("captureStopped") });
          toast.error(t("captureStoppedToast"), {
            id: "desktop-capture-failed",
            description: tToast("code", { code }),
          });
          void stop();
        },
      });
      controllerRef.current = controller;
      const cancelled = () =>
        cancelledControllerRef.current === controller ||
        controllerRef.current !== controller;
      const tornDown = () => teardownCountRef.current !== teardownCount;

      try {
        await controller.requestPermission();
        if (cancelled()) {
          await controller.close();
          return;
        }
        dispatch({ type: "phase", phase: "connecting" });
        const connectionSession =
          reusableSession ?? (await api.startSession(noteId));
        if (!reusableSession) {
          if (connectionSession.firstRecording) {
            trackConversion("first_recording", { workspace_id: workspaceId });
          }
          invalidateLifecycleQueries(noteId);
        }
        if (cancelled()) {
          if (!tornDown()) {
            dispatch({ type: "session", session: connectionSession });
          }
          await controller.close();
          return;
        }
        dispatch({ type: "session", session: connectionSession });
        await controller.connect(connectionSession.sessionId);
        if (cancelled()) return;
        dispatch({
          type: "session",
          session: {
            ...connectionSession,
            status: "ACTIVE",
            startedAt: connectionSession.startedAt ?? new Date().toISOString(),
          },
        });
        dispatch({ type: "phase", phase: "recording" });
        setActivatedAt(Date.now());
        invalidateLifecycleQueries(noteId);
        track("recording_started", { workspace_id: workspaceId });
      } catch (cause) {
        await controller.close();
        if (controllerRef.current !== controller) return;
        controllerRef.current = null;
        if (errorCodeOf(cause) === "WORKSPACE_NOT_FOUND") {
          notifyWorkspaceGone();
          forgetWorkspace(queryClient, workspaceId);
          dispatch({ type: "evicted" });
          clearLevel();
          return;
        }
        track("recording_failed", {
          workspace_id: workspaceId,
          reason:
            errorCodeOf(cause) ??
            (cause instanceof Error
              ? cause.name === "Error"
                ? cause.message
                : cause.name
              : "unknown"),
        });
        const quotaExceeded = isQuotaExceeded(cause);
        dispatch({
          type: "start-failed",
          message: startErrorMessage(t, cause),
          quotaExceeded,
        });
        if (quotaExceeded) void invalidateWorkspaceBilling(queryClient, workspaceId);
        clearLevel();
        invalidateLifecycleQueries(noteId);
      }
    },
    [
      api,
      cancelDegradedTimer,
      clearLevel,
      dispatch,
      failRecording,
      handleEvent,
      invalidateLifecycleQueries,
      phase,
      publishLevel,
      queryClient,
      runtime,
      stop,
      t,
      tToast,
    ]
  );

  const disconnect = useCallback(
    async (noteId?: string) => {
      if (noteId && latest.current.activeNoteId !== noteId) return;
      teardownCountRef.current += 1;
      const controller = controllerRef.current;
      const current = latest.current.session;
      controllerRef.current = null;
      cancelledControllerRef.current = null;
      stopPromiseRef.current = null;

      clearLevel();
      forgetRecording();
      cancelDegradedTimer();
      dispatch({ type: "disconnected" });
      dispatchTranscript({ type: "reset" });

      await controller?.close();
      if (current) invalidateTranscriptQueries(current.noteId);
    },
    [cancelDegradedTimer, clearLevel, dispatch, invalidateTranscriptQueries]
  );

  useEffect(() => {
    const gone =
      errorCodeOf(sessionQuery.error) === "WORKSPACE_NOT_FOUND" ||
      errorCodeOf(sessionQuery.failureReason) === "WORKSPACE_NOT_FOUND";
    const sessionGone = [sessionQuery.error, sessionQuery.failureReason].some(
      (error) => errorCodeOf(error) === "TRANSCRIPTION_SESSION_NOT_FOUND"
    );
    if (sessionGone && !gone) {
      const timer = window.setTimeout(() => void disconnect(), 0);
      return () => window.clearTimeout(timer);
    }
    if (!gone) return;
    notifyWorkspaceGone();
    if (activeWorkspaceId) forgetWorkspace(queryClient, activeWorkspaceId);
    const timer = window.setTimeout(() => void disconnect(), 0);
    return () => window.clearTimeout(timer);
  }, [
    activeWorkspaceId,
    disconnect,
    queryClient,
    sessionQuery.error,
    sessionQuery.failureReason,
  ]);

  useEffect(
    () => () => {
      void controllerRef.current?.close();
    },
    []
  );

  const holdTab =
    ACTIVE_PHASES.has(phase) || (state.buffer?.pendingMs ?? 0) > 0;
  useEffect(() => {
    if (!holdTab) return;
    const hold = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [holdTab]);

  const value = useMemo<RecordingContextValue>(
    () => ({
      session: state.session,
      activeNoteId: state.activeNoteId,
      activeWorkspaceId: state.activeWorkspaceId,
      phase: state.phase,
      elapsedMs,
      clockOriginMs,
      transcriptionDegraded: state.transcriptionDegraded,
      connectionNotice: state.connectionNotice,
      buffer: state.buffer,
      microphone: state.microphone,
      systemAudio: state.systemAudio,
      error: state.error,
      quotaExceeded: state.quotaExceeded,
      start,
      stop,
      disconnect,
    }),
    [state, elapsedMs, clockOriginMs, start, stop, disconnect]
  );
  const meterValue = useMemo<RecordingMeterValue>(
    () => ({ level, levelHistory }),
    [level, levelHistory]
  );

  const recordingNoteId = ACTIVE_PHASES.has(phase)
    ? (activeNoteId ?? session?.noteId ?? null)
    : null;

  return (
    <RecordingContext.Provider value={value}>
      <RecordingNoteContext.Provider value={recordingNoteId}>
        <RecordingTranscriptContext.Provider value={transcript}>
          <RecordingMeterContext.Provider value={meterValue}>
            {children}
          </RecordingMeterContext.Provider>
        </RecordingTranscriptContext.Provider>
      </RecordingNoteContext.Provider>
    </RecordingContext.Provider>
  );
}

export function useRecording() {
  const value = useContext(RecordingContext);
  if (!value) {
    throw new Error("useRecording must be used inside RecordingProvider.");
  }
  return value;
}

export function useIsRecordingBusy() {
  const value = useContext(RecordingContext);
  return value ? isRecordingLive(value) : false;
}

export function useRecordingNoteId() {
  return useContext(RecordingNoteContext);
}

export function useRecordingMeter() {
  const value = useContext(RecordingMeterContext);
  if (!value) {
    throw new Error("useRecordingMeter must be used inside RecordingProvider.");
  }
  return value;
}

export function useRecordingTranscript() {
  const value = useContext(RecordingTranscriptContext);
  if (!value) {
    throw new Error(
      "useRecordingTranscript must be used inside RecordingProvider."
    );
  }
  return value;
}
