import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  claimEndFeedback,
  MeetingEndFeedback,
} from "@/components/notes/meeting-end-feedback";

const mutate = vi.fn();

vi.mock("@/components/auth/auth-provider", () => ({
  useAuthUserId: () => "u1",
}));
vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));
vi.mock("@/lib/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
let flowStatus: string | null = "ANALYZING";
let flowError = false;
vi.mock("@/lib/api/generated/analysis/analysis", () => ({
  useGetAnalysisFlow: () =>
    flowStatus === null
      ? { data: undefined, isError: true }
      : {
          data: {
            status: 200,
            data: { success: true, data: { status: flowStatus, regions: [] } },
          },
          isError: flowError,
        },
}));
vi.mock("@/lib/api/generated/feedbacks/feedbacks", () => ({
  getGetMyFeedbacksQueryKey: () => ["feedbacks"],
  useCreateFeedback: () => ({ mutate, isPending: false }),
}));

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

function renderCard(onClose = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MeetingEndFeedback noteId="n1" open onClose={onClose} />
    </QueryClientProvider>
  );
  return onClose;
}

const sent = () => mutate.mock.calls.at(-1)?.[0].data;

afterEach(() => {
  cleanup();
  mutate.mockReset();
  window.localStorage.clear();
});

describe("claimEndFeedback", () => {
  it("짧은 회의는 묻지 않고, 한 번 물으면 7일 쉰다", () => {
    const now = Date.UTC(2026, 9, 21);
    expect(claimEndFeedback("u1", 2 * MIN, now)).toBe(false);
    expect(claimEndFeedback("u1", 30 * MIN, now)).toBe(true);
    expect(claimEndFeedback("u1", 30 * MIN, now + 6 * DAY)).toBe(false);
    expect(claimEndFeedback("u1", 30 * MIN, now + 7 * DAY)).toBe(true);
    expect(claimEndFeedback(undefined, 30 * MIN, now + 30 * DAY)).toBe(false);
  });

  it("닫으면 14일, 묻지 않기를 누르면 다시 묻지 않는다", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    const now = Date.now();
    expect(claimEndFeedback("u1", 30 * MIN, now + 13 * DAY)).toBe(false);
    expect(claimEndFeedback("u1", 30 * MIN, now + 15 * DAY)).toBe(true);

    cleanup();
    renderCard();
    fireEvent.click(
      screen.getByRole("button", { name: "회의 후 의견 묻지 않기" })
    );
    expect(claimEndFeedback("u1", 30 * MIN, now + 400 * DAY)).toBe(false);
  });
});

describe("claimEndFeedback — 저장소", () => {
  it("저장소에 못 쓰면 묻지 않는다 — 간격과 묻지 않기를 지킬 수 없다", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(claimEndFeedback("u1", 30 * MIN)).toBe(false);
    setItem.mockRestore();
  });
});

describe("MeetingEndFeedback", () => {
  it("머리의 상태 줄이 분석 흐름을 따라 바뀐다", () => {
    flowStatus = "ANALYZING";
    renderCard();
    expect(screen.getByRole("status").textContent).toContain("정리하고 있어요");
    cleanup();
    flowStatus = "REVIEWABLE";
    renderCard();
    expect(screen.getByRole("status").textContent).toContain(
      "요약이 준비됐어요"
    );
    cleanup();
    flowStatus = "ANALYSIS_FAILED";
    renderCard();
    expect(screen.getByRole("status").textContent).toContain(
      "분석하지 못했어요"
    );
    cleanup();
    flowStatus = null;
    renderCard();
    expect(screen.getByRole("status").textContent).toContain(
      "불러오지 못했어요"
    );
    // 분석 중이던 데이터가 캐시에 남은 채 폴링이 실패해도 진행 중이라고 하지 않는다
    cleanup();
    flowStatus = "ANALYZING";
    flowError = true;
    renderCard();
    expect(screen.getByRole("status").textContent).toContain(
      "불러오지 못했어요"
    );
    flowError = false;
  });

  it("항목이나 글이 있어야 보내고, 고른 항목과 글을 함께 보낸다", () => {
    renderCard();
    const send = screen.getByRole("button", { name: "보내기" });
    expect(send).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("radio", { name: /녹음·소리/ }));
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "10분쯤 끊겼어요" },
    });
    fireEvent.click(send);

    expect(sent().kind).toBe("OTHER");
    expect(
      sent().message.startsWith("[회의 종료 후] 녹음·소리\n10분쯤 끊겼어요")
    ).toBe(true);
  });
});
