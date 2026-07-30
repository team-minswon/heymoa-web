import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { StartTranscriptionSessionResponseData } from "@/lib/api/generated/models";
import { getGetNoteQueryKey } from "@/lib/api/generated/notes/notes";
import { getGetNoteTranscriptQueryKey } from "@/lib/api/generated/transcription/transcription";
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

function getProjectNotesPredicate(
  invalidate: ReturnType<typeof setup>["invalidate"]
) {
  const filters = invalidate.mock.calls
    .map(([candidate]) => candidate)
    .find((candidate) => candidate && "predicate" in candidate);
  if (!filters || !("predicate" in filters) || !filters.predicate) {
    throw new Error("project note list invalidation was not called");
  }
  return filters.predicate;
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

  it("invalidates the exact note and cached project lists after creating a recording session", async () => {
    const harness = setup();

    await act(() => harness.result.current.start(session.noteId));

    expect(harness.invalidate).toHaveBeenCalledWith({
      queryKey: getGetNoteQueryKey(session.noteId),
    });
    const predicate = getProjectNotesPredicate(harness.invalidate);
    expect(
      predicate({
        queryKey: ["/v1/projects/0HZX2K7M9Q4AA/notes"],
      } as never)
    ).toBe(true);
    expect(
      predicate({ queryKey: getGetNoteQueryKey(session.noteId) } as never)
    ).toBe(false);
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

  it("returns true after terminal reconciliation and invalidates the note, transcript, and cached project lists", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));
    harness.invalidate.mockClear();

    let stopped = false;
    await act(async () => {
      stopped = await harness.result.current.stop();
    });

    expect(stopped).toBe(true);
    expect(harness.controller.stop).toHaveBeenCalledOnce();
    expect(harness.result.current.phase).toBe("completed");
    expect(harness.invalidate).toHaveBeenCalledWith({
      queryKey: getGetNoteQueryKey(session.noteId),
    });
    expect(harness.invalidate).toHaveBeenCalledWith({
      queryKey: getGetNoteTranscriptQueryKey(session.noteId),
    });
    expect(
      getProjectNotesPredicate(harness.invalidate)({
        queryKey: ["/v1/projects/0HZX2K7M9Q4AA/notes"],
      } as never)
    ).toBe(true);
  });

  it("deduplicates concurrent stop calls onto the same terminal result", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));
    let resolveStop!: () => void;
    harness.controller.stop.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveStop = resolve;
        })
    );

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = harness.result.current.stop();
      second = harness.result.current.stop();
    });

    expect(first).toBe(second);
    expect(harness.controller.stop).toHaveBeenCalledOnce();

    await act(async () => {
      harness.getCallbacks().onEvent({
        type: "completed",
        sessionId: session.sessionId,
      });
      resolveStop();
      await first;
    });
    await expect(first).resolves.toBe(true);
  });

  it("cancels a deferred permission request before creating a server session", async () => {
    const harness = setup();
    let resolvePermission!: () => void;
    harness.controller.requestPermission.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolvePermission = resolve;
        })
    );
    let starting!: Promise<void>;
    act(() => {
      starting = harness.result.current.start(session.noteId);
    });
    await waitFor(() =>
      expect(harness.result.current.phase).toBe("requesting-permission")
    );

    let stopped = true;
    await act(async () => {
      stopped = await harness.result.current.stop();
    });
    await act(async () => {
      resolvePermission();
      await starting;
    });

    expect(stopped).toBe(false);
    expect(harness.api.startSession).not.toHaveBeenCalled();
    expect(harness.controller.connect).not.toHaveBeenCalled();
    expect(harness.result.current.phase).toBe("failed");
  });

  it("returns false when stop times out before a terminal session is reconciled", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));
    harness.controller.stop.mockImplementationOnce(async () => {
      harness
        .getCallbacks()
        .onFailure("전사 완료 응답을 기다리는 중 시간이 초과되었습니다.");
    });

    let stopped = true;
    await act(async () => {
      stopped = await harness.result.current.stop();
    });

    expect(stopped).toBe(false);
    expect(harness.result.current.phase).toBe("failed");
  });

  it("clears a settled false stop promise so a later attempt is not deduplicated to it", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));
    harness.controller.stop.mockResolvedValueOnce(undefined);

    let first!: Promise<boolean>;
    await act(async () => {
      first = harness.result.current.stop();
      await first;
    });
    const second = harness.result.current.stop();

    expect(await first).toBe(false);
    expect(second).not.toBe(first);
    await expect(second).resolves.toBe(false);
  });

  it("keeps the failed ACTIVE session polling instead of starting over", async () => {
    const harness = setup({ enablePolling: true });
    await act(() => harness.result.current.start(session.noteId));
    harness.controller.stop.mockImplementationOnce(async () => {
      harness
        .getCallbacks()
        .onFailure("전사 완료 응답을 기다리는 중 시간이 초과되었습니다.");
    });
    await act(() => harness.result.current.stop());

    await act(() => harness.result.current.start(session.noteId));

    expect(harness.api.startSession).toHaveBeenCalledOnce();
    expect(harness.result.current.session?.status).toBe("ACTIVE");
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
  });

  it("keeps a timed-out stop false when delayed cleanup resolves after DB completion", async () => {
    const harness = setup({ enablePolling: true });
    await act(() => harness.result.current.start(session.noteId));
    let resolveStop!: () => void;
    harness.controller.stop.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveStop = resolve;
        })
    );
    let stopping!: Promise<boolean>;
    act(() => {
      stopping = harness.result.current.stop();
      harness
        .getCallbacks()
        .onFailure("전사 완료 응답을 기다리는 중 시간이 초과되었습니다.");
    });
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

    await act(async () => {
      resolveStop();
      await stopping;
    });

    await expect(stopping).resolves.toBe(false);
  });

  it("keeps the local controller until a polled completion settles stop successfully", async () => {
    const harness = setup({ enablePolling: true });
    await act(() => harness.result.current.start(session.noteId));
    let resolveStop!: () => void;
    harness.controller.stop.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveStop = resolve;
        })
    );
    let stopping!: Promise<boolean>;
    act(() => {
      stopping = harness.result.current.stop();
    });
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

    await act(async () => {
      resolveStop();
      await stopping;
    });

    await expect(stopping).resolves.toBe(true);
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
    expect(harness.result.current.transcript.partial).toBeNull();
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

  it("keeps the server-sent failure message verbatim", async () => {
    // 계약(asyncapi)의 error.message가 사용자에게 보일 한국어 문구의 원본이다.
    // web이 코드별로 다시 쓰면 서버가 바뀔 때마다 갈라진다 — rule error-loading.
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));

    act(() =>
      harness.getCallbacks().onEvent({
        type: "error",
        code: "STT_TRANSCRIPTION_FAILED",
        message: "실시간 전사 처리에 실패했습니다.",
      })
    );

    expect(harness.result.current.error).toBe(
      "실시간 전사 처리에 실패했습니다."
    );
  });

  it("does not remain stuck in stopping when cleanup fails", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId));
    harness.controller.stop.mockRejectedValueOnce(new Error("cleanup"));

    let stopped = true;
    await act(async () => {
      stopped = await harness.result.current.stop();
    });

    expect(stopped).toBe(false);
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

    expect(harness.result.current.transcript.partial).toBeNull();
    expect(harness.result.current.transcript.completed).toBe(false);
  });

  it("reconciles a missed terminal event from polling and allows the note to resume", async () => {
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
    expect(harness.result.current.transcript.partial).toBeNull();
    expect(harness.result.current.transcript.completed).toBe(true);

    await act(() => harness.result.current.start(session.noteId));

    expect(harness.api.startSession).toHaveBeenCalledTimes(2);
    expect(harness.result.current.phase).toBe("recording");
  });

  it("invalidates lifecycle caches when failed-session polling finds an interruption", async () => {
    const harness = setup({ enablePolling: true });
    harness.controller.connect.mockRejectedValueOnce(
      new Error("WEBSOCKET_CLOSED")
    );
    await act(() => harness.result.current.start(session.noteId));
    harness.invalidate.mockClear();
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
    expect(harness.invalidate).toHaveBeenCalledWith({
      queryKey: getGetNoteQueryKey(session.noteId),
    });
    expect(harness.invalidate).toHaveBeenCalledWith({
      queryKey: getGetNoteTranscriptQueryKey(session.noteId),
    });
    expect(
      getProjectNotesPredicate(harness.invalidate)({
        queryKey: ["/v1/projects/0HZX2K7M9Q4AA/notes"],
      } as never)
    ).toBe(true);
  });
});
