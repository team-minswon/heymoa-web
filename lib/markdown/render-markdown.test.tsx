import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderMarkdown } from "@/lib/markdown/render-markdown";

function draw(source: string) {
  return render(<div data-testid="md">{renderMarkdown(source)}</div>);
}

describe("renderMarkdown", () => {
  it("문단을 <p>로 그린다", () => {
    draw("이번 회의는 배포 일정을 정했습니다.");
    const p = screen.getByText("이번 회의는 배포 일정을 정했습니다.");
    expect(p.tagName).toBe("P");
  });

  it("- 목록을 <ul>로 그린다", () => {
    const { container } = draw("- 첫째 항목\n- 둘째 항목");
    const ul = container.querySelector("ul");
    expect(ul).toBeTruthy();
    expect(within(ul!).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "첫째 항목",
      "둘째 항목",
    ]);
  });

  it("1. 목록을 <ol>로 그린다", () => {
    const { container } = draw("1. 준비\n2. 실행");
    const ol = container.querySelector("ol");
    expect(ol).toBeTruthy();
    expect(within(ol!).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "준비",
      "실행",
    ]);
  });

  it("빈 줄로 블록을 나눈다 — 문단과 목록이 섞여도 각각 그린다", () => {
    const { container } = draw("개요 문단입니다.\n\n- 액션 하나\n- 액션 둘");
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelectorAll("ul")).toHaveLength(1);
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
  });

  it("제목(#/##)을 heading으로 그린다 — 리터럴 마커를 보이지 않는다", () => {
    const { container } = draw("# 회의 개요\n\n출시 일정을 정했습니다.");
    const heading = screen.getByText("회의 개요");
    expect(heading.tagName).toMatch(/^H[1-6]$/);
    expect(container.textContent).not.toContain("#");
  });

  it("제목 + 목록이 한 덩이여도 각각 그린다", () => {
    const { container } = draw("## 액션 아이템\n- 배포 준비\n- QA 공유");
    expect(screen.getByText("액션 아이템").tagName).toMatch(/^H[1-6]$/);
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
  });

  it("빈 문자열은 아무것도 그리지 않는다", () => {
    const { container } = draw("");
    expect(container.querySelector('[data-testid="md"]')?.childElementCount).toBe(0);
  });
});
