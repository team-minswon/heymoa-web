import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { StartTranscriptionSessionResponseData } from "@/lib/api/generated/models";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RecordingProvider,
  type RecordingApi,
  type RecordingRuntime,
  useRecording,
  useRecordingTranscript,
} from "@/components/transcription/recording-provider";

type SessionQueryMock = {
  data:
    | {
        status: 200;
        data: {
          success: true;
          data: typeof session;
        };
      }
    | undefined;
  isFetching: boolean;
  dataUpdatedAt: number;
};

const sessionQuery = vi.hoisted(() => ({
  current: {
    data: undefined,
    isFetching: false,
    dataUpdatedAt: 0,
  } as SessionQueryMock,
}));

vi.mock(
  "@/lib/api/generated/transcription/transcription",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/lib/api/generated/transcription/transcription")
    >()),
    useGetTranscriptionSession: () => sessionQuery.current,
  })
);

const session: StartTranscriptionSessionResponseData = {
  sessionId: "0HZX2K7M9Q4AG",
  noteId: "0HZX2K7M9Q4AF",
  status: "READY",
  readyExpiresAt: "2099-07-15T00:01:00Z",
  startedAt: null,
  endedAt: null,
  endReason: null,
};

function setup({ enablePolling = false } = {}) {
  sessionQuery.current = {
    data: undefined,
    isFetching: false,
    dataUpdatedAt: 0,
  };
  const order: string[] = [];
  let callbacks!: Parameters<RecordingRuntime["createSession"]>[0];
  const controller = {
    requestPermission: vi.fn(async () => {
      order.push("permission");
    }),
    connect: vi.fn(async () => {
      order.push("realtime-connect");
      callbacks.onEvent({ type: "connected", sessionId: session.sessionId });
    }),
    commit: vi.fn(() => order.push("commit")),
    stop: vi.fn(async () => {
      order.push("realtime-stop");
      callbacks.onEvent({ type: "completed", sessionId: session.sessionId });
    }),
    reconcile: vi.fn(),
    close: vi.fn(async () => {
      order.push("realtime-close");
    }),
  };
  const runtime: RecordingRuntime = {
    createSession: vi.fn((options) => {
      callbacks = options;
      return controller;
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
      <RecordingProvider
        api={api}
        runtime={runtime}
        enablePolling={enablePolling}
      >
        {children}
      </RecordingProvider>
    </QueryClientProvider>
  );

  return {
    ...renderHook(
      () => ({
        ...useRecording(),
        transcript: useRecordingTranscript(),
      }),
      { wrapper }
    ),
    api,
    runtime,
    controller,
    order,
    invalidate,
    getCallbacks: () => callbacks,
  };
}

describe("RecordingProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requests permission before creating and connecting the server session", async () => {
    const harness = setup();

    await act(() => harness.result.current.start(session.noteId));

    expect(harness.api.startSession).toHaveBeenCalledWith(session.noteId);
    expect(harness.runtime.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("/ws/transcriptions"),
      })
    );
    expect(harness.controller.connect).toHaveBeenCalledWith(session.sessionId);
    expect(harness.order).toEqual(["permission", "realtime-connect"]);
    expect(harness.result.current.phase).toBe("recording");
  });

  it("uses the browser origin for mocked STOMP", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MOCKING", "enabled");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://api.example.test:8080");
    const harness = setup();

    await act(() => harness.result.current.start(session.noteId));

    const options = vi.mocked(harness.runtime.createSession).mock.calls[0][0];
    const url = new URL(options.url);
    expect(url.protocol).toBe("ws:");
    expect(url.host).toBe(window.location.host);
  });

  it("keeps an initial realtime failure recoverable", async () => {
    const harness = setup();
    harness.controller.connect.mockRejectedValueOnce(
      new Error("WEBSOCKET_CLOSED")
    );

    await act(() => harness.result.current.start(session.noteId));

    expect(harness.result.current.phase).toBe("failed");
    expect(harness.result.current.error).toBe(
      "실시간 전사 서버에 연결하지 못했습니다. 로그인 상태와 서버 연결을 확인해 주세요."
    );
    expect(harness.controller.close).toHaveBeenCalled();
  });

  it("reuses a non-expired READY session after an initial transport failure", async () => {
    const harness = setup();
    harness.controller.connect.mockRejectedValueOnce(
      new Error("WEBSOCKET_CLOSED")
    );
    await act(() => harness.result.current.start(session.noteId));

    await act(() => harness.result.current.start(session.noteId));

    expect(harness.api.startSession).toHaveBeenCalledOnce();
    expect(harness.controller.connect).toHaveBeenCalledTimes(2);
    expect(harness.result.current.phase).toBe("recording");
  });

  it("stops the session and invalidates persisted transcript", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));

    await act(() => harness.result.current.stop());

    expect(harness.controller.stop).toHaveBeenCalledOnce();
    expect(harness.result.current.phase).toBe("completed");
    expect(harness.invalidate).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [expect.stringContaining(session.noteId)],
      })
    );
    expect(harness.invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ predicate: expect.any(Function) })
    );
  });

  it("disconnects microphone and socket immediately for logout", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));
    act(() =>
      harness.getCallbacks().onEvent({
        type: "partial",
        utteranceId: "0HZX2K7M9Q4AC",
        text: "로그아웃 전 전사",
      })
    );

    await act(() => harness.result.current.disconnect());

    expect(harness.controller.close).toHaveBeenCalledOnce();
    expect(harness.controller.stop).not.toHaveBeenCalled();
    expect(harness.result.current.phase).toBe("idle");
    expect(harness.result.current.session).toBeNull();
    expect(harness.result.current.activeNoteId).toBeNull();
    expect(harness.result.current.transcript.partialByUtteranceId).toEqual({});
  });

  it("fails and closes after a realtime transport error", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));

    await act(async () => {
      harness.getCallbacks().onFailure("upstream failed");
      await Promise.resolve();
    });

    expect(harness.result.current.phase).toBe("failed");
    expect(harness.result.current.error).toBe(
      "실시간 전사 연결이 중단되었습니다. 잠시 후 다시 시도해 주세요."
    );
    expect(harness.controller.close).toHaveBeenCalled();
  });

  it("maps provider errors to a user-safe product message", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));

    act(() =>
      harness.getCallbacks().onEvent({
        type: "error",
        code: "STT_TRANSCRIPTION_FAILED",
        message: "provider_internal_drain_state=completed",
      })
    );

    expect(harness.result.current.error).toBe(
      "음성을 기록하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
    );
    expect(harness.result.current.error).not.toContain("provider_internal");
  });

  it("does not remain stuck in stopping when cleanup fails", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));
    harness.controller.stop.mockRejectedValueOnce(new Error("cleanup"));

    await act(() => harness.result.current.stop());

    expect(harness.result.current.phase).toBe("failed");
    expect(harness.result.current.error).toContain("종료하는 중 오류");
  });

  it("resets live transcript when a new recording starts", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));
    act(() =>
      harness.getCallbacks().onEvent({
        type: "partial",
        utteranceId: "0HZX2K7M9Q4AC",
        text: "이전 전사",
      })
    );
    await act(() => harness.result.current.stop());

    await act(() => harness.result.current.start(session.noteId));

    expect(harness.result.current.transcript.partialByUtteranceId).toEqual({});
    expect(harness.result.current.transcript.completed).toBe(false);
  });

  it("reconciles a missed WebSocket terminal event from the polled DB state", async () => {
    const harness = setup({ enablePolling: true });
    await act(() => harness.result.current.start(session.noteId));
    act(() =>
      harness.getCallbacks().onEvent({
        type: "partial",
        utteranceId: "0HZX2K7M9Q4AC",
        text: "완료 전에 수신한 문장",
      })
    );
    sessionQuery.current = {
      data: {
        status: 200,
        data: {
          success: true,
          data: {
            ...session,
            status: "COMPLETED",
            endedAt: "2026-07-15T00:02:00Z",
          },
        },
      },
      isFetching: false,
      dataUpdatedAt: Date.now(),
    };

    harness.rerender();

    await waitFor(() => expect(harness.result.current.phase).toBe("completed"));
    expect(harness.controller.reconcile).toHaveBeenCalledWith("COMPLETED");
    expect(harness.result.current.transcript.partialByUtteranceId).toEqual({});
    expect(harness.result.current.transcript.completed).toBe(true);
  });

  it("updates a failed local READY session from the interrupted DB state", async () => {
    const harness = setup({ enablePolling: true });
    harness.controller.connect.mockRejectedValueOnce(
      new Error("WEBSOCKET_CLOSED")
    );
    await act(() => harness.result.current.start(session.noteId));
    sessionQuery.current = {
      data: {
        status: 200,
        data: {
          success: true,
          data: {
            ...session,
            status: "INTERRUPTED",
            endedAt: "2026-07-15T00:02:00Z",
            endReason: "CLIENT_DISCONNECTED",
          },
        },
      },
      isFetching: false,
      dataUpdatedAt: Date.now(),
    };

    harness.rerender();

    await waitFor(() =>
      expect(harness.result.current.session?.status).toBe("INTERRUPTED")
    );
  });
});
