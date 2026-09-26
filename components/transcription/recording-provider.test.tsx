import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { StartTranscriptionSessionResponseData } from "@/lib/api/generated/models";
import { getGetNoteQueryKey } from "@/lib/api/generated/notes/notes";
import { getGetWorkspacesQueryKey } from "@/lib/api/generated/workspaces/workspaces";
import { getGetNoteTranscriptQueryKey } from "@/lib/api/generated/transcription/transcription";
import type { StoredRecording } from "@/lib/transcription/audio-store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isWorkspaceRecordingActive,
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
  error?: unknown;
  failureReason?: unknown;
};

const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ui/toast", () => ({
  toast: { error: toastError, success: vi.fn(), dismiss: vi.fn() },
}));

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

/** 녹음이 시작된 워크스페이스. 계약이 안 알려줘서 `start()`가 받아 들고 있어야 하는 값이다. */
const WORKSPACE_ID = "0HZX2K7M9Q4AW";
const OTHER_WORKSPACE_ID = "0HZX2K7M9Q4AX";

function setup({
  enablePolling = false,
  stored,
}: { enablePolling?: boolean; stored?: StoredRecording[] } = {}) {
  sessionQuery.current = {
    data: undefined,
    isFetching: false,
    dataUpdatedAt: 0,
    error: null,
    failureReason: null,
  };
  const order: string[] = [];
  let callbacks!: Parameters<RecordingRuntime["createSession"]>[0];
  const controller = {
    requestPermission: vi.fn(async () => {
      order.push("permission");
    }),
    connect: vi.fn(async () => {
      order.push("realtime-connect");
      callbacks.onEvent({
        type: "connected",
        sessionId: session.sessionId,
        epoch: 1,
        durableThroughSeq: -1,
      });
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
    resume: vi.fn(async () => {
      order.push("resume");
    }),
  };
  const runtime: RecordingRuntime = {
    createSession: vi.fn((options) => {
      callbacks = options;
      return controller;
    }),
    ...(stored ? { findStoredRecordings: vi.fn(async () => stored) } : {}),
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

    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

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

    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

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

    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

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

    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    expect(harness.result.current.phase).toBe("failed");
    expect(harness.result.current.error).toBe(
      "실시간 스크립트 서버에 연결하지 못했습니다. 로그인 상태와 서버 연결을 확인해 주세요."
    );
    expect(harness.controller.close).toHaveBeenCalled();
  });

  it("reuses a non-expired READY session after an initial transport failure", async () => {
    const harness = setup();
    harness.controller.connect.mockRejectedValueOnce(
      new Error("WEBSOCKET_CLOSED")
    );
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    expect(harness.api.startSession).toHaveBeenCalledOnce();
    expect(harness.controller.connect).toHaveBeenCalledTimes(2);
    expect(harness.result.current.phase).toBe("recording");
  });

  it("returns true after terminal reconciliation and invalidates the note, transcript, and cached project lists", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
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
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
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

  it("surfaces a degraded transcription and clears it on recovery", async () => {
    // 소리는 쌓이는데 글자만 멈춘 상태. 서버만 아는 사실이라 이벤트로만 들어온다.
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    await act(async () => {
      harness
        .getCallbacks()
        .onEvent({ type: "capture_state", state: "DEGRADED" });
    });
    expect(harness.result.current.transcriptionDegraded).toBe(true);

    await act(async () => {
      harness.getCallbacks().onEvent({ type: "capture_state", state: "LIVE" });
    });
    expect(harness.result.current.transcriptionDegraded).toBe(false);
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
      starting = harness.result.current.start(session.noteId, WORKSPACE_ID);
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
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
    harness.controller.stop.mockImplementationOnce(async () => {
      harness
        .getCallbacks()
        .onFailure("스크립트 완료 응답을 기다리는 중 시간이 초과되었습니다.");
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
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
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
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
    harness.controller.stop.mockImplementationOnce(async () => {
      harness
        .getCallbacks()
        .onFailure("스크립트 완료 응답을 기다리는 중 시간이 초과되었습니다.");
    });
    await act(() => harness.result.current.stop());

    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

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
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
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
        .onFailure("스크립트 완료 응답을 기다리는 중 시간이 초과되었습니다.");
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
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
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
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
    act(() =>
      harness.getCallbacks().onEvent({
        type: "partial",
        utteranceId: "0HZX2K7M9Q4AC",
        confirmedText: "로그아웃 전",
        pendingText: " 전사",
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
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    await act(async () => {
      harness.getCallbacks().onFailure("upstream failed");
      await Promise.resolve();
    });

    expect(harness.result.current.phase).toBe("failed");
    expect(harness.result.current.error).toBe(
      "실시간 스크립트 연결이 중단되었습니다. 잠시 후 다시 시도해 주세요."
    );
    expect(harness.controller.close).toHaveBeenCalled();
  });

  it("keeps the server-sent failure message verbatim", async () => {
    // 계약(asyncapi)의 error.message가 사용자에게 보일 한국어 문구의 원본이다.
    // web이 코드별로 다시 쓰면 서버가 바뀔 때마다 갈라진다 — rule error-loading.
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    act(() =>
      harness.getCallbacks().onEvent({
        type: "error",
        code: "SESSION_NOT_CONNECTABLE",
        message: "다른 기기에서 이 녹음을 진행 중입니다.",
      })
    );
    // 컨트롤러도 같은 사건으로 onFailure 를 부른다. 서버 문구를 덮으면 안 된다.
    act(() =>
      harness.getCallbacks().onFailure("다른 기기에서 이 녹음을 진행 중입니다.")
    );

    expect(harness.result.current.error).toBe(
      "다른 기기에서 이 녹음을 진행 중입니다."
    );
  });

  // 업체 장애·서버 내부 오류는 같은 세션에 다시 붙으면 풀린다. 컨트롤러가 다시 붙는다.
  it("does not fail on a retryable in-band error", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    act(() =>
      harness.getCallbacks().onEvent({
        type: "error",
        code: "STT_TRANSCRIPTION_FAILED",
        message: "실시간 스크립트 처리에 실패했습니다.",
      })
    );

    expect(harness.result.current.phase).toBe("recording");
    expect(harness.result.current.error).toBeNull();
  });

  it("does not remain stuck in stopping when cleanup fails", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
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
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
    act(() =>
      harness.getCallbacks().onEvent({
        type: "partial",
        utteranceId: "0HZX2K7M9Q4AC",
        confirmedText: "이전",
        pendingText: " 전사",
      })
    );
    await act(() => harness.result.current.stop());

    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    expect(harness.result.current.transcript.partial).toBeNull();
    expect(harness.result.current.transcript.completed).toBe(false);
  });

  it("reconciles a missed terminal event from polling and allows the note to resume", async () => {
    const harness = setup({ enablePolling: true });
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
    act(() =>
      harness.getCallbacks().onEvent({
        type: "partial",
        utteranceId: "0HZX2K7M9Q4AC",
        confirmedText: "완료 전에 수신한",
        pendingText: " 문장",
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

    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    expect(harness.api.startSession).toHaveBeenCalledTimes(2);
    expect(harness.result.current.phase).toBe("recording");
  });

  it("invalidates lifecycle caches when failed-session polling finds an interruption", async () => {
    const harness = setup({ enablePolling: true });
    harness.controller.connect.mockRejectedValueOnce(
      new Error("WEBSOCKET_CLOSED")
    );
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
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

  it("★ 남이 회의를 끝낸 것을 장애로 말하지 않는다", async () => {
    // 권한이 「시작자만」에서 「멤버 누구나」로 열리면서(APP-685) 자주 일어나게 됐다.
    // 전에는 `MEETING_ENDED` 가 기본 문구로 떨어져 「서버에서 스크립트 세션이 중단되었습니다」로
    // 보였다 — 정상적으로 끝난 회의가 녹음하던 사람에게는 장애로 읽힌다.
    // **정상적으로 녹음 중이어야 한다.** 이미 failed 면 재조정이 통째로 건너뛰어져서
    // 이 문구가 나올 자리 자체가 없다.
    const harness = setup({ enablePolling: true });
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
    expect(harness.result.current.phase).toBe("recording");
    sessionQuery.current = {
      data: {
        status: 200,
        data: {
          success: true,
          data: {
            ...session,
            status: "INTERRUPTED",
            endedAt: "2026-07-15T00:02:00Z",
            endReason: "MEETING_ENDED",
          },
        },
      },
      isFetching: false,
      dataUpdatedAt: Date.now(),
    };

    harness.rerender();

    await waitFor(() =>
      expect(harness.result.current.error).toBe(
        "회의가 종료되어 기록을 마쳤습니다."
      )
    );
  });
});

/**
 * 녹음이 **어느 워크스페이스 것인지**는 계약이 안 알려준다 — 노트 응답에 `projectId`만 있고
 * 세션 응답에는 둘 다 없다. 그래서 `start()`가 받아서 들고 있는다. 이 값이 없으면
 * 「이 워크스페이스를 녹음 중인가」를 물을 수 없어 나가기 잠금도 추방 정리도 못 만든다.
 */
describe("녹음 중인 워크스페이스", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("start가 받은 워크스페이스를 들고 있는다", async () => {
    const harness = setup();

    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    expect(harness.result.current.activeWorkspaceId).toBe(WORKSPACE_ID);
  });

  // `disconnect`는 로그아웃과 추방이 함께 쓰는 정리다. 워크스페이스만 남으면 이미 끝난
  // 녹음을 근거로 다음 워크스페이스의 나가기가 잠긴다.
  it("disconnect가 노트와 함께 워크스페이스도 비운다", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    await act(() => harness.result.current.disconnect());

    expect(harness.result.current.activeNoteId).toBeNull();
    expect(harness.result.current.activeWorkspaceId).toBeNull();
  });

  it("녹음 중인 워크스페이스만 활성으로 본다", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    expect(
      isWorkspaceRecordingActive(harness.result.current, WORKSPACE_ID)
    ).toBe(true);
    expect(
      isWorkspaceRecordingActive(harness.result.current, OTHER_WORKSPACE_ID)
    ).toBe(false);
  });

  it("녹음이 없으면 어느 워크스페이스도 활성이 아니다", () => {
    const harness = setup();

    expect(
      isWorkspaceRecordingActive(harness.result.current, WORKSPACE_ID)
    ).toBe(false);
  });
});

/**
 * **화면 밖 녹음도 끊어야 한다.** 녹음은 route를 넘어 살아 있어서(`RecordingProvider`가
 * `app/providers.tsx`에 있다) A를 녹음한 채 B나 홈으로 갈 수 있고, 그 상태로 A에서
 * 추방되면 아무 화면도 A를 보고 있지 않다. 화면 쪽 감지로는 닿지 않는 자리다.
 *
 * 세션 조회도 비멤버에게는 같은 404를 준다(`NoteAccessHandler.requireProjectMember`).
 */
describe("녹음 중에 워크스페이스에서 쫓겨나면", () => {
  beforeEach(() => {
    toastError.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const GONE = {
    success: false,
    data: null,
    error: {
      code: "WORKSPACE_NOT_FOUND",
      message: "워크스페이스를 찾을 수 없습니다.",
    },
  };

  it("보고 있지 않아도 마이크와 소켓을 끊는다", async () => {
    const harness = setup({ enablePolling: true });
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
    expect(harness.result.current.phase).toBe("recording");

    // 세션 폴링이 404를 받았다. `error`는 재시도를 다 소진해야 차므로 첫 실패를 본다.
    sessionQuery.current = {
      ...sessionQuery.current,
      failureReason: GONE,
    };
    harness.rerender();

    await waitFor(() => expect(harness.result.current.phase).toBe("idle"));
    // **말없이 사라지면 안 된다.** 화면이 다른 워크스페이스에 있으면 이 경로만 404를 보고,
    // 안내가 없으면 녹음 표시가 이유 없이 없어진다. **닫을 때까지 남아야 한다** — 숨긴
    // 탭에서 감지되면 기본 5초가 사용자 없이 다 지나간다.
    expect(toastError).toHaveBeenCalledWith(
      "이 워크스페이스에서 나가게 되었습니다.",
      expect.objectContaining({ id: expect.any(String), duration: Infinity })
    );
    expect(harness.controller.close).toHaveBeenCalled();
    expect(harness.result.current.session).toBeNull();
    expect(harness.result.current.activeWorkspaceId).toBeNull();
    // 사이드바·홈이 죽은 워크스페이스를 계속 그리면 눌러서 다시 들어갔다가 또 쫓겨난다.
    // 화면이 그곳에 없으면 `useRedirectWhenWorkspaceGone`이 안 떠 있어 아무도 안 고친다.
    expect(harness.invalidate).toHaveBeenCalledWith({
      queryKey: getGetWorkspacesQueryKey(),
    });
  });

  // 네트워크·500은 끊을 이유가 아니다 — 잠깐 끊긴 것뿐인데 녹음을 죽이면 그때까지의
  // 발화가 통째로 날아간다.
  it("다른 실패로는 안 끊는다", async () => {
    const harness = setup({ enablePolling: true });
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    sessionQuery.current = {
      ...sessionQuery.current,
      failureReason: new Error("Network request failed"),
    };
    harness.rerender();

    await waitFor(() => expect(harness.result.current.phase).toBe("recording"));
    expect(harness.controller.close).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });
});

/**
 * 추방·로그아웃 정리가 **진행 중인 시작과 겹칠 때.** `api.startSession()`이 대기하는 사이에
 * `disconnect()`가 돌면 상태는 비워지는데, 뒤늦게 도착한 READY 세션을 다시 저장하면
 * phase가 `idle`이라 폴링도 안 도는 **고아 세션**이 만료될 때까지 남는다.
 *
 * 사용자가 직접 취소한 경우에는 반대로 저장해야 한다 — 서버에 열린 세션이 있다는 것을
 * 독이 알려야 하기 때문이다. 그래서 "취소"와 "통째로 정리"를 구분한다.
 */
describe("정리 중에 시작이 끝나면", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("뒤늦게 도착한 세션을 되살리지 않는다", async () => {
    const harness = setup();
    let release!: (value: typeof session) => void;
    vi.mocked(harness.api.startSession).mockImplementationOnce(
      () =>
        new Promise<typeof session>((resolve) => {
          release = resolve;
        })
    );

    let starting!: Promise<void>;
    await act(async () => {
      starting = harness.result.current.start(session.noteId, WORKSPACE_ID);
      // 권한까지만 지나고 세션 생성에서 멈춘다.
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(harness.result.current.phase).toBe("connecting")
    );

    await act(() => harness.result.current.disconnect());
    await act(async () => {
      release(session);
      await starting;
    });

    expect(harness.result.current.session).toBeNull();
    expect(harness.result.current.phase).toBe("idle");
    expect(harness.result.current.activeNoteId).toBeNull();
  });
});

/**
 * **세션이 생기기 전에 쫓겨나면** 폴링이 아직 없다(`session?.sessionId`가 있어야 켜진다).
 * 그 사이 다른 워크스페이스로 옮겼으면 화면 쪽 감지기도 언마운트돼 아무도 안 본다.
 * 그러면 `startSession`의 404가 일반 실패로 처리돼 「다시 시도」만 남고, 눌러도 계속 404다.
 */
describe("시작하는 사이에 쫓겨나면", () => {
  beforeEach(() => {
    toastError.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // 전역 mutation 토스트를 껐으므로 **이 문구가 유일한 안내다.** 서버가 준 이유를 접으면
  // 사용자는 원인 대신 「녹음을 시작하지 못했습니다」만 보고 같은 재시도를 반복한다.
  it("서버가 준 이유를 그대로 보여 준다", async () => {
    const harness = setup();
    vi.mocked(harness.api.startSession).mockRejectedValueOnce({
      success: false,
      data: null,
      error: {
        code: "ACTIVE_TRANSCRIPTION_SESSION",
        message: "이미 진행 중인 전사 세션이 있습니다.",
      },
    });

    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    expect(harness.result.current.error).toBe(
      "이미 진행 중인 전사 세션이 있습니다."
    );
  });

  it("일반 실패가 아니라 강제 이탈로 처리한다", async () => {
    const harness = setup();
    vi.mocked(harness.api.startSession).mockRejectedValueOnce({
      success: false,
      data: null,
      error: {
        code: "WORKSPACE_NOT_FOUND",
        message: "워크스페이스를 찾을 수 없습니다.",
      },
    });

    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    expect(toastError).toHaveBeenCalledWith(
      "이 워크스페이스에서 나가게 되었습니다.",
      expect.objectContaining({ id: expect.any(String) })
    );
    expect(harness.invalidate).toHaveBeenCalledWith({
      queryKey: getGetWorkspacesQueryKey(),
    });
    // 「다시 시도」를 그리는 실패 상태로 두지 않는다 — 눌러도 결과가 같다.
    expect(harness.result.current.phase).toBe("idle");
    expect(harness.result.current.error).toBeNull();
    expect(harness.result.current.activeWorkspaceId).toBeNull();
  });
});

/**
 * 세션은 녹음 한 번이고 소켓은 거기 붙는 부착이다. 끊겨도 컨트롤러가 **같은 세션에** 다시
 * 붙는다. 그래서 3초 폴링은 표시용이고, 녹음을 끝내는 것은 회의 쪽 결정뿐이다.
 */
describe("같은 세션에 다시 붙는 동안", () => {
  function interrupted(
    endReason: "CLIENT_DISCONNECTED" | "HEARTBEAT_TIMEOUT" | "MEETING_PAUSED"
  ): SessionQueryMock {
    return {
      data: {
        status: 200,
        data: {
          success: true,
          data: {
            ...session,
            status: "INTERRUPTED",
            endedAt: "2026-07-15T00:02:00Z",
            endReason,
          },
        },
      },
      isFetching: false,
      dataUpdatedAt: Date.now(),
    };
  }

  it("새 세션을 달라고 하는 콜백을 넘기지 않는다", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    expect(harness.getCallbacks()).not.toHaveProperty("onReconnectNeeded");
  });

  it.each(["CLIENT_DISCONNECTED", "HEARTBEAT_TIMEOUT"] as const)(
    "폴링이 %s 를 봐도 녹음을 끝내지 않는다",
    async (endReason) => {
      const harness = setup({ enablePolling: true });
      await act(() =>
        harness.result.current.start(session.noteId, WORKSPACE_ID)
      );
      sessionQuery.current = interrupted(endReason);

      harness.rerender();
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)));

      expect(harness.result.current.phase).toBe("recording");
      expect(harness.result.current.error).toBeNull();
      expect(harness.controller.close).not.toHaveBeenCalled();
    }
  );

  it("회의가 일시중지됐으면 녹음을 멈춘다", async () => {
    const harness = setup({ enablePolling: true });
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
    sessionQuery.current = interrupted("MEETING_PAUSED");

    harness.rerender();

    await waitFor(() =>
      expect(harness.result.current.error).toBe(
        "회의가 일시중지되어 기록을 멈췄습니다."
      )
    );
    expect(harness.result.current.phase).toBe("failed");
  });

  it("다시 잇는 동안의 시각과 저장 대기량을 내보내고, 이으면 걷는다", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    act(() =>
      harness.getCallbacks().onReconnectChange?.({
        sinceMs: 1_000,
        pendingMs: 4_200,
      })
    );
    expect(harness.result.current.reconnecting).toEqual({
      sinceMs: 1_000,
      pendingMs: 4_200,
    });
    expect(harness.result.current.phase).toBe("recording");

    act(() => harness.getCallbacks().onReconnectChange?.(null));
    expect(harness.result.current.reconnecting).toBeNull();
  });

  it("버퍼 상태와 마이크 상태를 내보내고, 새 녹음에서 걷는다", async () => {
    const harness = setup();
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
    const state = {
      pendingMs: 12_000,
      limitMs: 3_600_000,
      persistent: true,
      paused: false,
      upload: null,
    };

    act(() => harness.getCallbacks().onBufferChange?.(state));
    act(() => harness.getCallbacks().onMicrophoneChange?.("ended", 0));

    expect(harness.result.current.buffer).toEqual(state);
    expect(harness.result.current.microphone).toBe("ended");
    expect(harness.runtime.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ noteId: session.noteId })
    );

    await act(() => harness.result.current.stop());
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
    expect(harness.result.current.buffer).toBeNull();
  });

  it("녹음 중에는 탭을 닫으려 하면 붙잡고, 끝나면 놓는다", async () => {
    // 이 파일은 자동 cleanup 이 없어 앞 테스트의 녹음 중 provider 가 window 에 남아 있다
    cleanup();
    const harness = setup();
    const leave = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(leave()).toBe(false);

    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
    expect(leave()).toBe(true);

    await act(() => harness.result.current.stop());
    expect(leave()).toBe(false);
  });

  it("녹음이 끝났어도 서버가 확정 안 한 소리가 남아 있으면 탭을 붙잡는다", async () => {
    cleanup();
    const harness = setup();
    const leave = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));
    const pending = {
      pendingMs: 3_000,
      limitMs: 300_000,
      persistent: false,
      paused: false,
      upload: null,
    };
    act(() => harness.getCallbacks().onBufferChange?.(pending));

    await act(() => harness.result.current.stop());
    expect(leave()).toBe(true);

    act(() =>
      harness.getCallbacks().onBufferChange?.({ ...pending, pendingMs: 0 })
    );
    expect(leave()).toBe(false);
  });

  const leftover: StoredRecording = {
    noteId: session.noteId,
    sessionId: "0HZX2K7M9Q4AZ",
    chunks: [
      {
        noteId: session.noteId,
        sessionId: "0HZX2K7M9Q4AZ",
        chunkSeq: 4,
        captureSamples: 6_400,
        bytes: 32_000,
      },
    ],
  };

  it("지난 탭이 남긴 소리를 열자마자 그 세션에 올린다", async () => {
    const harness = setup({ stored: [leftover] });

    await waitFor(() =>
      expect(harness.controller.resume).toHaveBeenCalledWith(
        leftover.sessionId,
        leftover.chunks
      )
    );
    expect(harness.runtime.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ noteId: leftover.noteId })
    );
  });

  it("서버가 받지 않으면 남겨 둔 채 그렇다고 알린다", async () => {
    const harness = setup({ stored: [leftover] });
    harness.controller.resume.mockImplementationOnce(async () => {
      harness.getCallbacks().onFailure("이미 닫힌 세션입니다.");
      throw new Error("이미 닫힌 세션입니다.");
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "지난 녹음의 소리 1초를 올리지 못해 이 기기에 남겨 두었습니다. (이미 닫힌 세션입니다.)"
      )
    );
    expect(harness.result.current.phase).toBe("idle");
  });

  // 종료 응답 시간 초과는 onFailure 만 부르고 resume 은 정상으로 끝난다
  it("이어 올리기가 던지지 않고 실패로만 끝나도 알린다", async () => {
    const harness = setup({ stored: [leftover] });
    harness.controller.resume.mockImplementationOnce(async () => {
      harness
        .getCallbacks()
        .onFailure("스크립트 완료 응답을 기다리는 중 시간이 초과되었습니다.");
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "지난 녹음의 소리 1초를 올리지 못해 이 기기에 남겨 두었습니다. (스크립트 완료 응답을 기다리는 중 시간이 초과되었습니다.)"
      )
    );
  });

  it("남은 소리를 올리는 동안 시작하면 다 올린 뒤에 새 세션을 연다", async () => {
    let finish!: () => void;
    const harness = setup({ stored: [leftover] });
    harness.controller.resume.mockImplementationOnce(
      () => new Promise<void>((done) => (finish = done))
    );
    await waitFor(() => expect(harness.controller.resume).toHaveBeenCalled());

    const starting = act(() =>
      harness.result.current.start(session.noteId, WORKSPACE_ID)
    );
    await new Promise((done) => setTimeout(done, 0));
    expect(harness.api.startSession).not.toHaveBeenCalled();

    finish();
    await starting;
    expect(harness.api.startSession).toHaveBeenCalledOnce();
  });

  it("다른 탭이나 기기가 이어받으면 그렇다고 말하고 이 탭의 녹음을 놓는다", async () => {
    const harness = setup({ enablePolling: true });
    await act(() => harness.result.current.start(session.noteId, WORKSPACE_ID));

    act(() =>
      harness
        .getCallbacks()
        .onEvent({ type: "superseded", sessionId: session.sessionId })
    );

    expect(harness.result.current.error).toBe(
      "다른 탭이나 기기에서 이 녹음을 이어받았습니다."
    );
    expect(harness.result.current.phase).toBe("failed");
    expect(harness.result.current.session).toBeNull();
  });
});
