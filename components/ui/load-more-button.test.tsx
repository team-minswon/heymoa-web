import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LoadMoreButton } from "@/components/ui/load-more-button";

/**
 * jsdom 은 폭을 못 잰다 — 그래서 **두 상태의 버튼 안이 같은 모양인지**로 본다(rule `error-loading`, `landing-cta.test` 선례).
 * 문구가 「불러오는 중」으로 바뀌거나 아이콘이 빠지면 폭이 달라져 버튼이 출렁인다.
 */
describe("LoadMoreButton", () => {
  afterEach(cleanup);

  const shape = (button: HTMLElement) =>
    [...button.querySelectorAll("svg, span")].map((el) => `${el.tagName}:${el.textContent}`);

  it("불러오는 동안 문구는 그대로이고 화살표 자리만 spinner 로 바뀌어 눌리지 않는다", () => {
    const { rerender } = render(
      <LoadMoreButton loading={false} loadingLabel="이전 기록 불러오는 중">
        이전 기록 더 보기
      </LoadMoreButton>
    );
    const idle = screen.getByRole("button", { name: "이전 기록 더 보기" });
    const idleShape = shape(idle);
    expect(idle).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("");

    rerender(
      <LoadMoreButton loading loadingLabel="이전 기록 불러오는 중">
        이전 기록 더 보기
      </LoadMoreButton>
    );
    const busy = screen.getByRole("button", { name: "이전 기록 더 보기" });
    expect(shape(busy)).toEqual(idleShape);
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(busy.querySelector("svg")).toHaveClass("animate-spin");
    expect(screen.getByRole("status")).toHaveTextContent("이전 기록 불러오는 중");
  });
});
