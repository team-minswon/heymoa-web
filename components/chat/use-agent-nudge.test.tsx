import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NUDGE_DELAYS_MS,
  NUDGE_RETRY_MS,
  NUDGE_SHOW_MS,
  useAgentNudge,
} from "@/components/chat/use-agent-nudge";

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

function setHidden(value: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value });
}

describe("useAgentNudge", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
    document.body.innerHTML = "";
  });

  it("첫 시간 뒤 켜지고 2.4초 뒤 꺼지며 간격이 벌어지다가 상한에서 멈춘다", () => {
    const { result } = renderHook(() => useAgentNudge(true));
    expect(result.current).toBe(false);
    for (const delay of NUDGE_DELAYS_MS) {
      tick(delay - 1);
      expect(result.current).toBe(false);
      tick(1);
      expect(result.current).toBe(true);
      tick(NUDGE_SHOW_MS);
      expect(result.current).toBe(false);
    }
    tick(10 * 60_000);
    expect(result.current).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("꺼지면 타이머를 걷고 켜진 것도 끈다", () => {
    const { result, rerender } = renderHook(({ on }) => useAgentNudge(on), {
      initialProps: { on: true },
    });
    tick(NUDGE_DELAYS_MS[0]);
    expect(result.current).toBe(true);
    rerender({ on: false });
    expect(result.current).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("언마운트하면 타이머가 남지 않는다", () => {
    const { unmount } = renderHook(() => useAgentNudge(true));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("탭이 숨겨졌거나 입력 중이면 횟수를 쓰지 않고 미룬다", () => {
    const { result } = renderHook(() => useAgentNudge(true));
    setHidden(true);
    tick(NUDGE_DELAYS_MS[0]);
    expect(result.current).toBe(false);
    setHidden(false);
    const input = document.body.appendChild(document.createElement("input"));
    input.focus();
    tick(NUDGE_RETRY_MS);
    expect(result.current).toBe(false);
    input.blur();
    tick(NUDGE_RETRY_MS);
    expect(result.current).toBe(true);
  });

  it("도는 동안 탭이 숨겨지면 접는다", () => {
    const { result } = renderHook(() => useAgentNudge(true));
    tick(NUDGE_DELAYS_MS[0]);
    expect(result.current).toBe(true);
    setHidden(true);
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current).toBe(false);
  });
});
