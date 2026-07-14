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

import type {
  StartTranscriptionSessionResponseData,
  TranscriptionSessionResponseData,
} from "@/lib/api/generated/models";
import {
  getGetNoteTranscriptQueryKey,
  useStartTranscriptionSession,
} from "@/lib/api/generated/transcription/transcription";
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
  "connect" | "sendAudio" | "sendCommand" | "close"
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

export type LocalRecordingSession = Omit<
  TranscriptionSessionResponseData,
  "status"
> & {
  status:
    | "CONNECTING"
    | "STREAMING"
    | "PAUSED"
    | "FINALIZING"
    | "COMPLETED"
    | "INTERRUPTED"
    | "FAILED"
    | "READY";
};

type ConnectionInfo = {
  socketUrl: string;
  session: StartTranscriptionSessionResponseData;
};

export type RecordingApi = {
  startSession: (noteId: string) => Promise<StartTranscriptionSessionResponseData>;
};

type RecordingContextValue = {
  session: LocalRecordingSession | null;
  transcript: TranscriptState;
  elapsedMs: number;
  level: number;
  levelHistory: number[];
  microphoneState:
    | "idle"
    | "requesting"
    | "ready"
    | "recording"
    | "paused"
    | "denied"
    | "unavailable";
  error: string | null;
  start: (noteId: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
};

const RecordingContext = createContext<RecordingContextValue | null>(null);

function createBrowserAudio(
  onChunk: (chunk: ArrayBuffer) => void,
  onLevel: (level: number) => void
) {
  return new PcmAudioCapture({ onChunk, onLevel });
}

const browserRuntime: RecordingRuntime = {
  createAudio: createBrowserAudio,
  createSocket: (options) => new TranscriptionSocket(options),
};

const ACTIVE_STATUSES = [
  "CONNECTING",
  "STREAMING",
  "PAUSED",
  "FINALIZING",
] as const;

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
  const [session, setSession] = useState<LocalRecordingSession | null>(
    null
  );
  const [transcript, dispatchTranscript] = useReducer(
    transcriptReducer,
    initialTranscriptState
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [levelHistory, setLevelHistory] = useState<number[]>(() =>
    Array(24).fill(0)
  );
  const [microphoneState, setMicrophoneState] =
    useState<RecordingContextValue["microphoneState"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<LocalRecordingSession | null>(null);
  const socketRef = useRef<SocketController | null>(null);
  const audioRef = useRef<AudioController | null>(null);
  const resumePendingRef = useRef(false);
  const stopResolveRef = useRef<(() => void) | null>(null);
  const smoothedLevelRef = useRef(0);

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

  const setCurrentSession = useCallback(
    (next: LocalRecordingSession | null) => {
      sessionRef.current = next;
      setSession(next);
    },
    []
  );

  const api = useMemo<RecordingApi>(
    () =>
      apiOverride ?? {
        startSession: async (noteId) => {
          const response = await startSessionMutation.mutateAsync({
            noteId,
            data: {
              audioFormat: {
                mimeType: "audio/webm;codecs=opus",
                sampleRate: 48000,
                channels: 1,
              },
            },
          });
          if (response.status !== 201) throw new Error("SESSION_CREATE_FAILED");
          if (!response.data.success || !response.data.data) {
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

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      dispatchTranscript(event);

      if (event.type === "SESSION_STATUS") {
        const current = sessionRef.current;
        setElapsedMs(event.recordedDurationMs);
        if (event.status !== "STREAMING") clearLevel();
        if (event.status === "PAUSED") setMicrophoneState("paused");
        if (current)
          setCurrentSession({
            ...current,
            status: event.status,
          });
        if (event.status === "STREAMING" && resumePendingRef.current) {
          resumePendingRef.current = false;
          void audioRef.current
            ?.start()
            .then(() => setMicrophoneState("recording"));
        } else if (event.status === "STREAMING") {
          setMicrophoneState("recording");
        }
      }

      if (event.type === "TRANSCRIPT_FINAL" && sessionRef.current) {
        invalidateTranscriptQueries(sessionRef.current.noteId);
      }

      if (event.type === "SESSION_COMPLETED") {
        const current = sessionRef.current;
        if (current) {
          setCurrentSession({
            ...current,
            status: "COMPLETED",
            endedAt: new Date().toISOString(),
          });
          invalidateTranscriptQueries(current.noteId);
        }
        stopResolveRef.current?.();
        stopResolveRef.current = null;
      }

      if (event.type === "ERROR") setError(event.message);
    },
    [clearLevel, invalidateTranscriptQueries, setCurrentSession]
  );

  const openConnection = useCallback(
    async (
      connection: ConnectionInfo,
      audio: AudioController
    ) => {
      const socket = runtime.createSocket({
        url: connection.socketUrl,
        onEvent: handleEvent,
        onClose: (code, reason) => {
          if (code !== 1000) setError(reason || `WebSocket closed (${code})`);
        },
      });
      socketRef.current = socket;
      await socket.connect();
      await audio.start();
      setMicrophoneState("recording");
    },
    [handleEvent, runtime]
  );

  const start = useCallback(
    async (noteId: string) => {
      if (
        sessionRef.current &&
        ACTIVE_STATUSES.includes(
          sessionRef.current.status as (typeof ACTIVE_STATUSES)[number]
        )
      ) {
        throw new Error("ACTIVE_TRANSCRIPTION_SESSION_EXISTS");
      }
      setError(null);
      const audio = runtime.createAudio(
        (chunk) => socketRef.current?.sendAudio(chunk),
        publishLevel
      );
      audioRef.current = audio;
      try {
        setMicrophoneState("requesting");
        await audio.requestPermission();
        setMicrophoneState("ready");
        const connectionSession = await api.startSession(noteId);
        
        setElapsedMs(0);
        setCurrentSession({
          ...connectionSession,
          status: connectionSession.status as LocalRecordingSession["status"],
        });

        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
        const wsBaseUrl = apiBaseUrl
          ? apiBaseUrl.replace(/^http/, "ws")
          : `${wsProtocol}//${window.location.host}`;
        const socketUrl = `${wsBaseUrl}/v1/transcription-sessions/${connectionSession.sessionId}/stream`;

        await openConnection({ socketUrl, session: connectionSession }, audio);
      } catch (cause) {
        await audio.stop();
        const errorName = cause instanceof DOMException ? cause.name : "";
        setMicrophoneState(
          errorName === "NotAllowedError" ? "denied" : "unavailable"
        );
        setError(
          cause instanceof Error ? cause.message : "녹음을 시작하지 못했습니다."
        );
        throw cause;
      }
    },
    [api, openConnection, publishLevel, runtime, setCurrentSession]
  );

  const pause = useCallback(async () => {
    await audioRef.current?.stop();
    clearLevel();
    setMicrophoneState("paused");
    socketRef.current?.sendCommand({ type: "SESSION_PAUSE" });
  }, [clearLevel]);

  const resume = useCallback(async () => {
    resumePendingRef.current = true;
    setMicrophoneState("ready");
    socketRef.current?.sendCommand({ type: "SESSION_RESUME" });
  }, []);

  const stop = useCallback(async () => {
    await audioRef.current?.stop();
    clearLevel();
    await new Promise<void>((resolve) => {
      stopResolveRef.current = resolve;
      socketRef.current?.sendCommand({ type: "SESSION_COMPLETE" });
    });
  }, [clearLevel]);

  // Purely client-side elapsed timer during STREAMING
  useEffect(() => {
    if (!session || session.status !== "STREAMING") return;
    const timer = window.setInterval(() => {
      setElapsedMs((prev) => prev + 1000);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

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
      transcript,
      elapsedMs,
      level,
      levelHistory,
      microphoneState,
      error,
      start,
      pause,
      resume,
      stop,
    }),
    [
      session,
      transcript,
      elapsedMs,
      level,
      levelHistory,
      microphoneState,
      error,
      start,
      pause,
      resume,
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
