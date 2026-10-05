import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Steps } from "@/components/heymoa/landing/steps";

/**
 * 「작동 방식」은 앱 화면을 따라 그린 판이라, 앱이 바뀌면 여기가 거짓말을 한다. 옛 판이
 * 실제로 그랬다 — 회의 중 전사에 화자 이름을 그렸고, 요약을 개요 · 액션 아이템으로 갈랐다.
 * jsdom은 184px를 못 재니 여기서는 **어떤 말이 서 있는가**만 본다.
 */
describe("Steps", () => {
  afterEach(cleanup);

  it("앱의 말로 쓴다 — 옛 요약 라벨이 남지 않는다", () => {
    const { container } = render(<Steps />);
    const text = container.textContent ?? "";
    for (const stale of ["개요", "액션 아이템", "실시간 정리", "Linear 에 이슈를 만들까요"]) {
      expect(text).not.toContain(stale);
    }
    expect(text).toContain("요약 · 주제 · 결정 · 할 일");
  });

  it("회의 중 스크립트에는 화자가 없고 받아 적는 줄이 선다", () => {
    render(<Steps />);
    const card = screen.getByRole("heading", { name: "듣는 동안" }).parentElement!;
    expect(within(card).getByText("받아 적는 중")).toBeTruthy();
    for (const name of ["김민서", "박지훈", "이서연", "정우재"]) {
      expect(within(card).queryByText(name)).toBeNull();
    }
  });

  it("검토 막대의 숫자가 검토 문서의 개수와 같고, 막대는 흉내뿐이다", () => {
    render(<Steps />);
    const review = screen.getByRole("heading", { name: "끝나고 나면" }).parentElement!;
    const bar = screen.getByRole("heading", { name: "그 다음" }).parentElement!;
    expect(within(review).getByText("결정").textContent).toBe("결정2");
    expect(within(review).getByText("할 일").textContent).toBe("할 일2");
    expect(bar.textContent).toContain("결정 2개와 할 일 2개를 프로젝트에 올립니다");
    // 랜딩에서 아무 일도 안 하는 것은 버튼이 아니다
    expect(within(bar).queryAllByRole("button")).toHaveLength(0);
    expect(within(bar).getByText("검토 완료")).toBeTruthy();
  });
});
