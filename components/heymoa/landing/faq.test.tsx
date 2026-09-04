import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Faq } from "@/components/heymoa/landing/faq";

/**
 * FAQ는 이 랜딩에서 유일하게 상태를 가진 자리다. jsdom은 px를 못 재니 여기서 보는 것은
 * **접힘이 스크린 리더와 페이지 내 찾기에 어떻게 보이는가**뿐이다.
 *
 * 답을 조건부 렌더로 되돌리면 `aria-controls`가 없는 id를 가리키게 되는데, 그건 렌더 결과만
 * 보면 티가 안 난다 — 그래서 여기서 잡는다.
 */
describe("Faq", () => {
  afterEach(cleanup);

  it("첫 항목만 펼친 채로 시작한다", () => {
    render(<Faq />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);
    expect(buttons.map((b) => b.getAttribute("aria-expanded"))).toEqual([
      "true",
      "false",
      "false",
      "false",
      "false",
    ]);
  });

  it("누르면 열리고 다시 누르면 닫힌다", () => {
    render(<Faq />);
    const second = screen.getAllByRole("button")[1];

    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "false");
  });

  it("여러 개를 동시에 열어 둘 수 있다", () => {
    render(<Faq />);
    const [first, second] = screen.getAllByRole("button");

    fireEvent.click(second);

    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(second).toHaveAttribute("aria-expanded", "true");
  });

  it("접힌 답도 DOM에 남고 hidden으로만 가려진다", () => {
    const { container } = render(<Faq />);
    const buttons = screen.getAllByRole("button");

    for (const button of buttons) {
      const id = button.getAttribute("aria-controls");
      expect(id).toBeTruthy();

      // aria-controls가 가리키는 자리가 실제로 있어야 한다 — 조건부 렌더로 지우면 깨진다
      const panel = container.querySelector(`#${CSS.escape(id as string)}`);
      expect(panel).not.toBeNull();
      expect(panel?.hasAttribute("hidden")).toBe(
        button.getAttribute("aria-expanded") === "false"
      );
    }
  });

  it("제목 위계를 지킨다 — 버튼이 h3 안에 있다", () => {
    render(<Faq />);
    for (const button of screen.getAllByRole("button")) {
      expect(button.parentElement?.tagName).toBe("H3");
    }
  });
});
