import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductShot } from "@/components/heymoa/landing/product-shot";

/**
 * 랜딩의 제품 화면에서 **실제로 물어볼 수 있다**. 여기서 지키는 것은 셋이다.
 *
 * 1. 준비된 질문을 누르면 그 왕복이 대화에 쌓인다
 * 2. 답이 흐르는 동안에는 근거가 아직 안 붙고 다음 질문도 못 보낸다
 * 3. 모션을 줄인 사람에게는 흘리지 않고 통째로 선다
 *
 * 2가 이 파일의 요점이다. 흐르는 중에 근거를 그리면 **아직 안 읽은 회의록이 이미 붙은
 * 것처럼** 보이고, 그건 이 랜딩이 하는 「사실 대조판」이라는 약속을 화면이 먼저 어기는 것이다.
 *
 * 좁은 화면용과 넓은 화면용 두 벌이 다 마운트된다(CSS로 하나만 보인다) — 그래서 전부
 * `getAllBy*`로 집고 첫 벌만 만진다.
 */
const matchMedia = (reduced: boolean) =>
  vi.fn().mockImplementation((query: string) => ({
    matches: reduced,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

/** 첫 벌의 「내 에이전트」를 열고 대화와 예시 질문을 돌려준다. */
function openAgent() {
  fireEvent.click(screen.getAllByRole("tab", { name: "내 에이전트" })[0]);
  const asks = screen.getAllByRole("group", { name: "예시 질문" })[0];
  return { asks, buttons: within(asks).getAllByRole("button") };
}

describe("ProductShot 내 에이전트", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.matchMedia = matchMedia(false);
  });

  it("준비된 질문을 누르면 그 왕복이 대화에 쌓인다", () => {
    render(<ProductShot />);
    const { buttons } = openAgent();
    const question = buttons[0].textContent ?? "";

    fireEvent.click(buttons[0]);

    // 질문은 곧바로 선다 — 흐르는 것은 답뿐이다.
    expect(screen.getAllByText(question).length).toBeGreaterThan(1);
  });

  it("답이 흐르는 동안에는 근거가 안 붙고 다음 질문도 못 보낸다", () => {
    vi.useFakeTimers();
    try {
      render(<ProductShot />);
      const { buttons } = openAgent();

      // 「제가 없던 사이에」의 답은 「2차 회의」를 근거로 든다. 처음 떠 있는 왕복도 같은
      // 칩을 들고 있으므로 **개수**로 센다.
      const refs = () => screen.getAllByText("2차 회의").length;
      const before = refs();

      act(() => {
        fireEvent.click(buttons[2]);
      });

      expect(refs()).toBe(before);
      expect(buttons[0]).toBeDisabled();

      // 한 번에 5초를 당기면 한 글자만 흐른다 — 다음 타이머는 **효과가 돈 뒤에** 걸리고
      // 효과는 `act`가 끝날 때 돈다. 그래서 조금씩, 여러 번 당긴다.
      for (let i = 0; i < 200 && buttons[0].hasAttribute("disabled"); i += 1) {
        act(() => {
          vi.advanceTimersByTime(20);
        });
      }

      expect(refs()).toBeGreaterThan(before);
      expect(buttons[0]).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("모션을 줄였으면 흘리지 않고 통째로 세운다", () => {
    window.matchMedia = matchMedia(true);
    vi.useFakeTimers();
    try {
      render(<ProductShot />);
      const { buttons } = openAgent();
      const before = screen.getAllByText("2차 회의").length;

      act(() => {
        fireEvent.click(buttons[2]);
      });

      // 타이머를 한 번도 안 돌렸는데 근거가 이미 서 있다.
      expect(screen.getAllByText("2차 회의").length).toBeGreaterThan(before);
      expect(buttons[0]).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
