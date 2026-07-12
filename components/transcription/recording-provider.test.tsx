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

describe("RecordingProvider", () => {
  it("builds a recent microphone level history and clears it on pause", async () => {
    const session = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "CONNECTING" as const,
      recordedDurationMs: 0,
      startedBy: { userId: "01K0000000003", name: "테스트 유저" },
      startedAt: "2026-07-11T00:00:00Z",
      endedAt: null,
    };
    let publishLevel!: (level: number) => void;
    let emit!: Parameters<RecordingRuntime["createSocket"]>[0]["onEvent"];
    const runtime: RecordingRuntime = {
      createAudio: (_onChunk, onLevel) => {
        publishLevel = onLevel;
        return {
          requestPermission: vi.fn(async () => undefined),
          start: vi.fn(async () => undefined),
          stop: vi.fn(async () => undefined),
        };
      },
      createSocket: (options) => {
        emit = options.onEvent;
        return {
          connect: vi.fn(async () => undefined),
          sendAudio: vi.fn(),
          sendCommand: vi.fn(),
          close: vi.fn(),
        };
      },
    };
    const api: RecordingApi = {
      createSession: vi.fn(async () => ({
        session,
        socketUrl: "ws://localhost/stream?ticket=test",
        ticketExpiresAt: "2026-07-11T00:01:00Z",
      })),
      createTicket: vi.fn(),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>
        <RecordingProvider api={api} runtime={runtime}>
          {children}
        </RecordingProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useRecording(), { wrapper });

    await act(() => result.current.start(session.noteId));
    act(() =>
      emit({
        type: "SESSION_STATUS",
        status: "STREAMING",
        recordedDurationMs: 0,
      })
    );
    act(() => publishLevel(0.6));
    expect(result.current.levelHistory.at(-1)).toBeGreaterThan(0);

    await act(() => result.current.pause());
    expect(result.current.levelHistory.every((value) => value === 0)).toBe(
      true
    );
  });

  it("freezes elapsed time while paused and resumes from accumulated duration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const session = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "CONNECTING" as const,
      recordedDurationMs: 0,
      startedBy: { userId: "01K0000000003", name: "테스트 유저" },
      startedAt: "2026-07-11T00:00:00Z",
      endedAt: null,
    };
    const api: RecordingApi = {
      createSession: vi.fn(async () => ({
        session,
        socketUrl: "ws://localhost/stream?ticket=test",
        ticketExpiresAt: "2026-07-11T00:01:00Z",
      })),
      createTicket: vi.fn(),
    };
    let emit!: Parameters<RecordingRuntime["createSocket"]>[0]["onEvent"];
    const runtime: RecordingRuntime = {
      createAudio: () => ({
        requestPermission: vi.fn(async () => undefined),
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
      }),
      createSocket: (options) => {
        emit = options.onEvent;
        return {
          connect: vi.fn(async () => undefined),
          sendAudio: vi.fn(),
          sendCommand: vi.fn(),
          close: vi.fn(),
        };
      },
    };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <RecordingProvider api={api} runtime={runtime}>
          {children}
        </RecordingProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useRecording(), { wrapper });

    await act(() => result.current.start(session.noteId));
    act(() => {
      emit({
        type: "SESSION_STATUS",
        status: "STREAMING",
        recordedDurationMs: 0,
      });
      vi.advanceTimersByTime(3_000);
    });
    act(() =>
      emit({
        type: "SESSION_STATUS",
        status: "PAUSED",
        recordedDurationMs: 3_000,
      })
    );
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.elapsedMs).toBe(3_000);

    act(() =>
      emit({
        type: "SESSION_STATUS",
        status: "STREAMING",
        recordedDurationMs: 3_000,
      })
    );
    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current.elapsedMs).toBe(5_000);
    vi.useRealTimers();
  });

  it("keeps one session and socket across child rerenders and pause/resume", async () => {
    const session = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "CONNECTING" as const,
      recordedDurationMs: 0,
      startedBy: { userId: "01K0000000003", name: "테스트 유저" },
      startedAt: "2026-07-11T00:00:00Z",
      endedAt: null,
    };
    const api: RecordingApi = {
      createSession: vi.fn(async () => ({
        session,
        socketUrl: "ws://localhost/stream?ticket=test",
        ticketExpiresAt: "2026-07-11T00:01:00Z",
      })),
      createTicket: vi.fn(),
    };
    let onEvent: Parameters<RecordingRuntime["createSocket"]>[0]["onEvent"];
    const runtime: RecordingRuntime = {
      createAudio: vi.fn(() => ({
        requestPermission: vi.fn(async () => undefined),
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
      })),
      createSocket: vi.fn((options) => {
        onEvent = options.onEvent;
        return {
          connect: vi.fn(async () => {
            onEvent({ type: "SESSION_READY", sessionId: session.sessionId });
            onEvent({
              type: "SESSION_STATUS",
              status: "STREAMING",
              recordedDurationMs: 0,
            });
          }),
          sendAudio: vi.fn(),
          sendCommand: vi.fn((command) => {
            if (command.type === "SESSION_PAUSE") {
              onEvent({
                type: "SESSION_STATUS",
                status: "PAUSED",
                recordedDurationMs: 0,
              });
            }
            if (command.type === "SESSION_RESUME") {
              onEvent({
                type: "SESSION_STATUS",
                status: "STREAMING",
                recordedDurationMs: 0,
              });
            }
            if (command.type === "SESSION_COMPLETE") {
              onEvent({
                type: "SESSION_COMPLETED",
                sessionId: session.sessionId,
              });
            }
          }),
          close: vi.fn(),
        };
      }),
    };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <RecordingProvider api={api} runtime={runtime}>
          {children}
        </RecordingProvider>
      </QueryClientProvider>
    );
    const { result, rerender } = renderHook(() => useRecording(), { wrapper });

    await act(() => result.current.start(session.noteId));
    rerender();
    expect(result.current.session?.sessionId).toBe("01K0000000010");
    expect(result.current.elapsedMs).toBeLessThan(1000);
    await act(() => result.current.pause());
    await act(() => result.current.resume());
    expect(result.current.session?.sessionId).toBe("01K0000000010");
    await act(() => result.current.stop());
    expect(result.current.session?.status).toBe("COMPLETED");
    expect(runtime.createSocket).toHaveBeenCalledTimes(1);
  });
});
