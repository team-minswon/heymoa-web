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

import { errorCodeOf } from "@/lib/api/error-message";
import {
  useGetTranscriptionSession,
  useStartTranscriptionSession,
} from "@/lib/api/generated/transcription/transcription";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import {
  invalidateNoteLifecycle,
  invalidateNoteTranscript,
} from "@/lib/notes/invalidate";
import { forgetWorkspace } from "@/lib/workspace/cache";
import { notifyWorkspaceGone } from "@/lib/workspace/gone-notice";
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
  startErrorMessage,
  STOP_FAILED_MESSAGE,
  STOP_UNCONFIRMED_MESSAGE,
  SUPERSEDED_MESSAGE,
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
  BrowserRealtimeSession,
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

export type LocalRecordingSession = RecordingSession;

export type RecordingApi = {
  startSession: (noteId: string) => Promise<RecordingSession>;
};

export type { RecordingPhase };

export type RecordingContextValue = {
  session: LocalRecordingSession | null;
  activeNoteId: string | null;
  /**
   * 녹음 중인 노트의 워크스페이스. 계약이 안 알려줘서(노트 응답에는 `projectId` 만, 세션
   * 응답에는 둘 다 없다) `start()` 가 받아 든다. 세션이 생기는 길은 `start()` 하나뿐이라
   * 녹음 중인데 이 값이 비는 일은 없다.
   */
  activeWorkspaceId: string | null;
  phase: RecordingPhase;
  elapsedMs: number;
  /**
   * 소리는 쌓이는데 글자만 멈춘 상태. 받아쓰기 업체 소켓이 끊긴 것은 서버만 안다. 회복하면
   * 서버가 `LIVE` 를 보내 되돌린다.
   */
  transcriptionDegraded: boolean;
  /** 받아쓰기·실시간 분석이 멈췄다는 노랑 알림. 그동안 소리는 브라우저 메모리에 쌓인다. */
  connectionNotice: ConnectionNotice | null;
  /** 서버가 확정 안 한 소리가 이 기기에 얼마나 있고, 한도에 닿아 멈췄는지. 녹음 전이면 null. */
  buffer: BufferState | null;
  microphone: MicrophoneState;
  error: string | null;
  start: (noteId: string, workspaceId: string) => Promise<void>;
  stop: () => Promise<boolean>;
  disconnect: () => Promise<void>;
};

export type RecordingMeterValue = {
  level: number;
  levelHistory: number[];
};

const RecordingContext = createContext<RecordingContextValue | null>(null);
const RecordingTranscriptContext = createContext<TranscriptState | null>(null);
const RecordingMeterContext = createContext<RecordingMeterValue | null>(null);

/**
 * 지금 붙들고 있는 전사 세션이 아직 살아 있는가. 무엇의 녹음인지는 아래 두 함수가 묻는다.
 *
 * 살아 있으면 회의 중지·종료가 계약상 `ACTIVE_TRANSCRIPTION_SESSION`(409)로 막힌다. stop 이
 * 실패해 `failed` 여도 READY/ACTIVE 세션이 남아 있으면 서버가 여전히 거절하므로 활성이다.
 */
function isRecordingLive(
  recording: Pick<RecordingContextValue, "session" | "phase">
): boolean {
  // 진행 phase는 세션 id가 붙기 전(권한 요청·연결 중)이라도 활성이다 — 그 사이 pause/end를
  // 열어 두면 뒤늦게 시작이 세션을 만들어 회의를 되살린다.
  if (ACTIVE_PHASES.has(recording.phase)) return true;
  // failed는 서버 세션이 아직 열려 있을 때만 활성(READY/ACTIVE).
  const sessionOpen =
    recording.session?.status === "READY" ||
    recording.session?.status === "ACTIVE";
  return recording.phase === "failed" && sessionOpen;
}

/** 이 노트의 전사 세션이 아직 살아 있는가. */
export function isNoteRecordingActive(
  recording: Pick<RecordingContextValue, "activeNoteId" | "session" | "phase">,
  noteId: string
): boolean {
  return recording.activeNoteId === noteId && isRecordingLive(recording);
}

/**
 * 이 워크스페이스에서 녹음이 돌고 있는가 — 나가기를 막고, 추방당하면 정리할 대상인지 가른다.
 * 녹음은 route 를 넘어 살아 있어서 A 를 녹음한 채 B 를 볼 수 있다. 그때 B 를 잠그면 틀린 잠금이다.
 */
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

/**
 * `stop()`이 이 노트의 녹음을 곱게 끝낼 수 있는가 — 연결돼 녹음 중일 때(`recording`)만이다.
 * `requesting-permission`/`connecting`은 `start()`가 아직 세션을 만드는 중이고 취소 안전하지
 * 않아, 여기서 `stop()`을 부르면 컨트롤러만 닫히고 시작 흐름이 이어져 고아 세션을 남긴다 —
 * 그래서 stoppable이 아니라 "차단(대기)"으로 둔다. `stopping`은 이미 멈추는 중, `failed`는
 * 컨트롤러가 비어 no-op이라 모두 빠진다.
 */
export function isRecordingStoppable(
  recording: Pick<RecordingContextValue, "activeNoteId" | "phase">,
  noteId: string
): boolean {
  return recording.activeNoteId === noteId && recording.phase === "recording";
}

/**
 * 이 노트의 녹음이 아직 시작 중인가(권한 요청·연결). 이 창에서는 회의를 끝내면 안 된다 —
 * 서버 세션이 아직 없어 종료가 성공해 버리고, 진행 중인 start()가 이어져 종료된 노트에 고아
 * 전사 세션을 만든다. 연결이 끝나 `recording`이 되면 곱게 중지한 뒤 종료할 수 있다.
 */
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
  createSession: (options) => new BrowserRealtimeSession(options),
};

/** 받아쓰기가 이만큼 이어서 멈춰 있을 때만 알린다. 업체 503 은 대개 1초 안에 풀린다. */
const DEGRADED_NOTICE_AFTER_MS = 5_000;

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
  // 시작 실패 문구는 이 provider 가 `error` 로 띄운다. 전역 토스트까지 뜨면 같은 실패에 둘이 선다
  const startSessionMutation = useStartTranscriptionSession({
    mutation: { meta: { suppressErrorToast: true } },
  });
  /**
   * 녹음 상태는 reducer 하나가 정하고, 마지막 값은 `latest` 로 곧바로 읽는다. `stop()` 은 `await`
   * 뒤에 그 사이 completed 가 세션을 끝냈는지 봐야 해서 다음 렌더를 기다리면 늦다.
   */
  const latest = useRef(initialRecordingState);
  const [state, setState] = useState(initialRecordingState);
  const dispatch = useCallback((action: RecordingAction) => {
    const previous = latest.current;
    const next = recordingReducer(previous, action);
    if (next === previous) return;
    // 한 act 안의 연쇄 전이도 빠짐없이 남기려고 effect 가 아니라 여기서 센다
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
    Array(24).fill(0)
  );
  const smoothedLevelRef = useRef(0);
  const degradedTimerRef = useRef<number | undefined>(undefined);
  const controllerRef = useRef<RealtimeSessionController | null>(null);
  const cancelledControllerRef = useRef<RealtimeSessionController | null>(null);
  const stopPromiseRef = useRef<Promise<boolean> | null>(null);
  /**
   * `disconnect()` 가 몇 번 돌았나. 진행 중인 `start()` 가 자기 결과를 되돌려 놓아도 되는지 가른다.
   *
   * `cancelled()` 만으로는 부족하다. 사용자가 취소했으면 서버에 열린 READY 세션을 독이 알아야
   * 해서 세션을 일부러 남기지만, 강제 정리는 반대다 — phase 가 `idle` 이라 폴링도 안 도는데
   * 세션만 되살아나면 아무도 안 보는 고아가 만료될 때까지 남는다.
   */
  const teardownCountRef = useRef(0);
  const hasOpenSession =
    session?.status === "READY" || session?.status === "ACTIVE";
  const shouldPoll =
    enablePolling &&
    Boolean(session?.sessionId) &&
    (ACTIVE_PHASES.has(phase) || (phase === "failed" && hasOpenSession));
  const sessionQuery = useGetTranscriptionSession(session?.sessionId ?? "", {
    query: {
      enabled: shouldPoll,
      staleTime: 0,
      refetchInterval: shouldPoll ? 3_000 : false,
      // 숨긴 탭에서도 묻는다. 그동안에도 마이크와 소켓은 살아 있고, 아래 추방 정리가 이 조회를
      // 신호로 쓴다. 멈추면 권한이 사라진 노트로 음성이 계속 나간다.
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
    },
  });
  /**
   * 창이 끝나 멈추면 세션이 INTERRUPTED 라 위 폴링이 멎는다. 그 뒤 남이 회의를 끝내면 버린 소리를
   * 말할 수 없어서, 노트 화면과 같은 캐시를 같은 주기로 묻는다. 종료를 알거나 문구가 바뀌면 멎는다.
   */
  const watchMeetingEnd =
    enablePolling &&
    phase === "failed" &&
    state.windowExhausted &&
    activeNoteId !== null;
  const droppedNoteQuery = useGetNote(activeNoteId ?? "", {
    query: {
      enabled: watchMeetingEnd,
      refetchInterval: watchMeetingEnd ? 3_000 : false,
      refetchIntervalInBackground: true,
    },
  });
  const droppedNoteResponse = droppedNoteQuery.data;
  const meetingEndedAfterDrop =
    watchMeetingEnd &&
    droppedNoteResponse?.status === 200 &&
    droppedNoteResponse.data.data?.meetingStatus === "ENDED";

  useEffect(() => {
    if (!meetingEndedAfterDrop) return;
    const { droppedMs } = latest.current;
    logTranscription("notice", {
      state: "shown",
      cause: "meeting_ended_after_drop",
      droppedMs,
    });
    dispatch({ type: "error", message: meetingEndedMessage(droppedMs) });
  }, [dispatch, meetingEndedAfterDrop]);

  useEffect(() => () => window.clearTimeout(degradedTimerRef.current), []);

  /** 늦게 도는 5초 타이머가 끝난 녹음에 멈춤 알림을 되살리지 않게 녹음이 끝나는 모든 길에서 부른다. */
  const cancelDegradedTimer = useCallback(() => {
    window.clearTimeout(degradedTimerRef.current);
    degradedTimerRef.current = undefined;
  }, []);

  const liveNoteId =
    activeNoteId && isRecordingLive({ phase, session }) ? activeNoteId : null;
  // 새로고침한 탭의 첫 상태가 idle 이다. 그때 지우면 독이 제 녹음에 잠기고, 식게 두면 다른 탭이
  // 산 탭의 ID 를 이어받는다. 그래서 idle 은 제 기록의 박동만 이어 간다.
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
    setLevelHistory(Array(24).fill(0));
  }, []);

  const api = useMemo<RecordingApi>(
    () =>
      apiOverride ?? {
        startSession: async (noteId) => {
          const response = await startSessionMutation.mutateAsync({
            noteId,
            data: { clientInstanceId: clientInstanceId() },
          });
          // 200 은 같은 사용자가 이미 연 READY 세션을 돌려받은 것이다(멱등)
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
      if (transcript) invalidateTranscriptQueries(noteId);
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
    (completed: LocalRecordingSession | null) => {
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
        // LIVE 는 새 업체 연결이 처음 답할 때 온다. 무응답 동안은 DEGRADED 가 이어진다
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

      // 재시도할 만한 오류는 컨트롤러가 같은 세션에 다시 붙어 푼다. 녹음을 끝내지 않는다.
      if (event.type === "error" && isTerminalError(event)) {
        // 문구는 서버 것을 쓴다(rule error-loading). 회의 종료만은 이 기기에 남은 소리를 같이
        // 말해야 해서 web 이 만든다
        failRecording({
          type: "failed",
          message:
            event.reason === "MEETING_ENDED"
              ? meetingEndedMessage(latest.current.buffer?.pendingMs ?? 0)
              : event.message,
        });
      }

      // 이 세션은 이제 다른 탭·기기의 것이다. 들고 있으면 이 탭이 회의 제어를 막는다.
      if (event.type === "superseded") {
        failRecording({ type: "failed", message: SUPERSEDED_MESSAGE });
        dispatch({ type: "session", session: null });
      }
    },
    [
      cancelDegradedTimer,
      completeRecording,
      dispatch,
      failRecording,
      invalidateLifecycleQueries,
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
    // 전이는 다음 틱으로 미룬다. effect 본문에서 곧바로 상태를 여럿 바꾸면 렌더 중 연쇄가 된다
    // (`react-hooks/set-state-in-effect`). 아래 추방 정리도 같은 이유로 타이머를 거친다.
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
      // 끊김은 컨트롤러가 같은 세션에 다시 붙어 푼다. 폴링은 표시용이고, 녹음을 끝내는 것은 회의
      // 쪽 결정뿐이다. 세션이 정말 끝났으면 다시 붙을 때 서버가 in-band 로 거절한다.
      const meetingDecision =
        serverSession.endReason === "MEETING_ENDED" ||
        serverSession.endReason === "MEETING_PAUSED";
      if (ACTIVE_PHASES.has(phase) && !meetingDecision) return;
      dispatch({ type: "session", session: serverSession });
      invalidateLifecycleQueries(serverSession.noteId, true);
      // 끊긴 채(또는 재부착이 거절된 뒤) 회의가 끝나면 이 기기에 남은 소리는 올릴 세션이 없다.
      // 거절 reason 이 없는 옛 server 는 이 폴링으로만 안다
      const { buffer, connectionNotice } = latest.current;
      const pendingMs = buffer?.pendingMs ?? 0;
      const lostMessage =
        serverSession.endReason === "MEETING_ENDED" &&
        pendingMs > 0 &&
        (phase === "failed" || connectionNotice?.cause === "disconnected")
          ? meetingEndedMessage(pendingMs)
          : null;
      if (phase !== "failed") {
        controllerRef.current?.reconcile("INTERRUPTED");
        failRecording({
          type: "failed",
          message: lostMessage ?? interruptedMessage(serverSession.endReason),
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
  ]);

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
      // 진행 phase 의 박동이 이 탭 ID 로 기록을 적기 전에 판정한다. 뒤에서 하면 제 기록이 보여 이어받지 않는다
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
          // 같은 사건을 이벤트로 이미 받아 서버 문구로 끝냈다
          if (controllerRef.current !== controller) return;
          const message = runtimeFailureMessage(kind, droppedMs);
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
      });
      controllerRef.current = controller;
      const cancelled = () =>
        cancelledControllerRef.current === controller ||
        controllerRef.current !== controller;
      /** 그 사이 `disconnect()` 가 돌았나 — 강제 정리라 상태를 되돌려 놓으면 안 된다. */
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
          invalidateLifecycleQueries(noteId);
        }
        if (cancelled()) {
          // 사용자가 취소한 것이면 서버에 열린 READY 세션을 화면이 알아야 한다. 강제 정리면
          // 반대로 아무것도 남기지 않는다 — 넣어 두면 폴링도 안 도는 고아가 된다.
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
      } catch (cause) {
        await controller.close();
        if (controllerRef.current !== controller) return;
        controllerRef.current = null;
        // 시작하는 사이에 쫓겨났다. 세션 조회는 `sessionId` 가 있어야 켜지므로 아직 안 돌고, 다른
        // 워크스페이스로 옮겼으면 화면 쪽 감지기도 없다. 여기서 알리지 않으면 아무도 안 알린다.
        if (errorCodeOf(cause) === "WORKSPACE_NOT_FOUND") {
          notifyWorkspaceGone();
          forgetWorkspace(queryClient, workspaceId);
          dispatch({ type: "evicted" });
          clearLevel();
          return;
        }
        dispatch({ type: "start-failed", message: startErrorMessage(cause) });
        clearLevel();
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
    ]
  );

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
        failRecording({ type: "failed", message: STOP_FAILED_MESSAGE });
        return false;
      }
      const reconciled =
        controllerRef.current === controller &&
        latest.current.session?.status === "COMPLETED";
      if (!reconciled) {
        if (controllerRef.current === controller) {
          failRecording({ type: "failed", message: STOP_UNCONFIRMED_MESSAGE });
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
  }, [clearLevel, dispatch, failRecording, latest]);

  const disconnect = useCallback(async () => {
    // 진행 중인 `start()` 에게 결과를 되돌려 놓지 말라고 알린다. 컨트롤러를 비우기 전에 올려야
    // 그 사이에 끝난 요청도 이 값을 보고 판단한다.
    teardownCountRef.current += 1;
    const controller = controllerRef.current;
    const current = latest.current.session;
    controllerRef.current = null;
    cancelledControllerRef.current = null;
    stopPromiseRef.current = null;

    clearLevel();
    forgetRecording();
    cancelDegradedTimer();
    // 남은 소리 수치까지 비운다. 남으면 phase 가 idle 이어도 탭 닫기를 붙잡는다
    dispatch({ type: "disconnected" });
    dispatchTranscript({ type: "reset" });

    await controller?.close();
    if (current) invalidateTranscriptQueries(current.noteId);
  }, [cancelDegradedTimer, clearLevel, dispatch, invalidateTranscriptQueries]);

  /**
   * 녹음 중에 그 워크스페이스에서 쫓겨났으면 보고 있는 화면과 무관하게 끊는다. 녹음은 route 를
   * 넘어 살아 있어서 A 를 녹음한 채 B 를 볼 수 있고, 화면 쪽 감지는 열려 있는 워크스페이스만 본다.
   *
   * 신호는 자기 세션 조회다. 비멤버에게는 같은 404(`WORKSPACE_NOT_FOUND`)를 준다. `stop()` 이
   * 아니라 `disconnect()` 인 것은 세션 종료 API 도 이미 404 라서다.
   */
  useEffect(() => {
    // `error` 는 재시도를 다 소진해야 채워지고 그 전에 `paused` 로 멈출 수 있다. 404 는 다시
    // 물어도 같으니 첫 실패를 본다.
    const gone =
      errorCodeOf(sessionQuery.error) === "WORKSPACE_NOT_FOUND" ||
      errorCodeOf(sessionQuery.failureReason) === "WORKSPACE_NOT_FOUND";
    if (!gone) return;
    // 화면이 다른 워크스페이스에 있으면 이 경로만 404 를 본다. 알리고 캐시에서도 걷어야 사이드바가
    // 죽은 워크스페이스를 계속 그리지 않는다. 화면 쪽과 같은 토스트 id 라 하나만 선다.
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

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(
      () => dispatch({ type: "tick", ms: 1000 }),
      1000
    );
    return () => window.clearInterval(timer);
  }, [dispatch, phase]);

  useEffect(
    () => () => {
      void controllerRef.current?.close();
    },
    []
  );

  // 멈췄거나 실패했어도 서버가 확정 안 한 소리가 남아 있으면 붙잡는다. 닫으면 그 소리는 사라진다
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
      elapsedMs: state.elapsedMs,
      transcriptionDegraded: state.transcriptionDegraded,
      connectionNotice: state.connectionNotice,
      buffer: state.buffer,
      microphone: state.microphone,
      error: state.error,
      start,
      stop,
      disconnect,
    }),
    [state, start, stop, disconnect]
  );
  const meterValue = useMemo<RecordingMeterValue>(
    () => ({ level, levelHistory }),
    [level, levelHistory]
  );

  return (
    <RecordingContext.Provider value={value}>
      <RecordingTranscriptContext.Provider value={transcript}>
        <RecordingMeterContext.Provider value={meterValue}>
          {children}
        </RecordingMeterContext.Provider>
      </RecordingTranscriptContext.Provider>
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
