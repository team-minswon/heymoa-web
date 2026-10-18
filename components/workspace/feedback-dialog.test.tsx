import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FeedbackDialog,
  composeFeedback,
} from "@/components/workspace/feedback-dialog";

const mutate = vi.fn();
let feedbacks: unknown[] = [];
let state: "ok" | "loading" | "error" = "ok";

vi.mock("@/components/auth/auth-provider", () => ({
  useAuthUserId: () => "u1",
}));
vi.mock("@/lib/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/api/generated/feedbacks/feedbacks", () => ({
  getGetMyFeedbacksQueryKey: () => ["feedbacks"],
  useCreateFeedback: () => ({ mutate, isPending: false }),
  useGetMyFeedbacks: () => ({
    isLoading: state === "loading",
    isError: state === "error",
    refetch: vi.fn(),
    data:
      state === "ok"
        ? { status: 200, data: { success: true, data: { feedbacks } } }
        : undefined,
  }),
}));

const answered = {
  feedbackId: "A",
  kind: "INCIDENT",
  message: "전사가 멈췄어요\n\n---\n화면: /w/1\n환경: x",
  answer: "고쳤습니다",
  answeredAt: "2026-10-17T09:30:00.000Z",
  createdAt: "2026-10-17T08:12:00.000Z",
};

describe("FeedbackDialog", () => {
  beforeEach(() => {
    mutate.mockReset();
    feedbacks = [];
    state = "ok";
    window.localStorage.clear();
  });
  afterEach(cleanup);

  it("내용이 비면 보내기를 막는다", () => {
    render(<FeedbackDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "보내기" })).toBeDisabled();
  });

  it("고른 분류와 내용을 화면 경로와 함께 서버로 보낸다", () => {
    window.history.replaceState({}, "", "/w/1/notes/2?view=full");
    render(<FeedbackDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /장애·오류/ }));
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "저장이 안 돼요" },
    });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    const { data } = mutate.mock.calls[0][0];
    expect(data.kind).toBe("INCIDENT");
    expect(data.message).toContain("저장이 안 돼요");
    expect(data.message).toContain("화면: /w/1/notes/2\n");
    expect(data.message).not.toContain("view=full");
  });

  it("글자 수를 보여 주고 1200자에서 멈춘다", () => {
    render(<FeedbackDialog open onOpenChange={vi.fn()} />);
    const box = screen.getByLabelText("내용");
    expect(box).toHaveAttribute("maxlength", "1200");
    fireEvent.change(box, { target: { value: "가나다" } });
    expect(screen.getByText("3 / 1200")).toBeTruthy();
  });

  it("내 문의 탭에 답변을 보여 주고 꼬리는 숨긴다", () => {
    feedbacks = [answered];
    render(<FeedbackDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText("새 답변 1개")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /내 문의/ }));

    expect(screen.getByText("답변 완료")).toBeTruthy();
    expect(screen.getByText("고쳤습니다")).toBeTruthy();
    expect(screen.getByText("전사가 멈췄어요")).toBeTruthy();
    expect(screen.queryByText(/환경: x/)).toBeNull();
    // 본 뒤에는 새 답변 표시가 사라진다.
    expect(screen.queryByLabelText("새 답변 1개")).toBeNull();
  });

  it("조회 중에는 빈 상태가 아니라 불러오는 중을 보여 준다", () => {
    state = "loading";
    render(<FeedbackDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /내 문의/ }));
    expect(screen.getByLabelText("내 문의를 불러오는 중")).toBeTruthy();
    expect(screen.queryByText("아직 보낸 문의가 없어요.")).toBeNull();
  });

  it("조회에 실패하면 빈 상태가 아니라 오류와 다시 시도를 보여 준다", () => {
    state = "error";
    render(<FeedbackDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /내 문의/ }));
    expect(screen.getByText("내 문의를 불러오지 못했어요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
    expect(screen.queryByText("아직 보낸 문의가 없어요.")).toBeNull();
  });

  it("보낸 문의가 없으면 빈 상태를 보여 준다", () => {
    render(<FeedbackDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /내 문의/ }));
    expect(screen.getByText("아직 보낸 문의가 없어요.")).toBeTruthy();
  });
});

describe("useFeedbackAnswers", () => {
  it("한 곳에서 읽으면 다른 곳의 새 답변 수도 바로 줄어든다", async () => {
    const { renderHook, act } = await import("@testing-library/react");
    const { useFeedbackAnswers } =
      await import("@/components/workspace/use-feedback-answers");
    window.localStorage.clear();
    feedbacks = [answered];
    const sidebar = renderHook(() => useFeedbackAnswers());
    const dialog = renderHook(() => useFeedbackAnswers());
    expect(sidebar.result.current.unseen).toBe(1);

    act(() => dialog.result.current.markSeen());

    expect(sidebar.result.current.unseen).toBe(0);
  });
});

describe("composeFeedback", () => {
  it("화면은 경로만 싣고 쿼리·회의 내용은 안 싣는다", () => {
    window.history.replaceState({}, "", "/w/1/notes/2?view=full&tab=summary");
    const text = composeFeedback("  안녕  ");
    expect(text.startsWith("안녕\n")).toBe(true);
    expect(text).toContain("화면: /w/1/notes/2\n");
    expect(text).not.toContain("view=full");
  });
});
