import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DueCell } from "@/components/heymoa/due-cell";
import { AddItemForm } from "@/components/notes/review/add-item-form";
import { ItemTrail } from "@/components/notes/review/item-trail";
import { ReviewOverview } from "@/components/notes/review/review-overview";
import { ReviewRow } from "@/components/notes/review/review-row";
import { roleOfItem } from "@/components/notes/review/role-dot";
import { SectionBlock } from "@/components/notes/review/section-block";
import { ConfirmBar } from "@/components/notes/review/confirm-bar";
import type { ProposalRevision } from "@/lib/api/generated/models";
import type { ReviewItem } from "@/lib/notes/review/sections";
import type { MeetingReviewSummary } from "@/lib/notes/review/summary";

const revisionsState = vi.hoisted(() => ({
  current: {
    data: undefined as unknown,
    isLoading: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/lib/api/generated/proposals/proposals", () => ({
  useGetProposalRevisions: () => revisionsState.current,
}));

afterEach(() => {
  cleanup();
  revisionsState.current = { data: undefined, isLoading: false, refetch: vi.fn() };
});

const item = (over: Partial<ReviewItem> = {}): ReviewItem => ({
  itemId: "i1",
  revision: 1,
  kind: "DECISION",
  content: "요금은 회의 시간 기준으로 계산한다",
  included: true,
  edited: false,
  authoredByUserId: null,
  originalProposalRef: { proposalId: "p1", revision: 1 },
  citations: [],
  assignee: null,
  due: null,
  replacements: [],
  taskChanges: [],
  ...over,
});

function renderRow(over: Partial<Parameters<typeof ReviewRow>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(true);
  render(
    <ReviewRow
      item={item()}
      topic={{ ordinal: 2, title: "차별점과 요금" }}
      assignable={false}
      open
      canEdit
      busy={false}
      conflict={false}
      fresh={false}
      choices={[]}
      onToggle={vi.fn()}
      onSave={onSave}
      onDismissConflict={vi.fn()}
      {...over}
    />
  );
  return { onSave };
}

describe("ReviewRow", () => {
  it("내용 편집은 Enter 로 저장하고 Esc 로 닫는다", async () => {
    const { onSave } = renderRow();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    const editor = screen.getByRole("textbox", { name: "항목 내용" });
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "항목 내용" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByRole("textbox", { name: "항목 내용" }), { target: { value: "요금은 분 단위로 계산한다" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "항목 내용" }), { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith({ content: "요금은 분 단위로 계산한다" });
  });

  it("제외한 항목은 제외 취소만 두고, 사람이 더한 항목이라고 말한다", () => {
    const { onSave } = renderRow({ item: item({ included: false, originalProposalRef: null }) });

    expect(screen.queryByRole("button", { name: "수정" })).not.toBeInTheDocument();
    expect(screen.getByText("제외됨 · 직접 추가")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "제외 취소" }));
    expect(onSave).toHaveBeenCalledWith({ included: true });
  });

  it("풀린 이슈는 담당 · 기한 대신 해결됨이 서고, 제안은 펼치지 않아도 선다", () => {
    renderRow({
      item: item({ kind: "ISSUE" }),
      assignable: true,
      resolved: true,
      open: false,
      suggestions: <p>이전 결정 대체 제안</p>,
    });
    expect(screen.getByText("해결됨")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "기한 정하기" })).not.toBeInTheDocument();
    expect(screen.getByText("이전 결정 대체 제안")).toBeInTheDocument();
  });

  it("다른 항목이 저장 중이면 이 줄의 조작도 잠근다", () => {
    renderRow({ locked: true });
    expect(screen.getByRole("button", { name: "수정" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "제외" })).toBeDisabled();
  });

  it("고칠 수 없으면 조작을 두지 않고 주제 번호는 두 자리다", () => {
    renderRow({ canEdit: false });
    expect(screen.queryByRole("button", { name: "제외" })).not.toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
  });
});

describe("ItemTrail", () => {
  const segments = [0, 1, 2].map((n) => ({
    segmentId: `s${n}`,
    sequence: n + 1,
    startedAtMs: n * 1000,
    endedAtMs: n * 1000 + 500,
    text: `line ${n}`,
    speakerLabel: "A",
    assignedParticipantId: null,
  }));
  const trail = (over: Partial<Parameters<typeof ItemTrail>[0]> = {}) =>
    render(
      <ItemTrail
        noteId="n1"
        item={item()}
        segments={segments}
        resolveSpeaker={() => null}
        onOpenScript={vi.fn()}
        {...over}
      />
    );

  it("직접 추가한 항목에는 회의 중 기록이 없다고 말한다", () => {
    trail({ item: item({ originalProposalRef: null }) });
    expect(screen.getByText("직접 추가한 항목이라 회의 중 기록이 없습니다.")).toBeInTheDocument();
  });

  it("불러오는 동안 자리를 잡고, 실패하면 다시 시도를 둔다", () => {
    revisionsState.current = { data: undefined, isLoading: true, refetch: vi.fn() };
    const { rerender } = trail();
    expect(screen.getByLabelText("수정 기록 불러오는 중")).toBeInTheDocument();

    const refetch = vi.fn();
    revisionsState.current = { data: undefined, isLoading: false, refetch };
    rerender(
      <ItemTrail noteId="n1" item={item()} segments={segments} resolveSpeaker={() => null} onOpenScript={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("스크립트를 불러오지 못했으면 단계마다 없다고 적지 않고 다시 시도만 둔다", () => {
    const onRetryScript = vi.fn();
    revisionsState.current = {
      data: { status: 200, data: { success: true, data: { proposalId: "p1", revisions: [] } } },
      isLoading: false,
      refetch: vi.fn(),
    };
    trail({ segments: [], scriptState: "failed", onRetryScript });

    expect(screen.queryByText("스크립트 없음")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetryScript).toHaveBeenCalled();
  });

  it("모두 펼치기와 접기가 스크립트가 있는 단계 전체에 걸린다", () => {
    const revision = (n: number, operation: ProposalRevision["operation"], at: number) =>
      ({
        proposalId: "p1",
        revision: n,
        operation,
        kind: "DECISION",
        status: "OPEN",
        closeReason: null,
        revisionSource: "LIVE",
        content: `판 ${n}`,
        createdSequence: 1,
        lastEvidenceSequence: 1,
        aiSemanticRevisionCount: 0,
        resolvesProposalId: null,
        citations: [{ ...segments[at], role: "SUPPORTS" }],
      }) as ProposalRevision;
    revisionsState.current = {
      data: { status: 200, data: { success: true, data: { proposalId: "p1", revisions: [revision(1, "CREATE", 0), revision(2, "AMEND", 2)] } } },
      isLoading: false,
      refetch: vi.fn(),
    };
    trail({ item: item({ content: "판 2" }) });

    const toggles = screen.getAllByRole("button", { expanded: false });
    expect(toggles.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "모두 펼치기" }));
    expect(screen.getByRole("button", { name: "모두 접기" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "모두 접기" }));
    expect(screen.getByRole("button", { name: "모두 펼치기" })).toBeInTheDocument();
  });
});

describe("AddItemForm", () => {
  it("종류가 여럿이면 골라서 Enter 로 더하고, 더해지면 비우며 Esc 로 닫는다", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const onCancel = vi.fn();
    render(<AddItemForm kinds={["ISSUE", "QUESTION"]} busy={false} onSubmit={onSubmit} onCancel={onCancel} />);

    const box = screen.getByRole("textbox", { name: "새 항목 내용" });
    expect(screen.getByRole("button", { name: "추가" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "질문" }));
    expect(box).toHaveAttribute("placeholder", "질문 내용");

    fireEvent.change(box, { target: { value: "  요금 기준은?  " } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("QUESTION", "요금 기준은?"));
    await waitFor(() => expect(box).toHaveValue(""));

    fireEvent.keyDown(box, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("거절되면 쓴 내용을 남기고, 보내는 중에는 다시 보내지 않는다", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    const { rerender } = render(
      <AddItemForm kinds={["DECISION"]} busy={false} onSubmit={onSubmit} onCancel={vi.fn()} />
    );
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    const box = screen.getByRole("textbox", { name: "새 항목 내용" });
    fireEvent.change(box, { target: { value: "요금은 분 단위" } });
    fireEvent.submit(box.closest("form")!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(box).toHaveValue("요금은 분 단위");

    rerender(<AddItemForm kinds={["DECISION"]} busy onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("ReviewOverview", () => {
  it("요약이 오는 동안에는 없다고 먼저 말하지 않고 자리만 잡는다", () => {
    render(<ReviewOverview summary={null} pending />);
    expect(screen.getByLabelText("개요 불러오는 중")).toBeInTheDocument();
    expect(screen.queryByText(/주제 요약이 없습니다/)).not.toBeInTheDocument();
  });
});

describe("SectionBlock", () => {
  it("복사를 누르면 그 순간 만든 마크다운을 클립보드에 넣고, 막혀 있으면 누를 수 없다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const build = vi.fn(() => "## 결정\n\n- 요금은 회의 시간 기준\n");

    const { rerender } = render(
      <SectionBlock title="결정" count={1} copy={{ build }}>
        <p>내용</p>
      </SectionBlock>
    );
    expect(build).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "복사" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("## 결정\n\n- 요금은 회의 시간 기준\n"));

    rerender(
      <SectionBlock title="결정" count={0} copy={{ build, disabled: true }}>
        <p>내용</p>
      </SectionBlock>
    );
    expect(screen.getByRole("button", { name: "복사" })).toBeDisabled();
  });
});

describe("ConfirmBar", () => {
  it("확정하면 안 되는 까닭이 있으면 버튼을 막고 그 까닭을 적는다", () => {
    const summary = { newTasks: 1, endedDecisions: 0, changedTasks: 0 };
    const { rerender } = render(
      <ConfirmBar summary={summary} pending={false} blocked="기존 할 일에 반영하는 중입니다" onConfirm={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "검토 완료" })).toBeDisabled();
    expect(screen.getByText("기존 할 일에 반영하는 중입니다")).toBeInTheDocument();

    rerender(<ConfirmBar summary={summary} pending={false} onConfirm={vi.fn()} />);
    expect(screen.getByRole("button", { name: "검토 완료" })).toBeEnabled();
  });

  it("확정이 거절된 까닭은 사라지지 않고 확정 줄에 남는다", () => {
    render(
      <ConfirmBar
        summary={{ newTasks: 1, endedDecisions: 0, changedTasks: 0 }}
        pending={false}
        error="프로젝트 승인 기준이 변경되었습니다."
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("프로젝트 승인 기준이 변경되었습니다.");
  });
});

describe("roleOfItem", () => {
  const summary = {
    topics: [{ openItemIds: ["open"] }],
  } as unknown as MeetingReviewSummary;

  it("미해결은 주제가 열린 채 남긴 이슈 · 질문뿐이다", () => {
    expect(roleOfItem({ itemId: "d", kind: "DECISION" }, summary)).toBe("DECISION");
    expect(roleOfItem({ itemId: "t", kind: "ACTION_ITEM" }, summary)).toBe("ACTION");
    expect(roleOfItem({ itemId: "open", kind: "ISSUE" }, summary)).toBe("OPEN");
    expect(roleOfItem({ itemId: "answered", kind: "QUESTION" }, summary)).toBe("REFERENCE");
    expect(roleOfItem({ itemId: "r", kind: "INSIGHT" }, null)).toBe("REFERENCE");
  });
});

describe("DueCell", () => {
  it("고칠 수 없으면 날짜만 쓰고 자리표시는 두지 않는다", () => {
    const { container } = render(<DueCell value={null} />);
    expect(container).toHaveTextContent("");
    cleanup();
    render(<DueCell value="2026-09-19" />);
    expect(screen.getByText("9월 19일 (토)")).toBeInTheDocument();
  });

  it("누르면 브라우저의 날짜 고르기를 연다", () => {
    const showPicker = vi.fn();
    const { container } = render(<DueCell value={null} editable onChange={vi.fn()} />);
    (container.querySelector("input[type=date]") as HTMLInputElement & { showPicker: () => void }).showPicker = showPicker;

    fireEvent.click(screen.getByRole("button", { name: "기한 정하기" }));
    expect(showPicker).toHaveBeenCalled();
  });
});
