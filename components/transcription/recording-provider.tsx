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
  useStartTranscriptionSession,
} from "@/lib/api/generated/transcription/transcription";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { PcmAudioCapture } from "@/lib/transcription/audio";
import type { ServerEvent } from "@/lib/transcription/protocol";
import { TranscriptionSocket } from "@/lib/transcription/socket";
import {
  initialTranscriptState,
  transcriptReducer,
  type TranscriptState,
} from "@/lib/transcription/transcript-reducer";

type AudioController = Pick<
  PcmAudioCapture,
  "requestPermission" | "start" | "stop"
>;
type SocketController = Pick<
  TranscriptionSocket,
  "connect" | "sendAudio" | "commit" | "stop" | "close"
>;

export type RecordingRuntime = {
  createAudio: (
    onChunk: (chunk: ArrayBuffer) => void,
    onLevel: (level: number) => void
  ) => AudioController;
  createSocket: (options: {
    url: string;
    onEvent: (event: ServerEvent) => void;
    onClose: (code: number, reason: string) => void;
  }) => SocketController;
};

export type LocalRecordingSession = StartTranscriptionSessionResponseData;

export type RecordingApi = {
  startSession: (noteId: string) => Promise<StartTranscriptionSessionResponseData>;
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
  phase: RecordingPhase;
  transcript: TranscriptState;
  elapsedMs: number;
  level: number;
  levelHistory: number[];
  error: string | null;
  start: (noteId: string) => Promise<void>;
  commit: () => void;
  stop: () => Promise<void>;
};

const RecordingContext = createContext<RecordingContextValue | null>(null);

function getStartErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";

  if (
    message === "WEBSOCKET_CLOSED" ||
    message === "WEBSOCKET_CONNECTION_FAILED"
  ) {
    return "실시간 전사 서버에 연결하지 못했습니다. 로그인 상태와 서버 연결을 확인해 주세요.";
  }

  return message || "녹음을 시작하지 못했습니다.";
}

const browserRuntime: RecordingRuntime = {
  createAudio: (onChunk, onLevel) =>
    new PcmAudioCapture({ onChunk, onLevel }),
  createSocket: (options) => new TranscriptionSocket(options),
};

export function RecordingProvider({
  children,
  api: apiOverride,
  runtime = browserRuntime,
}: {
  children: React.ReactNode;
  api?: RecordingApi;
  runtime?: RecordingRuntime;
}) {
  const queryClient = useQueryClient();
  const startSessionMutation = useStartTranscriptionSession();
  const [session, setSession] = useState<LocalRecordingSession | null>(null);
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
  const socketRef = useRef<SocketController | null>(null);
  const audioRef = useRef<AudioController | null>(null);
  const stopResolveRef = useRef<(() => void) | null>(null);
  const smoothedLevelRef = useRef(0);

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

  const failRecording = useCallback(
    (message: string) => {
      setError(message);
      setPhase("failed");
      clearLevel();
      void audioRef.current?.stop();
      const current = sessionRef.current;
      if (current) invalidateTranscriptQueries(current.noteId);
      stopResolveRef.current?.();
      stopResolveRef.current = null;
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
        }
        setPhase("completed");
        stopResolveRef.current?.();
        stopResolveRef.current = null;
      }

      if (event.type === "error") failRecording(event.message);
    },
    [failRecording, invalidateTranscriptQueries, setCurrentSession]
  );

  const start = useCallback(
    async (noteId: string) => {
      if (["requesting-permission", "connecting", "recording", "stopping"].includes(phase)) {
        throw new Error("ACTIVE_TRANSCRIPTION_SESSION");
      }

      setError(null);
      setPhase("requesting-permission");
      const audio = runtime.createAudio(
        (chunk) => socketRef.current?.sendAudio(chunk),
        publishLevel
      );
      audioRef.current = audio;

      try {
        await audio.requestPermission();
        setPhase("connecting");
        const connectionSession = await api.startSession(noteId);
        setElapsedMs(0);
        setCurrentSession(connectionSession);

        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
        const wsBaseUrl = shouldEnableMocking()
          ? `${wsProtocol}//${window.location.host}`
          : apiBaseUrl
            ? apiBaseUrl.replace(/^http/, "ws").replace(/\/$/, "")
            : `${wsProtocol}//${window.location.host}`;
        const socket = runtime.createSocket({
          url: `${wsBaseUrl}/ws/transcription-sessions/${connectionSession.sessionId}`,
          onEvent: handleEvent,
          onClose: (code, reason) => {
            if (code === 1008 || code === 1011) {
              failRecording(reason || `WebSocket closed (${code})`);
            }
          },
        });
        socketRef.current = socket;
        await socket.connect();
        setCurrentSession({
          ...connectionSession,
          status: "ACTIVE",
          startedAt: connectionSession.startedAt ?? new Date().toISOString(),
        });
        await audio.start();
        setPhase("recording");
      } catch (cause) {
        await audio.stop();
        setError(getStartErrorMessage(cause));
        setPhase("failed");
      }
    },
    [api, failRecording, handleEvent, phase, publishLevel, runtime, setCurrentSession]
  );

  const commit = useCallback(() => {
    socketRef.current?.commit();
  }, []);

  const stop = useCallback(async () => {
    setPhase("stopping");
    await audioRef.current?.stop();
    clearLevel();
    await Promise.race([
      new Promise<void>((resolve) => {
        stopResolveRef.current = resolve;
        socketRef.current?.stop();
      }),
      new Promise<void>((resolve) => window.setTimeout(resolve, 11_000)),
    ]);
    socketRef.current?.close();
    const current = sessionRef.current;
    if (current) invalidateTranscriptQueries(current.noteId);
  }, [clearLevel, invalidateTranscriptQueries]);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => {
      setElapsedMs((previous) => previous + 1000);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(
    () => () => {
      socketRef.current?.close();
      void audioRef.current?.stop();
    },
    []
  );

  const value = useMemo<RecordingContextValue>(
    () => ({
      session,
      phase,
      transcript,
      elapsedMs,
      level,
      levelHistory,
      error,
      start,
      commit,
      stop,
    }),
    [
      session,
      phase,
      transcript,
      elapsedMs,
      level,
      levelHistory,
      error,
      start,
      commit,
      stop,
    ]
  );

  return (
    <RecordingContext.Provider value={value}>
      {children}
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
