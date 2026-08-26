import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { answerText } from "@/lib/chat/blocks";
import {
  IDLE_TIMEOUT_MS,
  RECONNECT_BACKOFF_MS,
  useChatStream,
} from "@/lib/chat/use-chat-stream";
import { resumedState } from "@/lib/chat/stream-protocol";

const postEventStream = vi.hoisted(() => vi.fn());
const getEventStream = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/sse", () => ({ postEventStream, getEventStream }));

const CHAT_ID = "01K0000000001";
const MESSAGES_URL = `/v1/agent-chats/${CHAT_ID}/messages`;

type Frame = { event: string; data: string; id?: string };

/** `seq`는 `id:` 줄에만 붙는다. `data:`는 언제나 payload 하나뿐이다. */
function frame(event: string, payload: unknown, seq?: number): Frame {
  return seq === undefined
    ? { event, data: JSON.stringify(payload) }
    : { event, data: JSON.stringify(payload), id: String(seq) };
}

const START = frame("message_start", { chatId: "c", messageId: "m" });

/** 연결 하나. 이벤트를 하나씩 밀어넣고 끝을 직접 정한다. */
function connection() {
  const queue: Frame[] = [];
  let notify: (() => void) | null = null;
  let finished = false;
  let aborted = false;

  return {
    push(...frames: Frame[]) {
      queue.push(...frames);
      notify?.();
    },
    finish() {
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
  const open = (url: string, options?: { signal?: AbortSignal }) => {
    const conn = connection();
    opened.push({ url, conn });
    return conn.run(options?.signal);
  };
  postEventStream.mockImplementation(
    (url: string, _body: unknown, options?: { signal?: AbortSignal }) =>
      open(url, options)
  );
  getEventStream.mockImplementation(
    (url: string, options?: { signal?: AbortSignal }) => open(url, options)
  );
  return opened;
}

/** 이벤트를 하나씩 밀어넣고 끝을 직접 정하는 제너레이터. */
function controllable() {
  const conn = connection();
  return {
    generator: (
      _url: string,
      _body: unknown,
      options?: { signal?: AbortSignal }
    ) => conn.run(options?.signal),
    push: conn.push,
    finish: conn.finish,
    get aborted() {
      return conn.aborted;
    },
  };
}

describe("useChatStream", () => {
  beforeEach(() => {
    postEventStream.mockReset();
    getEventStream.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("토큰이 붙고 message_end로 확정된다", async () => {
    const source = controllable();
    postEventStream.mockImplementation(source.generator);
    const { result } = renderHook(() => useChatStream());

    act(() => {
      void result.current.send(CHAT_ID, MESSAGES_URL, { message: "안녕" });
    });
    act(() => source.push(START, frame("token", { delta: "부분" })));
    await waitFor(() =>
      expect(answerText(result.current.state.blocks)).toBe("부분")
    );
    expect(result.current.state.phase).toBe("streaming");

    act(() =>
      source.push(
        frame("message_end", { messageId: "m", content: "전체 답변" })
      )
    );
    act(() => source.finish());
    await waitFor(() => expect(result.current.state.phase).toBe("done"));
    expect(result.current.state.content).toBe("전체 답변");
  });

  it("stop()이 스트림을 끊고 abort를 전달한다", async () => {
    const source = controllable();
    postEventStream.mockImplementation(source.generator);
    const { result } = renderHook(() => useChatStream());

    act(() => {
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
    });
    act(() => source.push(START, frame("token", { delta: "절반" })));
    await waitFor(() =>
      expect(answerText(result.current.state.blocks)).toBe("절반")
    );

    act(() => result.current.stop());
    await waitFor(() => expect(result.current.state.phase).toBe("cancelled"));
    expect(source.aborted).toBe(true);
    expect(answerText(result.current.state.blocks)).toBe("절반");
  });

  const APPROVAL_REQUEST = frame("tool_approval_request", {
    approvalId: "0K9GVJT2C4Q7F",
    toolCallId: "call_02",
    tool: "linear.create_issue",
  });

  it("★ 승인 요청으로 끝난 스트림은 다시 붙지 않는다", async () => {
    // 계약상 이것이 1차의 마지막 프레임이고 server가 곧바로 닫는다. EOF를 재연결 신호로
    // 읽으면 백오프 여섯 번(45초)을 돌다 포기 표시가 되어 승인 카드가 덮인다.
    vi.useFakeTimers();
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
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
    // 만료가 없어져 「중지」가 유일한 탈출구다. 루프는 이미 빠져나와 있으므로
    // `runningRef`만 보고 돌아가면 컴포저가 영영 잠긴다.
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
    });
    await act(async () => opened[0].conn.push(START, APPROVAL_REQUEST));
    await act(async () => opened[0].conn.finish());
    expect(result.current.state.phase).toBe("awaiting_approval");

    act(() => result.current.stop());
    expect(result.current.state.phase).toBe("cancelled");
    expect(result.current.state.pendingApproval).toBeNull();
  });

  it("승인 대기 중에는 유휴 타이머가 멈춘다", async () => {
    // 승인 요청이 스트림을 끝내므로 대기 구간에는 열린 연결이 없다. 유휴 40초로
    // 오탐하면 승인 카드가 정지 화면에 덮인다.
    vi.useFakeTimers();
    const source = controllable();
    postEventStream.mockImplementation(source.generator);
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
    });
    await act(async () => {
      source.push(
        START,
        frame("tool_approval_request", {
          approvalId: "0K9GVJT2C4Q7F",
          toolCallId: "call_02",
          tool: "linear.create_issue",
        })
      );
    });
    expect(result.current.state.phase).toBe("awaiting_approval");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS * 5);
    });
    expect(result.current.state.phase).toBe("awaiting_approval");
    expect(source.aborted).toBe(false);
  });

  it("message_end 뒤에는 전송이 늦게 닫혀도 유휴 타이머가 덮지 않는다", async () => {
    vi.useFakeTimers();
    const source = controllable();
    postEventStream.mockImplementation(source.generator);
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
    });
    await act(async () => {
      source.push(
        START,
        frame("message_end", { messageId: "m", content: "끝났습니다." })
      );
    });
    expect(result.current.state.phase).toBe("done");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS * 3);
    });
    expect(result.current.state.phase).toBe("done");
    expect(result.current.state.content).toBe("끝났습니다.");
  });

  it("message_end 뒤 전송이 reject해도 완료 상태를 덮지 않는다", async () => {
    // 답변은 이미 왔고 서버에도 남았다. 여기서 failed로 바꾸면 있는 답변을 숨긴다.
    postEventStream.mockImplementation(async function* () {
      yield START;
      yield frame("message_end", { messageId: "m", content: "끝났습니다." });
      throw new Error("NETWORK_RESET");
    });
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
    });
    await waitFor(() => expect(result.current.state.phase).toBe("done"));
    expect(result.current.state.content).toBe("끝났습니다.");
    expect(result.current.state.error).toBeNull();
  });

  it("스트림을 열지 못하면 서버 문구로 실패한다 — 재연결하지 않는다", async () => {
    // 404·400은 다시 걸어도 같은 답이다. 여기서 재시도하면 서버 문구를 45초 뒤에 보여 준다.
    postEventStream.mockImplementation(async function* () {
      throw {
        success: false,
        data: null,
        error: {
          code: "AGENT_CHAT_NOT_FOUND",
          message: "대화를 찾을 수 없습니다.",
        },
      };
    });
    const { result } = renderHook(() => useChatStream());

    act(() => {
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
    });
    await waitFor(() => expect(result.current.state.phase).toBe("failed"));
    expect(result.current.state.error).toEqual({
      code: "AGENT_CHAT_NOT_FOUND",
      message: "대화를 찾을 수 없습니다.",
    });
    expect(getEventStream).not.toHaveBeenCalled();
  });

  it("흐르는 중에는 새 전송을 무시한다", async () => {
    const source = controllable();
    postEventStream.mockImplementation(source.generator);
    const { result } = renderHook(() => useChatStream());

    act(() => {
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
    });
    act(() => source.push(START));
    await waitFor(() => expect(result.current.state.phase).toBe("streaming"));

    act(() => {
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
    });
    expect(postEventStream).toHaveBeenCalledTimes(1);
  });
});

/**
 * ★ 이 훅의 축. **EOF는 성공도 실패도 아니다** — 서버 버퍼에서 턴이 계속 돌고 있을 수
 * 있으므로 `GET /events?after=`로 이어받는다. 포기했을 때만 기존 오류 배너에 접는다.
 */
describe("끊겨도 다시 붙는다", () => {
  beforeEach(() => {
    postEventStream.mockReset();
    getEventStream.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("★ 흐르는 중 EOF는 상태가 아니라 재연결 신호다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
    });
    await act(async () => {
      opened[0].conn.push(START, frame("token", { delta: "앞부분" }, 40));
    });
    await act(async () => opened[0].conn.finish());

    expect(result.current.state.phase).toBe("streaming");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    });

    // 본 seq의 최대값이 커서다. 구멍(40 → 1001)이 있어도 그대로 쓴다.
    expect(opened[1].url).toBe("/v1/agent-chats/01K0000000001/events?after=40");
    // **복원한 블록을 안 지운다.** 백로그의 message_start가 섞여 와도 마찬가지다.
    expect(answerText(result.current.state.blocks)).toBe("앞부분");

    await act(async () => {
      opened[1].conn.push(
        frame("message_start", { messageId: "m" }, 1001),
        frame("token", { delta: " 뒷부분" }, 1002),
        frame("message_end", { messageId: "m", content: "앞부분 뒷부분" }, 1003)
      );
    });
    await act(async () => opened[1].conn.finish());

    expect(result.current.state.phase).toBe("done");
    expect(answerText(result.current.state.blocks)).toBe("앞부분 뒷부분");
  });

  it("재연결이 실패하면 백오프가 늘고, 다 쓰면 기존 오류 배너에 접힌다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
    });
    await act(async () => opened[0].conn.push(START));

    for (const [index, backoff] of RECONNECT_BACKOFF_MS.entries()) {
      await act(async () => opened[index].conn.finish());
      expect(result.current.state.phase).toBe("streaming");
      // 아직 그 간격이 안 지났으면 안 붙는다.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(backoff - 1);
      });
      expect(opened).toHaveLength(index + 1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(opened).toHaveLength(index + 2);
    }

    // 마지막 시도까지 끊기면 포기한다.
    await act(async () =>
      opened[RECONNECT_BACKOFF_MS.length].conn.finish()
    );
    // 새 상태를 안 만든다 — spec §10 「실패는 새 화면을 안 만든다」
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
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
    });
    await act(async () => opened[0].conn.push(START));

    // 두 번 끊어 백오프를 4초까지 올린다.
    await act(async () => opened[0].conn.finish());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    });
    await act(async () => opened[1].conn.finish());

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // 2초를 안 기다리고 즉시 붙었다.
    expect(opened).toHaveLength(3);

    // 그리고 시간표가 되감겨 다음 대기는 다시 첫 간격이다.
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
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
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
    // 안 막으면 「중지」를 눌렀는데 끊은 답이 재연결과 함께 다시 나타난다.
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
    });
    await act(async () => opened[0].conn.push(START, frame("token", { delta: "절반" })));

    await act(async () => result.current.stop());
    expect(result.current.state.phase).toBe("cancelled");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(opened).toHaveLength(1);
    expect(getEventStream).not.toHaveBeenCalled();
  });

  it("백오프를 자는 중에 중지해도 재연결하지 않는다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
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
    // 하트비트를 버리면 이 타이머가 「연결이 죽었나」가 아니라 「모델이 느린가」를 잰다 —
    // 도구가 40초 넘게 도는 정상 턴을 끊는다.
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
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
      void result.current.send(CHAT_ID, MESSAGES_URL, {});
    });
    await act(async () => opened[0].conn.push(START, frame("token", { delta: "조각" }, 7)));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS);
    });
    expect(opened[0].conn.aborted).toBe(true);
    expect(result.current.state.phase).toBe("streaming");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    });
    expect(opened[1].url).toBe("/v1/agent-chats/01K0000000001/events?after=7");
  });
});

describe("돌아오면 이어받는다", () => {
  beforeEach(() => {
    postEventStream.mockReset();
    getEventStream.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const RUNNING = {
    cursor: 131,
    turnId: "0K9GVJT2C4Q3B",
    pendingApproval: null,
  };

  it("★ 첫 연결부터 GET이고 커서가 ?after=로 간다 — POST를 안 건다", async () => {
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.resume(CHAT_ID, resumedState(RUNNING));
    });

    expect(postEventStream).not.toHaveBeenCalled();
    expect(opened[0].url).toBe("/v1/agent-chats/01K0000000001/events?after=131");
  });

  it("★ 이어받은 자리가 안 지워진다 — 백로그의 message_start도 안 지운다", async () => {
    // 버퍼는 대화 스코프라 재접속 백로그에 `message_start`가 섞여 온다. 리셋하면
    // 재생이 그려 둔 본문과 `turnId`가 통째로 사라진다.
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.resume(CHAT_ID, resumedState(RUNNING));
    });
    await act(async () =>
      opened[0].conn.push(frame("token", { delta: "안녕하" }, 132))
    );
    await act(async () =>
      opened[0].conn.push(START, frame("token", { delta: "세요" }, 133))
    );

    expect(answerText(result.current.state.blocks)).toBe("안녕하세요");
    expect(result.current.state.turnId).toBe("0K9GVJT2C4Q3B");
  });

  it("★ cursor 0으로 열자마자 닫혀도 실패가 아니다 — 다시 붙는다", async () => {
    // 「버퍼에 아무것도 없다」는 뜻이라 `GET /events`가 곧바로 닫힌다.
    const opened = wire();
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.resume(
        CHAT_ID,
        resumedState({ ...RUNNING, cursor: 0 })
      );
    });
    expect(opened[0].url).toBe("/v1/agent-chats/01K0000000001/events?after=0");

    await act(async () => opened[0].conn.finish());
    expect(result.current.state.phase).toBe("streaming");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    });
    expect(opened).toHaveLength(2);
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
    expect(result.current.state.turnId).toBe("0K9GVJT2C4Q3B");

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
