import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { answerText } from "@/lib/chat/blocks";
import {
  IDLE_TIMEOUT_MS,
  RECONNECT_BACKOFF_MS,
  useChatStream,
} from "@/lib/chat/use-chat-stream";
import { resumedState, startedState } from "@/lib/chat/stream-protocol";

const getEventStream = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/sse", () => ({ getEventStream }));

const CHAT_ID = "01K0000000001";
const TURN_ID = "0K9GVJT2C4Q3B";
const EVENTS_URL = `/v1/agent-chats/${CHAT_ID}/turns/${TURN_ID}/events`;

type Frame = { event: string; data: string; id?: string };

/** 커서는 `id:` 줄에만 붙는다. `data:`는 언제나 payload 하나뿐이다. */
function frame(event: string, payload: unknown, id?: string): Frame {
  return id === undefined
    ? { event, data: JSON.stringify(payload) }
    : { event, data: JSON.stringify(payload), id };
}

const START = frame("message_start", { chatId: "c", messageId: "m" }, "1-0");

/** 연결 하나. 이벤트를 하나씩 밀어넣고 끝을 직접 정한다. */
function connection() {
  const queue: Frame[] = [];
  let notify: (() => void) | null = null;
  let finished = false;
  let aborted = false;
  let failure: unknown = null;

  return {
    push(...frames: Frame[]) {
      queue.push(...frames);
      notify?.();
    },
    finish() {
      finished = true;
      notify?.();
    },
    /** 열리기도 전에 실패한다 — `connect` 가 던진 것과 같은 자리다. */
    fail(error: unknown) {
      failure = error;
      finished = true;
      notify?.();
    },
    get aborted() {
      return aborted;
    },
    async *run(signal?: AbortSignal) {
      signal?.addEventListener("abort", () => {
        aborted = true;
        finished = true;
        notify?.();
      });
      while (true) {
        while (queue.length > 0) yield queue.shift()!;
        if (failure !== null) throw failure;
        if (finished) return;
        await new Promise<void>((resolve) => {
          notify = () => {
            notify = null;
            resolve();
          };
        });
      }
    },
  };
}

/**
 * 열린 연결들을 순서대로 모은다. **재연결이 몇 번째로 어느 URL에 갔는지**를 여기서 본다 —
 * 훅의 축이 「끊기면 다시 붙는다」라 연결 자체가 검증 대상이다.
 */
function wire() {
  const opened: { url: string; conn: ReturnType<typeof connection> }[] = [];
  getEventStream.mockImplementation(
    (url: string, options?: { signal?: AbortSignal }) => {
      const conn = connection();
      opened.push({ url, conn });
      return conn.run(options?.signal);
    }
  );
  return opened;
}

const GONE = {
  success: false,
  data: null,
  error: { code: "SSE_STREAM_GONE", message: "스트림이 사라졌습니다." },
};

describe("useChatStream", () => {
  beforeEach(() => {
    getEventStream.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("★ open 뒤 첫 연결은 GET …/turns/{turnId}/events 이고 after 가 없다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });

    expect(opened[0].url).toBe(EVENTS_URL);
    expect(result.current.state).toMatchObject({
      phase: "streaming",
      turnId: TURN_ID,
      cursor: null,
    });
  });

  it("토큰이 붙고 message_end로 확정된다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    act(() => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await waitFor(() => expect(opened).toHaveLength(1));
    act(() => opened[0].conn.push(START, frame("token", { delta: "부분" }, "2-0")));
    await waitFor(() =>
      expect(answerText(result.current.state.blocks)).toBe("부분")
    );
    expect(result.current.state.phase).toBe("streaming");

    act(() =>
      opened[0].conn.push(
        frame("message_end", { messageId: "m", content: "전체 답변" }, "3-0")
      )
    );
    act(() => opened[0].conn.finish());
    await waitFor(() => expect(result.current.state.phase).toBe("done"));
    expect(result.current.state.content).toBe("전체 답변");
  });

  it("★ message_end 뒤 EOF 는 재연결하지 않는다", async () => {
    vi.useFakeTimers();
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () =>
      opened[0].conn.push(
        START,
        frame("message_end", { messageId: "m", content: "끝" }, "2-0")
      )
    );
    await act(async () => opened[0].conn.finish());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(opened).toHaveLength(1);
    expect(result.current.state.phase).toBe("done");
  });

  it("★ 410 이면 재연결하지 않고 needsResync 를 세운다", async () => {
    vi.useFakeTimers();
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () => opened[0].conn.fail(GONE));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(opened).toHaveLength(1);
    expect(result.current.state.needsResync).toBe(true);
    // 상태 자체는 그대로다 — 새 phase 를 만들지 않는다. 히스토리 재조회가 답을 세운다.
    expect(result.current.state.turnId).toBe(TURN_ID);
  });

  it("stop()이 스트림을 끊고 abort를 전달한다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    act(() => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await waitFor(() => expect(opened).toHaveLength(1));
    act(() => opened[0].conn.push(START, frame("token", { delta: "절반" }, "2-0")));
    await waitFor(() =>
      expect(answerText(result.current.state.blocks)).toBe("절반")
    );

    act(() => result.current.stop());
    await waitFor(() => expect(result.current.state.phase).toBe("cancelled"));
    expect(opened[0].conn.aborted).toBe(true);
    expect(answerText(result.current.state.blocks)).toBe("절반");
  });

  const APPROVAL_REQUEST = frame(
    "tool_approval_request",
    {
      approvalId: "0K9GVJT2C4Q7F",
      toolCallId: "call_02",
      tool: "linear.create_issue",
    },
    "2-0"
  );

  it("★ 승인 요청으로 끝난 스트림은 다시 붙지 않는다", async () => {
    // 계약상 이것이 마지막 프레임이고 server가 곧바로 닫는다. EOF를 재연결 신호로
    // 읽으면 백오프 여섯 번(45초)을 돌다 포기 표시가 되어 승인 카드가 덮인다.
    vi.useFakeTimers();
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () => opened[0].conn.push(START, APPROVAL_REQUEST));
    await act(async () => opened[0].conn.finish());

    expect(result.current.state.phase).toBe("awaiting_approval");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        RECONNECT_BACKOFF_MS.reduce((sum, ms) => sum + ms, 0) + 1_000
      );
    });
    expect(opened).toHaveLength(1);
    expect(result.current.state.phase).toBe("awaiting_approval");
  });

  it("★ 승인 대기에서 stop()이 대화를 푼다", async () => {
    // 만료가 없어 「중지」가 유일한 탈출구다. 루프는 이미 빠져나와 있으므로
    // `runningRef`만 보고 돌아가면 컴포저가 영영 잠긴다.
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () => opened[0].conn.push(START, APPROVAL_REQUEST));
    await act(async () => opened[0].conn.finish());
    expect(result.current.state.phase).toBe("awaiting_approval");

    act(() => result.current.stop());
    expect(result.current.state.phase).toBe("cancelled");
    expect(result.current.state.pendingApproval).toBeNull();
  });

  it("★ 승인 뒤 다시 열면 카드의 id 가 after 로 간다", async () => {
    // 승인 API 는 202 만 주고, 나머지 절반은 같은 스트림에 지금 커서를 넣어 다시 붙어 받는다.
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () => opened[0].conn.push(START, APPROVAL_REQUEST));
    await act(async () => opened[0].conn.finish());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, {
        ...result.current.state,
        phase: "streaming",
      });
    });
    expect(opened[1].url).toBe(`${EVENTS_URL}?after=2-0`);
  });

  it("승인 대기 중에는 유휴 타이머가 멈춘다", async () => {
    vi.useFakeTimers();
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () => opened[0].conn.push(START, APPROVAL_REQUEST));
    expect(result.current.state.phase).toBe("awaiting_approval");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS * 5);
    });
    expect(result.current.state.phase).toBe("awaiting_approval");
    expect(opened[0].conn.aborted).toBe(false);
  });

  it("message_end 뒤에는 전송이 늦게 닫혀도 유휴 타이머가 덮지 않는다", async () => {
    vi.useFakeTimers();
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () =>
      opened[0].conn.push(
        START,
        frame("message_end", { messageId: "m", content: "끝났습니다." }, "2-0")
      )
    );
    expect(result.current.state.phase).toBe("done");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS * 3);
    });
    expect(result.current.state.phase).toBe("done");
    expect(result.current.state.content).toBe("끝났습니다.");
  });

  it("message_end 뒤 전송이 reject해도 완료 상태를 덮지 않는다", async () => {
    getEventStream.mockImplementation(async function* () {
      yield START;
      yield frame("message_end", { messageId: "m", content: "끝났습니다." }, "2-0");
      throw new Error("NETWORK_RESET");
    });
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await waitFor(() => expect(result.current.state.phase).toBe("done"));
    expect(result.current.state.content).toBe("끝났습니다.");
    expect(result.current.state.error).toBeNull();
  });

  it("흐르는 중에는 새 open 을 무시한다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    act(() => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await waitFor(() => expect(opened).toHaveLength(1));
    act(() => opened[0].conn.push(START));
    await waitFor(() => expect(result.current.state.phase).toBe("streaming"));

    act(() => {
      void result.current.open(CHAT_ID, "다른턴", startedState({ turnId: "다른턴" }));
    });
    expect(getEventStream).toHaveBeenCalledTimes(1);
  });
});

/**
 * ★ 이 훅의 축. **EOF는 성공도 실패도 아니다** — 턴은 server 에서 계속 돌고 있을 수
 * 있으므로 마지막 `id:` 를 `after` 에 넣어 같은 주소로 다시 붙는다. 포기했을 때만 기존
 * 오류 배너에 접는다.
 */
describe("끊겨도 다시 붙는다", () => {
  beforeEach(() => {
    getEventStream.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("★ 프레임 둘 받고 끊기면 재연결 URL 의 after 가 둘째 id 다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () => {
      opened[0].conn.push(
        frame("message_start", { messageId: "m" }, "1735689600000-0"),
        frame("token", { delta: "앞부분" }, "1735689600000-1")
      );
    });
    await act(async () => opened[0].conn.finish());

    expect(result.current.state.phase).toBe("streaming");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    });

    expect(opened[1].url).toBe(`${EVENTS_URL}?after=1735689600000-1`);
    // **복원한 블록을 안 지운다.**
    expect(answerText(result.current.state.blocks)).toBe("앞부분");

    await act(async () => {
      opened[1].conn.push(
        frame("token", { delta: " 뒷부분" }, "1735689600001-0"),
        frame("message_end", { messageId: "m", content: "앞부분 뒷부분" }, "1735689600001-1")
      );
    });
    await act(async () => opened[1].conn.finish());

    expect(result.current.state.phase).toBe("done");
    expect(answerText(result.current.state.blocks)).toBe("앞부분 뒷부분");
  });

  it("프레임을 하나도 못 봤으면 재연결도 after 없이 간다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () => opened[0].conn.finish());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    });

    expect(opened[1].url).toBe(EVENTS_URL);
    expect(result.current.state.phase).toBe("streaming");
  });

  it("재연결이 실패하면 백오프가 늘고, 다 쓰면 기존 오류 배너에 접힌다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () => opened[0].conn.push(START));

    for (const [index, backoff] of RECONNECT_BACKOFF_MS.entries()) {
      await act(async () => opened[index].conn.finish());
      expect(result.current.state.phase).toBe("streaming");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(backoff - 1);
      });
      expect(opened).toHaveLength(index + 1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(opened).toHaveLength(index + 2);
    }

    await act(async () =>
      opened[RECONNECT_BACKOFF_MS.length].conn.finish()
    );
    expect(result.current.state).toMatchObject({
      phase: "failed",
      retryable: true,
    });
    expect(result.current.state.error?.code).toBe("STREAM_INTERRUPTED");
  });

  it("★ 탭이 돌아오면 남은 백오프를 안 기다리고 시간표를 되감는다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () => opened[0].conn.push(START));

    await act(async () => opened[0].conn.finish());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    });
    await act(async () => opened[1].conn.finish());

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(opened).toHaveLength(3);

    await act(async () => opened[2].conn.finish());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    });
    expect(opened).toHaveLength(4);
    expect(result.current.state.phase).toBe("streaming");
  });

  it("네트워크가 붙어도 즉시 재시도한다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () => opened[0].conn.push(START));
    await act(async () => opened[0].conn.finish());

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(opened).toHaveLength(2);
    expect(result.current.state.phase).toBe("streaming");
  });

  it("★ stop() 뒤에는 재연결하지 않는다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () => opened[0].conn.push(START, frame("token", { delta: "절반" }, "2-0")));

    await act(async () => result.current.stop());
    expect(result.current.state.phase).toBe("cancelled");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(opened).toHaveLength(1);
  });

  it("백오프를 자는 중에 중지해도 재연결하지 않는다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () => opened[0].conn.push(START));
    await act(async () => opened[0].conn.finish());

    await act(async () => result.current.stop());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(opened).toHaveLength(1);
    expect(result.current.state.phase).toBe("cancelled");
  });

  it("★ heartbeat가 유휴 타이머를 되감는다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () => opened[0].conn.push(START));

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS - 1_000);
      });
      await act(async () => opened[0].conn.push({ event: "heartbeat", data: "{}" }));
    }

    expect(opened).toHaveLength(1);
    expect(opened[0].conn.aborted).toBe(false);
    expect(result.current.state.phase).toBe("streaming");
  });

  it("하트비트조차 안 오면 끊고 다시 붙는다 — 정지로 찍지 않는다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.open(CHAT_ID, TURN_ID, startedState({ turnId: TURN_ID }));
    });
    await act(async () => opened[0].conn.push(START, frame("token", { delta: "조각" }, "7-0")));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS);
    });
    expect(opened[0].conn.aborted).toBe(true);
    expect(result.current.state.phase).toBe("streaming");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    });
    expect(opened[1].url).toBe(`${EVENTS_URL}?after=7-0`);
  });
});

describe("돌아오면 이어받는다", () => {
  beforeEach(() => {
    getEventStream.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const RUNNING = {
    cursor: "1735689600000-4",
    turnId: TURN_ID,
    pendingApproval: null,
  };

  it("★ 히스토리의 커서가 그대로 ?after= 로 간다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.resume(CHAT_ID, resumedState(RUNNING));
    });

    expect(opened[0].url).toBe(`${EVENTS_URL}?after=1735689600000-4`);
  });

  it("★ 커서가 null 이면 after 없이 연다 — 처음부터다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.resume(CHAT_ID, resumedState({ ...RUNNING, cursor: null }));
    });
    expect(opened[0].url).toBe(EVENTS_URL);

    // 프레임 없이 곧바로 닫혀도 실패가 아니다 — 다시 붙는다.
    await act(async () => opened[0].conn.finish());
    expect(result.current.state.phase).toBe("streaming");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    });
    expect(opened).toHaveLength(2);
  });

  it("★ 이어받은 자리가 안 지워진다 — 재생의 message_start도 안 지운다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.resume(CHAT_ID, resumedState(RUNNING));
    });
    await act(async () =>
      opened[0].conn.push(frame("token", { delta: "안녕하" }, "1735689600000-5"))
    );
    await act(async () =>
      opened[0].conn.push(START, frame("token", { delta: "세요" }, "1735689600000-6"))
    );

    expect(answerText(result.current.state.blocks)).toBe("안녕하세요");
    expect(result.current.state.turnId).toBe(TURN_ID);
  });

  it("이어받는 중에도 중지가 턴을 끊고 재연결을 막는다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.resume(CHAT_ID, resumedState(RUNNING));
    });
    await act(async () => result.current.stop());

    expect(opened[0].conn.aborted).toBe(true);
    expect(result.current.state.phase).toBe("cancelled");
    // `turnId`가 남아야 취소 API를 부를 수 있다.
    expect(result.current.state.turnId).toBe(TURN_ID);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    });
    expect(opened).toHaveLength(1);
  });
});

describe("시간값은 감이고, 그래서 상수로 못 박는다", () => {
  it("유휴 상한이 40초다", () => {
    expect(IDLE_TIMEOUT_MS).toBe(40_000);
  });

  it("백오프가 1·2·4·8·15·15 여섯 번이고 합이 45초다", () => {
    expect(RECONNECT_BACKOFF_MS).toEqual([1_000, 2_000, 4_000, 8_000, 15_000, 15_000]);
    expect(RECONNECT_BACKOFF_MS.reduce((a, b) => a + b, 0)).toBe(45_000);
  });
});
