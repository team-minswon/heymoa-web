import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  RecordingProvider,
  type RecordingApi,
  type RecordingRuntime,
  useRecording,
} from "@/components/transcription/recording-provider";

const session = {
  sessionId: "0HZX2K7M9Q4AG",
  noteId: "0HZX2K7M9Q4AF",
  status: "READY" as const,
  readyExpiresAt: "2026-07-15T00:01:00Z",
  startedAt: null,
  endedAt: null,
  endReason: null,
};

function setup() {
  const order: string[] = [];
  const audio = {
    requestPermission: vi.fn(async () => {
      order.push("permission");
    }),
    start: vi.fn(async () => {
      order.push("audio-start");
    }),
    stop: vi.fn(async () => {
      order.push("audio-stop");
    }),
  };
  const socket = {
    connect: vi.fn(async () => {
      order.push("socket-connect");
      callbacks.onEvent({
        type: "connected",
        sessionId: session.sessionId,
      });
    }),
    sendAudio: vi.fn(),
    commit: vi.fn(() => order.push("commit")),
    stop: vi.fn(() => {
      order.push("socket-stop");
      callbacks.onEvent({
        type: "completed",
        sessionId: session.sessionId,
      });
    }),
    close: vi.fn(() => order.push("socket-close")),
  };
  let callbacks!: Parameters<RecordingRuntime["createSocket"]>[0];
  const runtime: RecordingRuntime = {
    createAudio: vi.fn(() => audio),
    createSocket: vi.fn((options) => {
      callbacks = options;
      return socket;
    }),
  };
  const api: RecordingApi = {
    startSession: vi.fn(async () => session),
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <RecordingProvider api={api} runtime={runtime}>
        {children}
      </RecordingProvider>
    </QueryClientProvider>
  );

  return {
    ...renderHook(() => useRecording(), { wrapper }),
    api,
    runtime,
    audio,
    socket,
    order,
    invalidate,
    getCallbacks: () => callbacks,
  };
}

describe("RecordingProvider", () => {
  it("starts a bodyless session and records only after connected", async () => {
    const harness = setup();

    await act(() => harness.result.current.start(session.noteId));

    expect(harness.api.startSession).toHaveBeenCalledWith(session.noteId);
    expect(harness.runtime.createSocket).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining(
          `/ws/transcription-sessions/${session.sessionId}`
        ),
      })
    );
    expect(harness.order).toEqual([
      "permission",
      "socket-connect",
      "audio-start",
    ]);
    expect(harness.result.current.phase).toBe("recording");
  });

  it("commits the current utterance", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));

    act(() => harness.result.current.commit());

    expect(harness.socket.commit).toHaveBeenCalledOnce();
  });

  it("stops audio before the socket and invalidates persisted transcript", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));

    await act(() => harness.result.current.stop());

    expect(harness.order.slice(-3)).toEqual([
      "audio-stop",
      "socket-stop",
      "socket-close",
    ]);
    expect(harness.result.current.phase).toBe("completed");
    expect(harness.invalidate).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [expect.stringContaining(session.noteId)],
      })
    );
  });

  it("fails and cleans audio after an internal WebSocket close", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));

    await act(async () => {
      harness.getCallbacks().onClose(1011, "upstream failed");
      await Promise.resolve();
    });

    expect(harness.result.current.phase).toBe("failed");
    expect(harness.result.current.error).toBe("upstream failed");
    expect(harness.audio.stop).toHaveBeenCalled();
  });
});
