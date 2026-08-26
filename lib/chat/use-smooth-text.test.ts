import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSmoothText } from "@/lib/chat/use-smooth-text";

/** rAF 를 손으로 돌린다. jsdom 의 것은 타이머라 `vi.useFakeTimers` 와 엇갈린다. */
let frames: FrameRequestCallback[] = [];
let clock = 0;

function tick(ms = 16) {
  clock += ms;
  const pending = frames;
  frames = [];
  act(() => pending.forEach((frame) => frame(clock)));
}

beforeEach(() => {
  frames = [];
  clock = 0;
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => {
    frames.push(frame);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

afterEach(() => vi.unstubAllGlobals());

describe("받은 것을 고르게 풀어 놓는다", () => {
  it("★ 한꺼번에 온 덩어리를 한 프레임에 다 안 그린다", () => {
    const hook = renderHook(
      ({ text }) => useSmoothText(text, true),
      { initialProps: { text: "" } }
    );

    // 모델이 멈췄다가 200자를 통째로 뱉었다.
    hook.rerender({ text: "가".repeat(200) });
    tick();

    const first = hook.result.current.length;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(200);
  });

  it("계속 돌리면 결국 받은 것을 다 따라잡는다", () => {
    const hook = renderHook(({ text }) => useSmoothText(text, true), {
      initialProps: { text: "" },
    });

    hook.rerender({ text: "안녕하세요 반갑습니다" });
    for (let i = 0; i < 60; i += 1) tick();

    expect(hook.result.current).toBe("안녕하세요 반갑습니다");
  });

  it("★ 턴이 끝나면 남은 것을 그 자리에서 다 보여 준다", () => {
    const hook = renderHook(
      ({ text, active }) => useSmoothText(text, active),
      { initialProps: { text: "", active: true } }
    );

    hook.rerender({ text: "가".repeat(500), active: true });
    tick();
    expect(hook.result.current.length).toBeLessThan(500);

    hook.rerender({ text: "가".repeat(500), active: false });
    expect(hook.result.current.length).toBe(500);
  });

  it("앞이 다른 글로 바뀌면 따라잡지 않고 맞춘다 — 대화를 갈아 끼웠다", () => {
    const hook = renderHook(({ text }) => useSmoothText(text, true), {
      initialProps: { text: "" },
    });

    hook.rerender({ text: "먼저 온 답입니다" });
    for (let i = 0; i < 60; i += 1) tick();
    expect(hook.result.current).toBe("먼저 온 답입니다");

    hook.rerender({ text: "전혀 다른 답" });
    expect(hook.result.current).toBe("전혀 다른 답");
  });

  it("흐르지 않는 글은 처음부터 다 보인다 — 히스토리다", () => {
    const hook = renderHook(() => useSmoothText("지난 답변", false));
    expect(hook.result.current).toBe("지난 답변");
  });

  it("★ 처음부터 있던 글은 안 늦춘다 — 되이어받기가 타이핑으로 보이면 안 된다", () => {
    const hook = renderHook(() => useSmoothText("버퍼에서 통째로 재생된 답", true));
    expect(hook.result.current).toBe("버퍼에서 통째로 재생된 답");
  });
});
