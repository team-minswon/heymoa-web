import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FeedbackDialog,
  composeFeedback,
  mailtoFor,
} from "@/components/workspace/feedback-dialog";

vi.mock("@/lib/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("FeedbackDialog", () => {
  afterEach(cleanup);

  it("내용이 비면 보내기를 막는다", () => {
    render(<FeedbackDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "내용 복사" })).toBeDisabled();
    expect(screen.getByText("메일 앱으로 보내기").closest("a")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("쓰면 문의 주소로 분류와 내용이 채워진 메일 링크가 된다", () => {
    render(<FeedbackDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "장애·오류" }));
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "저장이 안 돼요" },
    });

    const href = screen
      .getByRole("link", { name: /메일 앱으로 보내기/ })
      .getAttribute("href")!;
    expect(href.startsWith("mailto:team.minswon@gmail.com?")).toBe(true);
    expect(decodeURIComponent(href)).toContain("[HeyMoa 장애·오류]");
    expect(decodeURIComponent(href)).toContain("저장이 안 돼요");
  });

  it("글자 수를 보여 주고 1500자에서 멈춘다", () => {
    render(<FeedbackDialog open onOpenChange={vi.fn()} />);
    const box = screen.getByLabelText("내용");
    expect(box).toHaveAttribute("maxlength", "1500");
    fireEvent.change(box, { target: { value: "가나다" } });
    expect(screen.getByText("3 / 1500")).toBeTruthy();
  });
});

describe("composeFeedback", () => {
  it("화면은 경로만 싣고 쿼리·회의 내용은 안 싣는다", () => {
    window.history.replaceState({}, "", "/w/1/notes/2?view=full&tab=summary");
    const text = composeFeedback("사용 문의", "  안녕  ");
    expect(text.startsWith("안녕\n")).toBe(true);
    expect(text).toContain("화면: /w/1/notes/2\n");
    expect(text).not.toContain("view=full");
  });

  it("mailto 는 제목에 분류를 넣는다", () => {
    expect(decodeURIComponent(mailtoFor("기능 제안", "x"))).toContain(
      "subject=[HeyMoa 기능 제안]"
    );
  });
});
