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

import type { StartTranscriptionSessionResponseData } from "@/lib/api/generated/models";
import {
  getGetNoteTranscriptQueryKey,
  useGetTranscriptionSession,
  useStartTranscriptionSession,
} from "@/lib/api/generated/transcription/transcription";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import {
  BrowserRealtimeSession,
  type RealtimeSessionController,
  type RealtimeSessionOptions,
} from "@/lib/transcription/realtime-session";
import type { ServerEvent } from "@/lib/transcription/protocol";
import {
  initialTranscriptState,
  transcriptReducer,
  type TranscriptState,
} from "@/lib/transcription/transcript-reducer";

export type RecordingRuntime = {
  createSession: (options: RealtimeSessionOptions) => RealtimeSessionController;
};

export type LocalRecordingSession = StartTranscriptionSessionResponseData;

export type RecordingApi = {
  startSession: (
    noteId: string
  ) => Promise<StartTranscriptionSessionResponseData>;
};

export type RecordingPhase =
  | "idle"
  | "requesting-permission"
  | "connecting"
  | "recording"
  | "stopping"
  | "completed"
  | "failed";

export type RecordingContextValue = {
  session: LocalRecordingSession | null;
  activeNoteId: string | null;
  phase: RecordingPhase;
  elapsedMs: number;
  error: string | null;
  start: (noteId: string) => Promise<void>;
  stop: () => Promise<void>;
  disconnect: () => Promise<void>;
};

export type RecordingMeterValue = {
  level: number;
  levelHistory: number[];
};

const RecordingContext = createContext<RecordingContextValue | null>(null);
const RecordingTranscriptContext = createContext<TranscriptState | null>(null);
const RecordingMeterContext = createContext<RecordingMeterValue | null>(null);
const ACTIVE_PHASES = new Set<RecordingPhase>([
  "requesting-permission",
  "connecting",
  "recording",
  "stopping",
]);

/**
 * 이 노트의 전사 세션이 아직 살아 있는가 — 살아 있으면 회의 중지·종료가 계약상
 * `ACTIVE_TRANSCRIPTION_SESSION`(409)로 막힌다. **`failed`도 세션이 열려 있으면 활성이다**:
 * stop이 실패하면 phase는 failed지만 READY/ACTIVE 세션은 그대로 남아 서버가 여전히 거절한다.
 */
export function isNoteRecordingActive(
  recording: Pick<
    RecordingContextValue,
    "activeNoteId" | "session" | "phase"
  >,
  noteId: string
): boolean {
  if (recording.activeNoteId !== noteId) return false;
  // 진행 phase는 세션 id가 붙기 전(권한 요청·연결 중)이라도 활성이다 — 그 사이 pause/end를
  // 열어 두면 뒤늦게 시작이 세션을 만들어 회의를 되살린다.
  if (ACTIVE_PHASES.has(recording.phase)) return true;
  // failed는 서버 세션이 아직 열려 있을 때만 활성(READY/ACTIVE).
  const sessionOpen =
    recording.session?.status === "READY" || recording.session?.status === "ACTIVE";
  return recording.phase === "failed" && sessionOpen;
}

/**
 * `stop()`이 이 노트의 녹음을 곱게 끝낼 수 있는가 — **연결돼 녹음 중일 때(`recording`)만**이다.
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
 * 이 노트의 녹음이 아직 시작 중인가(권한 요청·연결). **이 창에서는 회의를 끝내면 안 된다** —
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

const PROJECT_NOTES_QUERY_PATTERN = /^\/v1\/projects\/[^/]+\/notes$/;

function getStartErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  const name = cause instanceof Error ? cause.name : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "마이크 권한이 필요합니다. 브라우저 설정에서 마이크 사용을 허용해 주세요.";
  }

  if (name === "NotFoundError") {
    return "사용할 수 있는 마이크를 찾지 못했습니다.";
  }

  if (
    message === "WEBSOCKET_CLOSED" ||
    message === "WEBSOCKET_CONNECTION_FAILED" ||
    message === "STOMP_APPLICATION_READY_TIMEOUT"
  ) {
    return "실시간 전사 서버에 연결하지 못했습니다. 로그인 상태와 서버 연결을 확인해 주세요.";
  }

  if (message === "SESSION_CREATE_FAILED") {
    return "전사 세션을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  return "녹음을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

type ServerErrorCode = Extract<ServerEvent, { type: "error" }>["code"];

function getServerErrorMessage(code: ServerErrorCode) {
  if (code === "INVALID_CLIENT_MESSAGE" || code === "INVALID_AUDIO_FRAME") {
    return "오디오를 처리하지 못했습니다. 녹음을 다시 시작해 주세요.";
  }
  if (code === "STT_CONNECTION_FAILED") {
    return "음성 인식 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (code === "STT_TRANSCRIPTION_FAILED") {
    return "음성을 기록하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "실시간 전사를 계속할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

function getRuntimeFailureMessage(message: string) {
  if (message.includes("네트워크가 느려")) {
    return "네트워크가 불안정해 오디오 전송을 중단했습니다. 연결을 확인해 주세요.";
  }
  if (message.includes("완료 응답") || message.includes("종료 요청")) {
    return "마지막 기록을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "실시간 전사 연결이 중단되었습니다. 잠시 후 다시 시도해 주세요.";
}

function getInterruptedMessage(endReason: string | null) {
  if (endReason === "STT_PROVIDER_ERROR") {
    return "음성 인식 서비스 연결이 중단되었습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (endReason === "CLIENT_DISCONNECTED") {
    return "실시간 연결이 종료되어 녹음을 중단했습니다.";
  }
  return "서버에서 전사 세션이 중단되었습니다.";
}

function getWebSocketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const baseUrl = shouldEnableMocking()
    ? `${protocol}//${window.location.host}`
    : apiBaseUrl
      ? apiBaseUrl.replace(/^http/, "ws").replace(/\/$/, "")
      : `${protocol}//${window.location.host}`;
  return `${baseUrl}/ws/transcriptions`;
}

const browserRuntime: RecordingRuntime = {
  createSession: (options) => new BrowserRealtimeSession(options),
};

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
  const startSessionMutation = useStartTranscriptionSession();
  const [session, setSession] = useState<LocalRecordingSession | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [transcript, dispatchTranscript] = useReducer(
    transcriptReducer,
    initialTranscriptState
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [levelHistory, setLevelHistory] = useState<number[]>(() =>
    Array(24).fill(0)
  );
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<LocalRecordingSession | null>(null);
  const controllerRef = useRef<RealtimeSessionController | null>(null);
  const smoothedLevelRef = useRef(0);
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
      refetchOnWindowFocus: true,
    },
  });

  const setCurrentSession = useCallback(
    (next: LocalRecordingSession | null) => {
      sessionRef.current = next;
      setSession(next);
    },
    []
  );

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
          const response = await startSessionMutation.mutateAsync({ noteId });
          if (
            response.status !== 201 ||
            !response.data.success ||
            !response.data.data
          ) {
            throw new Error("SESSION_CREATE_FAILED");
          }
          return response.data.data;
        },
      },
    [apiOverride, startSessionMutation]
  );

  const invalidateTranscriptQueries = useCallback(
    (noteId: string) => {
      void queryClient.invalidateQueries({
        queryKey: getGetNoteTranscriptQueryKey(noteId),
      });
    },
    [queryClient]
  );

  const invalidateNoteListQueries = useCallback(() => {
    void queryClient.invalidateQueries({
      predicate: ({ queryKey }) =>
        typeof queryKey[0] === "string" &&
        PROJECT_NOTES_QUERY_PATTERN.test(queryKey[0]),
    });
  }, [queryClient]);

  const failRecording = useCallback(
    (message: string) => {
      dispatchTranscript({ type: "clear-partials" });
      setError(message);
      setPhase("failed");
      clearLevel();
      const controller = controllerRef.current;
      controllerRef.current = null;
      void controller?.close();
      const current = sessionRef.current;
      if (current) invalidateTranscriptQueries(current.noteId);
    },
    [clearLevel, invalidateTranscriptQueries]
  );

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      dispatchTranscript(event);

      if (event.type === "final" && sessionRef.current) {
        invalidateTranscriptQueries(sessionRef.current.noteId);
      }

      if (event.type === "completed") {
        const current = sessionRef.current;
        if (current) {
          setCurrentSession({
            ...current,
            status: "COMPLETED",
            endedAt: new Date().toISOString(),
          });
          invalidateTranscriptQueries(current.noteId);
          invalidateNoteListQueries();
        }
        setPhase("completed");
        clearLevel();
      }

      if (event.type === "error") {
        failRecording(getServerErrorMessage(event.code));
      }
    },
    [
      clearLevel,
      failRecording,
      invalidateNoteListQueries,
      invalidateTranscriptQueries,
      setCurrentSession,
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
      serverSession.sessionId !== sessionRef.current?.sessionId
    ) {
      return;
    }

    if (serverSession.status === "ACTIVE") {
      controllerRef.current?.reconcile("ACTIVE");
      return;
    }
    const reconcileTimer = window.setTimeout(() => {
      if (serverSession.status === "COMPLETED" && phase !== "completed") {
        controllerRef.current?.reconcile("COMPLETED");
        dispatchTranscript({
          type: "completed",
          sessionId: serverSession.sessionId,
        });
        setCurrentSession(serverSession);
        setPhase("completed");
        clearLevel();
        invalidateTranscriptQueries(serverSession.noteId);
        invalidateNoteListQueries();
        return;
      }
      if (serverSession.status === "INTERRUPTED") {
        setCurrentSession(serverSession);
        if (phase !== "failed") {
          controllerRef.current?.reconcile("INTERRUPTED");
          failRecording(getInterruptedMessage(serverSession.endReason));
        }
      }
    }, 0);
    return () => window.clearTimeout(reconcileTimer);
  }, [
    clearLevel,
    failRecording,
    invalidateNoteListQueries,
    invalidateTranscriptQueries,
    phase,
    sessionQuery.data,
    setCurrentSession,
  ]);

  const start = useCallback(
    async (noteId: string) => {
      if (controllerRef.current || ACTIVE_PHASES.has(phase)) return;

      const current = sessionRef.current;
      const reusableSession =
        current?.noteId === noteId &&
        current.status === "READY" &&
        Date.parse(current.readyExpiresAt) > Date.now()
          ? current
          : null;

      dispatchTranscript({ type: "reset" });
      setActiveNoteId(noteId);
      setCurrentSession(reusableSession);
      setError(null);
      setElapsedMs(0);
      setPhase("requesting-permission");
      const controller = runtime.createSession({
        url: getWebSocketUrl(),
        onEvent: handleEvent,
        onLevel: publishLevel,
        onFailure: (message) =>
          failRecording(getRuntimeFailureMessage(message)),
      });
      controllerRef.current = controller;

      try {
        await controller.requestPermission();
        setPhase("connecting");
        const connectionSession =
          reusableSession ?? (await api.startSession(noteId));
        setCurrentSession(connectionSession);
        await controller.connect(connectionSession.sessionId);
        if (controllerRef.current !== controller) return;
        setCurrentSession({
          ...connectionSession,
          status: "ACTIVE",
          startedAt: connectionSession.startedAt ?? new Date().toISOString(),
        });
        setPhase("recording");
      } catch (cause) {
        await controller.close();
        if (controllerRef.current !== controller) return;
        controllerRef.current = null;
        setError(getStartErrorMessage(cause));
        setPhase("failed");
        clearLevel();
      }
    },
    [
      api,
      clearLevel,
      failRecording,
      handleEvent,
      phase,
      publishLevel,
      runtime,
      setCurrentSession,
    ]
  );

  const stop = useCallback(async () => {
    const controller = controllerRef.current;
    if (!controller) return;
    setPhase("stopping");
    clearLevel();
    try {
      await controller.stop();
    } catch {
      failRecording("녹음을 종료하는 중 오류가 발생했습니다.");
      return;
    }
    if (controllerRef.current === controller) controllerRef.current = null;
    const current = sessionRef.current;
    if (current) invalidateTranscriptQueries(current.noteId);
  }, [clearLevel, failRecording, invalidateTranscriptQueries]);

  const disconnect = useCallback(async () => {
    const controller = controllerRef.current;
    const current = sessionRef.current;
    controllerRef.current = null;

    clearLevel();
    setPhase("idle");
    setCurrentSession(null);
    setActiveNoteId(null);
    setElapsedMs(0);
    setError(null);
    dispatchTranscript({ type: "reset" });

    await controller?.close();
    if (current) invalidateTranscriptQueries(current.noteId);
  }, [clearLevel, invalidateTranscriptQueries, setCurrentSession]);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => {
      setElapsedMs((previous) => previous + 1000);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(
    () => () => {
      void controllerRef.current?.close();
    },
    []
  );

  const value = useMemo<RecordingContextValue>(
    () => ({
      session,
      activeNoteId,
      phase,
      elapsedMs,
      error,
      start,
      stop,
      disconnect,
    }),
    [session, activeNoteId, phase, elapsedMs, error, start, stop, disconnect]
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
