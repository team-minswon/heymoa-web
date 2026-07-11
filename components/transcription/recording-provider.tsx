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
  TranscriptionConnectionResponse,
  TranscriptionSessionResponse,
} from "@/lib/api/generated/models";
import {
  getGetActiveTranscriptionSessionQueryKey,
  getListNoteTranscriptSegmentsQueryKey,
  getListNoteTranscriptionSessionsQueryKey,
  useCreateTranscriptionConnectionTicket,
  useCreateTranscriptionSession,
  useGetActiveTranscriptionSession,
} from "@/lib/api/generated/transcription/transcription";
import { unwrapGeneratedAppResponse } from "@/lib/api/app-response";
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
  createAudio: (onChunk: (chunk: ArrayBuffer) => void) => AudioController;
  createSocket: (options: {
    url: string;
    onEvent: (event: ServerEvent) => void;
    onClose: (code: number, reason: string) => void;
  }) => SocketController;
};

export type RecordingApi = {
  createSession: (
    noteId: string,
    language: string | null
  ) => Promise<TranscriptionConnectionResponse>;
  createTicket: (sessionId: string) => Promise<TranscriptionConnectionResponse>;
};

type RecordingContextValue = {
  session: TranscriptionSessionResponse | null;
  transcript: TranscriptState;
  elapsedMs: number;
  error: string | null;
  start: (noteId: string, language: string | null) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
};

const RecordingContext = createContext<RecordingContextValue | null>(null);

function createBrowserAudio(onChunk: (chunk: ArrayBuffer) => void) {
  if (process.env.NEXT_PUBLIC_API_MOCKING === "enabled") {
    let timer: number | null = null;
    return {
      requestPermission: async () => undefined,
      start: async () => {
        timer ??= window.setInterval(() => onChunk(new ArrayBuffer(3840)), 350);
      },
      stop: async () => {
        if (timer !== null) window.clearInterval(timer);
        timer = null;
      },
    } satisfies AudioController;
  }
  return new PcmAudioCapture({ onChunk });
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
  const createSessionMutation = useCreateTranscriptionSession();
  const createTicketMutation = useCreateTranscriptionConnectionTicket();
  const activeQuery = useGetActiveTranscriptionSession({
    query: { enabled: apiOverride === undefined, retry: false },
  });
  const [session, setSession] = useState<TranscriptionSessionResponse | null>(
    null
  );
  const [transcript, dispatchTranscript] = useReducer(
    transcriptReducer,
    initialTranscriptState
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const elapsedOriginRef = useRef<number | null>(null);
  const sessionRef = useRef<TranscriptionSessionResponse | null>(null);
  const socketRef = useRef<SocketController | null>(null);
  const audioRef = useRef<AudioController | null>(null);
  const resumePendingRef = useRef(false);
  const rehydratingRef = useRef(false);
  const stopResolveRef = useRef<(() => void) | null>(null);

  const setCurrentSession = useCallback(
    (next: TranscriptionSessionResponse | null) => {
      sessionRef.current = next;
      setSession(next);
    },
    []
  );

  const api = useMemo<RecordingApi>(
    () =>
      apiOverride ?? {
        createSession: async (noteId, language) => {
          const response = await createSessionMutation.mutateAsync({
            noteId,
            data: { language },
          });
          if (response.status !== 200) throw new Error("SESSION_CREATE_FAILED");
          return unwrapGeneratedAppResponse<TranscriptionConnectionResponse>(
            response
          );
        },
        createTicket: async (sessionId) => {
          const response = await createTicketMutation.mutateAsync({
            sessionId,
          });
          if (response.status !== 200) throw new Error("TICKET_CREATE_FAILED");
          return unwrapGeneratedAppResponse<TranscriptionConnectionResponse>(
            response
          );
        },
      },
    [apiOverride, createSessionMutation, createTicketMutation]
  );

  const invalidateTranscriptQueries = useCallback(
    (noteId: string) => {
      void queryClient.invalidateQueries({
        queryKey: getListNoteTranscriptionSessionsQueryKey(noteId),
      });
      void queryClient.invalidateQueries({
        queryKey: getListNoteTranscriptSegmentsQueryKey(noteId),
      });
      void queryClient.invalidateQueries({
        queryKey: getGetActiveTranscriptionSessionQueryKey(),
      });
    },
    [queryClient]
  );

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      dispatchTranscript(event);

      if (event.type === "SESSION_STATUS") {
        const current = sessionRef.current;
        if (current) setCurrentSession({ ...current, status: event.status });
        if (event.status === "STREAMING" && resumePendingRef.current) {
          resumePendingRef.current = false;
          void audioRef.current?.start();
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
    [invalidateTranscriptQueries, setCurrentSession]
  );

  const openConnection = useCallback(
    async (
      connection: TranscriptionConnectionResponse,
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
    },
    [handleEvent, runtime]
  );

  const start = useCallback(
    async (noteId: string, language: string | null) => {
      if (
        sessionRef.current &&
        ACTIVE_STATUSES.includes(
          sessionRef.current.status as (typeof ACTIVE_STATUSES)[number]
        )
      ) {
        throw new Error("ACTIVE_TRANSCRIPTION_SESSION_EXISTS");
      }
      setError(null);
      const audio = runtime.createAudio((chunk) =>
        socketRef.current?.sendAudio(chunk)
      );
      audioRef.current = audio;
      try {
        await audio.requestPermission();
        const connection = await api.createSession(noteId, language);
        elapsedOriginRef.current = Date.now();
        setCurrentSession(connection.session);
        await openConnection(connection, audio);
      } catch (cause) {
        await audio.stop();
        setError(
          cause instanceof Error ? cause.message : "녹음을 시작하지 못했습니다."
        );
        throw cause;
      }
    },
    [api, openConnection, runtime, setCurrentSession]
  );

  const pause = useCallback(async () => {
    await audioRef.current?.stop();
    socketRef.current?.sendCommand({ type: "SESSION_PAUSE" });
  }, []);

  const resume = useCallback(async () => {
    resumePendingRef.current = true;
    socketRef.current?.sendCommand({ type: "SESSION_RESUME" });
  }, []);

  const stop = useCallback(async () => {
    await audioRef.current?.stop();
    await new Promise<void>((resolve) => {
      stopResolveRef.current = resolve;
      socketRef.current?.sendCommand({ type: "SESSION_COMPLETE" });
    });
  }, []);

  useEffect(() => {
    const envelope =
      activeQuery.data?.status === 200 ? activeQuery.data.data : undefined;
    const activeSession = envelope?.success ? envelope.data?.session : null;
    if (!activeSession || sessionRef.current || rehydratingRef.current) return;

    rehydratingRef.current = true;
    const reconnect = async () => {
      const audio = runtime.createAudio((chunk) =>
        socketRef.current?.sendAudio(chunk)
      );
      audioRef.current = audio;
      await audio.requestPermission();
      elapsedOriginRef.current = Date.parse(activeSession.startedAt);
      setCurrentSession(activeSession);
      const connection = await api.createTicket(activeSession.sessionId);
      await openConnection(connection, audio);
    };
    void reconnect()
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "재연결하지 못했습니다."
        )
      )
      .finally(() => {
        rehydratingRef.current = false;
      });
  }, [activeQuery.data, api, openConnection, runtime, setCurrentSession]);

  useEffect(() => {
    if (!session || !["STREAMING", "PAUSED"].includes(session.status)) return;
    const origin = elapsedOriginRef.current ?? Date.parse(session.startedAt);
    const updateElapsed = () => setElapsedMs(Math.max(0, Date.now() - origin));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
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
      error,
      start,
      pause,
      resume,
      stop,
    }),
    [session, transcript, elapsedMs, error, start, pause, resume, stop]
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
