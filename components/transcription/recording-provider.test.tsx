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
  it("keeps one session and socket across child rerenders and pause/resume", async () => {
    const session = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "CONNECTING" as const,
      language: "ko",
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
            onEvent({ type: "SESSION_STATUS", status: "STREAMING" });
          }),
          sendAudio: vi.fn(),
          sendCommand: vi.fn((command) => {
            if (command.type === "SESSION_PAUSE") {
              onEvent({ type: "SESSION_STATUS", status: "PAUSED" });
            }
            if (command.type === "SESSION_RESUME") {
              onEvent({ type: "SESSION_STATUS", status: "STREAMING" });
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

    await act(() => result.current.start(session.noteId, "ko"));
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
