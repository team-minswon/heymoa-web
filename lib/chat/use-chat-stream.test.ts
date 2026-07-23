import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IDLE_TIMEOUT_MS, useChatStream } from "@/lib/chat/use-chat-stream";

const postEventStream = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/sse", () => ({ postEventStream }));

type Frame = { event: string; data: string };

function frame(event: string, payload: unknown): Frame {
  return { event, data: JSON.stringify(payload) };
}

const START = frame("message_start", { chatId: "c", messageId: "m" });

/** 이벤트를 하나씩 밀어넣고 끝을 직접 정하는 제너레이터. */
function controllable() {
  const queue: Frame[] = [];
  let notify: (() => void) | null = null;
  let finished = false;
  let aborted = false;

  async function* generator(_url: string, _body: unknown, options?: { signal?: AbortSignal }) {
    options?.signal?.addEventListener("abort", () => {
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
  }

  return {
    generator,
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
  };
}

describe("useChatStream", () => {
  beforeEach(() => {
    postEventStream.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("토큰이 붙고 message_end로 확정된다", async () => {
    const source = controllable();
    postEventStream.mockImplementation(source.generator);
    const { result } = renderHook(() => useChatStream());

    act(() => {
      void result.current.send("/v1/agent-chats/c/messages", { message: "안녕" });
    });
    act(() => source.push(START, frame("token", { delta: "부분" })));
    await waitFor(() => expect(result.current.state.text).toBe("부분"));
    expect(result.current.state.phase).toBe("streaming");

    act(() =>
      source.push(frame("message_end", { messageId: "m", content: "전체 답변" }))
    );
    act(() => source.finish());
    await waitFor(() => expect(result.current.state.phase).toBe("idle"));
    expect(result.current.state.content).toBe("전체 답변");
  });

  it("종료 이벤트 없이 끝나면 정지 상태다", async () => {
    const source = controllable();
    postEventStream.mockImplementation(source.generator);
    const { result } = renderHook(() => useChatStream());

    act(() => {
      void result.current.send("/url", {});
    });
    act(() => source.push(START, frame("token", { delta: "만들던 중" })));
    await waitFor(() => expect(result.current.state.text).toBe("만들던 중"));

    act(() => source.finish());
    await waitFor(() => expect(result.current.state.phase).toBe("stalled"));
    expect(result.current.state.text).toBe("만들던 중");
  });

  it("stop()이 스트림을 끊고 abort를 전달한다", async () => {
    const source = controllable();
    postEventStream.mockImplementation(source.generator);
    const { result } = renderHook(() => useChatStream());

    act(() => {
      void result.current.send("/url", {});
    });
    act(() => source.push(START, frame("token", { delta: "절반" })));
    await waitFor(() => expect(result.current.state.text).toBe("절반"));

    act(() => result.current.stop());
    await waitFor(() => expect(result.current.state.phase).toBe("aborted"));
    expect(source.aborted).toBe(true);
    expect(result.current.state.text).toBe("절반");
  });

  it("유휴가 상한을 넘으면 정지 상태가 된다", async () => {
    // 타이머를 처음부터 가짜로 둔다 — 진짜 타이머로 건 예약은 나중에 useFakeTimers로 바꿔도
    // advanceTimersByTime이 건드리지 못한다. 제너레이터는 마이크로태스크만 쓰므로 영향이 없다.
    vi.useFakeTimers();
    const source = controllable();
    postEventStream.mockImplementation(source.generator);
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.send("/url", {});
    });
    await act(async () => {
      source.push(START, frame("token", { delta: "조각" }));
    });
    expect(result.current.state.text).toBe("조각");

    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    });
    expect(result.current.state.phase).toBe("stalled");
  });

  it("승인 대기 중에는 유휴 타이머가 멈춘다", async () => {
    // 계약의 승인 대기 상한은 300초다. 유휴 40초로 오탐하면 승인 카드가 정지 화면에 덮인다.
    vi.useFakeTimers();
    const source = controllable();
    postEventStream.mockImplementation(source.generator);
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.send("/url", {});
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

    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS * 5);
    });
    expect(result.current.state.phase).toBe("awaiting_approval");
  });

  it("message_end 뒤에는 전송이 늦게 닫혀도 유휴 타이머가 덮지 않는다", async () => {
    // 서버·프록시가 응답을 늦게 닫아도 답변은 이미 끝났다. 여기서 타이머가 돌면
    // 완료된 답변이 "중간에 끊겼습니다"로 덮인다.
    vi.useFakeTimers();
    const source = controllable();
    postEventStream.mockImplementation(source.generator);
    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      void result.current.send("/url", {});
    });
    await act(async () => {
      source.push(
        START,
        frame("message_end", { messageId: "m", content: "끝났습니다." })
      );
    });
    expect(result.current.state.phase).toBe("idle");

    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS * 3);
    });
    expect(result.current.state.phase).toBe("idle");
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
      void result.current.send("/url", {});
    });
    await waitFor(() => expect(result.current.state.phase).toBe("idle"));
    expect(result.current.state.content).toBe("끝났습니다.");
    expect(result.current.state.error).toBeNull();
  });

  it("스트림을 열지 못하면 서버 문구로 실패한다", async () => {
    postEventStream.mockImplementation(async function* () {
      throw {
        success: false,
        data: null,
        error: { code: "AGENT_CHAT_NOT_FOUND", message: "대화를 찾을 수 없습니다." },
      };
    });
    const { result } = renderHook(() => useChatStream());

    act(() => {
      void result.current.send("/url", {});
    });
    await waitFor(() => expect(result.current.state.phase).toBe("failed"));
    expect(result.current.state.error).toEqual({
      code: "AGENT_CHAT_NOT_FOUND",
      message: "대화를 찾을 수 없습니다.",
    });
  });

  it("흐르는 중에는 새 전송을 무시한다", async () => {
    const source = controllable();
    postEventStream.mockImplementation(source.generator);
    const { result } = renderHook(() => useChatStream());

    act(() => {
      void result.current.send("/url", {});
    });
    act(() => source.push(START));
    await waitFor(() => expect(result.current.state.phase).toBe("streaming"));

    act(() => {
      void result.current.send("/url", {});
    });
    expect(postEventStream).toHaveBeenCalledTimes(1);
  });
});
