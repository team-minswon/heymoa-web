import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MeetingReview } from "@/components/notes/meeting-review/meeting-review";
import type { ReviewItem } from "@/lib/notes/meeting-review/select";

const state = vi.hoisted(() => ({
  review: null as null | { reviewVersion: number; items: unknown[] },
  missing: false,
  isLoading: false,
  update: vi.fn(),
  add: vi.fn(),
  create: vi.fn(),
  client: {
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
    cancelQueries: vi.fn().mockResolvedValue(undefined),
  },
  transcriptError: false,
  transcriptRefetch: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.client,
}));
vi.mock("@/lib/api/generated/meeting-review/meeting-review", () => ({
  getGetMeetingReviewQueryKey: (noteId: string) => ["review", noteId],
  useGetMeetingReview: () => ({
    isLoading: state.isLoading,
    refetch: vi.fn(),
    error: state.missing
      ? { success: false, data: null, error: { code: "MEETING_REVIEW_NOT_FOUND", message: "없음" } }
      : null,
    data: state.review
      ? { status: 200, data: { success: true, data: { noteId: "n", reviewId: "r", ...state.review } } }
      : undefined,
  }),
  useUpdateMeetingReviewItem: () => ({ mutateAsync: state.update, isPending: false }),
  useCreateMeetingReviewItem: () => ({ mutateAsync: state.add, isPending: false }),
  useCreateMeetingReview: () => ({ mutate: state.create, isPending: false }),
}));
vi.mock("@/lib/api/generated/transcription/transcription", () => ({
  useGetNoteTranscript: () => ({
    isLoading: false,
    isError: state.transcriptError,
    refetch: state.transcriptRefetch,
    data: state.transcriptError ? undefined : {
      status: 200,
      data: {
        success: true,
        data: {
          segments: [
            {
              segmentId: "seg-1",
              sequence: 1,
              text: "출시일을 9월 말로 확정합니다.",
              startedAtMs: 90_000,
              endedAtMs: 95_000,
              speakerLabel: "A",
              assignedParticipantId: null,
            },
          ],
        },
      },
    },
  }),
}));

function item(over: Partial<ReviewItem> & Pick<ReviewItem, "itemId" | "kind" | "content">): ReviewItem {
  return {
    revision: 3,
    included: true,
    edited: false,
    originalProposalRef: { proposalId: "p", revision: 1 },
    authoredByUserId: null,
    assigneeText: null,
    dueText: null,
    citations: [],
    ...over,
  };
}

const onEvidenceSelect = vi.fn();
function renderReview(canEdit = true) {
  return render(<MeetingReview noteId="n" canEdit={canEdit} onEvidenceSelect={onEvidenceSelect} />);
}

describe("MeetingReview", () => {
  beforeEach(() => {
    state.missing = false;
    state.isLoading = false;
    state.review = {
      reviewVersion: 7,
      items: [
        item({ itemId: "a", kind: "ACTION_ITEM", content: "QA 일정을 당긴다", assigneeText: "한지원" }),
        item({
          itemId: "d",
          kind: "DECISION",
          content: "출시일을 9월 말로 확정한다",
          citations: [{ role: "SUPPORTS", segmentId: "seg-1" }],
        }),
        item({ itemId: "x", kind: "DECISION", content: "제외된 결정", included: false }),
      ],
    };
    state.transcriptError = false;
    state.update.mockReset().mockResolvedValue({ data: { success: true, data: {} } });
    state.add.mockReset();
    state.create.mockReset();
  });
  afterEach(cleanup);

  it("결론 묶음 하나에 유형 차례로 서고, 제외는 접힌다", () => {
    renderReview();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);
    expect(headings).toEqual(["결론"]);
    const outcome = screen.getByRole("region", { name: "결론" });
    expect(within(outcome).getByText("2")).toBeInTheDocument();
    const visibleRows = within(outcome)
      .getAllByTestId("review-item")
      .filter((row) => !row.closest("[hidden]"));
    expect(visibleRows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("출시일을 9월 말로 확정한다"),
      expect.stringContaining("QA 일정을 당긴다"),
    ]);
    expect(screen.getByText("담당 한지원 · 기한 미정")).toBeInTheDocument();
    expect(screen.getByText("제외된 결정")).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "제외 1개 펼치기" }));
    expect(screen.getByText("제외된 결정")).toBeVisible();
    expect(screen.getByText("제외된 결정").closest("li")).toHaveAttribute("data-excluded");
  });

  it("참고는 처음부터 접혀 있고 머리글을 누르면 펼쳐진다", () => {
    state.review = {
      reviewVersion: 7,
      items: [item({ itemId: "s", kind: "STATUS_REPORT", content: "배포는 끝났다" })],
    };
    renderReview();
    expect(screen.getByText("배포는 끝났다")).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "참고" }));
    expect(screen.getByText("배포는 끝났다")).toBeVisible();
  });

  it("근거는 접힌 채 시작하고 누르면 전사 줄을 풀어 보인다", () => {
    renderReview();
    expect(screen.queryByText("출시일을 9월 말로 확정합니다.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /근거 1개/ }));
    fireEvent.click(screen.getByRole("button", { name: /출시일을 9월 말로 확정합니다\./ }));
    expect(onEvidenceSelect).toHaveBeenCalledWith("seg-1");
  });

  it("전사를 못 받았으면 근거 없음이 아니라 실패와 다시 시도를 보인다", () => {
    state.transcriptError = true;
    renderReview();
    fireEvent.click(screen.getByRole("button", { name: /근거 1개/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("전사를 불러오지 못했습니다.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(state.transcriptRefetch).toHaveBeenCalled();
  });

  it("수정은 Enter 로 저장하고 읽은 검토본·항목 버전을 함께 보낸다", async () => {
    renderReview();
    const row = screen.getByText("QA 일정을 당긴다").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "수정" }));
    const editor = screen.getByRole("textbox", { name: "항목 내용" });
    fireEvent.change(editor, { target: { value: "QA 일정을 셋째 주로 당긴다" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    // 저장이 textarea 를 비활성화하며 내는 blur 는 두 번째 저장이 아니다.
    fireEvent.blur(editor);
    expect(state.update).toHaveBeenCalledTimes(1);
    expect(state.update).toHaveBeenCalledWith({
      noteId: "n",
      itemId: "a",
      data: { content: "QA 일정을 셋째 주로 당긴다", expectedReviewVersion: 7, expectedItemRevision: 3 },
    });
    expect(await screen.findByText("QA 일정을 당긴다")).toBeInTheDocument();
  });

  it("편집 중 새 판이 와도 편집을 연 순간의 판으로 저장한다", () => {
    const view = renderReview();
    const row = screen.getByText("QA 일정을 당긴다").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "수정" }));
    // 폴링이 남의 변경을 받아 왔다 — 검토본 8판, 이 항목 4판.
    state.review = {
      reviewVersion: 8,
      items: [item({ itemId: "a", kind: "ACTION_ITEM", content: "QA 일정을 당긴다", revision: 4 })],
    };
    view.rerender(<MeetingReview noteId="n" canEdit onEvidenceSelect={onEvidenceSelect} />);
    const editor = screen.getByRole("textbox", { name: "항목 내용" });
    fireEvent.change(editor, { target: { value: "QA 일정을 넷째 주로 당긴다" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(state.update.mock.calls[0][0].data).toMatchObject({
      expectedReviewVersion: 7,
      expectedItemRevision: 3,
    });
  });

  it("충돌 뒤에는 초안을 지킨 채 최신 판 위에 다시 저장할 수 있다", async () => {
    state.update
      .mockRejectedValueOnce({
        success: false,
        data: null,
        error: { code: "MEETING_REVIEW_CONFLICT", message: "검토본이 변경되었습니다." },
      })
      .mockResolvedValueOnce({ status: 200, data: { success: true, data: {} } });
    const view = renderReview();
    const row = screen.getByText("QA 일정을 당긴다").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "수정" }));
    const editor = screen.getByRole("textbox", { name: "항목 내용" });
    fireEvent.change(editor, { target: { value: "QA 일정을 다섯째 주로 당긴다" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("검토본이 변경되었습니다.");
    // 거절은 최신 판 재조회를 기다린 뒤에야 줄에 닿는다.
    expect(state.client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["review", "n"] });
    // 거절 뒤 재조회가 최신 판을 가져왔다.
    state.review = {
      reviewVersion: 9,
      items: [item({ itemId: "a", kind: "ACTION_ITEM", content: "QA 일정을 남이 고쳤다", revision: 5 })],
    };
    view.rerender(<MeetingReview noteId="n" canEdit onEvidenceSelect={onEvidenceSelect} />);
    expect(screen.getByRole("alert")).toHaveTextContent("서버 값 「QA 일정을 남이 고쳤다」");
    expect(screen.getByRole("textbox", { name: "항목 내용" })).toHaveValue("QA 일정을 다섯째 주로 당긴다");
    // 버튼으로 포커스가 옮겨 가는 blur 는 저장하지 않는다 — 그러면 클릭이 죽는다.
    const retry = screen.getByRole("button", { name: "최신 판 위에 저장" });
    fireEvent.blur(screen.getByRole("textbox", { name: "항목 내용" }), { relatedTarget: retry });
    expect(state.update).toHaveBeenCalledTimes(1);
    fireEvent.click(retry);
    expect(state.update.mock.calls[1][0].data).toMatchObject({
      content: "QA 일정을 다섯째 주로 당긴다",
      expectedReviewVersion: 9,
      expectedItemRevision: 5,
    });
  });

  it("묶음을 접어도 거절된 편집기와 초안이 남는다", async () => {
    state.update.mockRejectedValue({
      success: false,
      data: null,
      error: { code: "MEETING_REVIEW_CONFLICT", message: "검토본이 변경되었습니다." },
    });
    renderReview();
    const row = screen.getByText("QA 일정을 당긴다").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "수정" }));
    const editor = screen.getByRole("textbox", { name: "항목 내용" });
    fireEvent.change(editor, { target: { value: "QA 일정을 여섯째 주로 당긴다" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "결론" }));
    await screen.findByRole("alert", { hidden: true });
    fireEvent.click(screen.getByRole("button", { name: "결론" }));
    expect(screen.getByRole("textbox", { name: "항목 내용" })).toHaveValue("QA 일정을 여섯째 주로 당긴다");
    expect(screen.getByRole("alert")).toHaveTextContent("검토본이 변경되었습니다.");
  });

  it("다른 창이 항목을 제외해도 열린 편집기는 그 자리에 남는다", () => {
    const view = renderReview();
    const row = screen.getByText("QA 일정을 당긴다").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByRole("textbox", { name: "항목 내용" }), {
      target: { value: "QA 일정을 일곱째 주로 당긴다" },
    });
    state.review = {
      reviewVersion: 8,
      items: [item({ itemId: "a", kind: "ACTION_ITEM", content: "QA 일정을 당긴다", included: false, revision: 4 })],
    };
    view.rerender(<MeetingReview noteId="n" canEdit onEvidenceSelect={onEvidenceSelect} />);
    expect(screen.getByRole("textbox", { name: "항목 내용", hidden: true })).toHaveValue(
      "QA 일정을 일곱째 주로 당긴다"
    );
  });

  it("거절되면 편집기를 닫지 않고 사유를 그 줄에 남긴다", async () => {
    state.update.mockRejectedValue({
      success: false,
      data: null,
      error: { code: "MEETING_REVIEW_CONFLICT", message: "검토본이 변경되었습니다." },
    });
    renderReview();
    const row = screen.getByText("QA 일정을 당긴다").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "제외" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("검토본이 변경되었습니다.");
  });

  it("시작자가 아니면 편집 컨트롤이 없다", () => {
    renderReview(false);
    expect(screen.queryByRole("button", { name: "수정" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "항목 추가" })).not.toBeInTheDocument();
  });

  it("검토본이 없으면 시작자에게만 만들기를 보인다", () => {
    state.review = null;
    state.missing = true;
    renderReview();
    fireEvent.click(screen.getByRole("button", { name: "검토본 만들기" }));
    expect(state.create).toHaveBeenCalledWith({ noteId: "n" });
    cleanup();
    renderReview(false);
    expect(screen.getByText("회의 시작자가 검토본을 만들면 여기에 보입니다.")).toBeInTheDocument();
  });
});
