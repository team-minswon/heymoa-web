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
  client: { setQueryData: vi.fn(), invalidateQueries: vi.fn() },
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

  it("kind 순서로 섹션을 세우고 개수와 메타를 적는다", () => {
    renderReview();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);
    expect(headings).toEqual(["결정", "할 일"]);
    expect(within(screen.getByRole("region", { name: "결정" })).getByText("2")).toBeInTheDocument();
    expect(screen.getByText("담당 한지원")).toBeInTheDocument();
    expect(screen.getByText("제외된 결정").closest("li")).toHaveAttribute("data-excluded");
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
    expect(state.update).toHaveBeenCalledWith({
      noteId: "n",
      itemId: "a",
      data: { content: "QA 일정을 셋째 주로 당긴다", expectedReviewVersion: 7, expectedItemRevision: 3 },
    });
    expect(await screen.findByText("QA 일정을 당긴다")).toBeInTheDocument();
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
