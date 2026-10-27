import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DueCell } from "@/components/heymoa/due-cell";
import { AddItemForm } from "@/components/notes/review/add-item-form";
import { ItemDetail } from "@/components/notes/review/item-detail";
import { ItemTrail } from "@/components/notes/review/item-trail";
import { groupMarks, MeetingMap } from "@/components/notes/review/meeting-map";
import { ReviewOverview } from "@/components/notes/review/review-overview";
import { ReviewRow } from "@/components/notes/review/review-row";
import { roleOfItem } from "@/components/notes/review/role-dot";
import { SectionBlock } from "@/components/notes/review/section-block";
import { ConfirmBar } from "@/components/notes/review/confirm-bar";
import {
  ReplacementSuggestion,
  TaskChangeSuggestion,
} from "@/components/notes/review/suggestion-row";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formatDueDate } from "@/lib/format/date";
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
  revisionsState.current = {
    data: undefined,
    isLoading: false,
    refetch: vi.fn(),
  };
});

const item = (over: Partial<ReviewItem> = {}): ReviewItem => ({
  itemId: "i1",
  revision: 1,
  kind: "DECISION",
  content: "요금은 회의 시간 기준으로 계산한다",
  included: true,
  projectSelected: true,
  edited: false,
  authoredByUserId: null,
  originalProposalRef: { proposalId: "p1", revision: 1 },
  citations: [],
  assignee: null,
  due: null,
  decisions: [],
  replacements: [],
  taskChanges: [],
  suggestedAssignment: null,
  ...over,
});

function renderRow(over: Partial<Parameters<typeof ReviewRow>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(true);
  render(
    <ReviewRow
      item={item()}
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

it("출처 회의가 삭제돼도 승계 결정과 사용자 선택은 남는다", () => {
  const onChoose = vi.fn();
  render(
    <ReplacementSuggestion
      newContent="새 결정 내용"
      replacement={{
        target: {
          itemId: "kept-decision",
          revision: 1,
          kind: "DECISION",
          content: "사용자가 유지한 프로젝트 결정",
          noteId: null,
          noteTitle: null,
          approvedAt: "2026-10-01T00:00:00Z",
          endedAt: null,
          originalProposalRef: null,
        },
        kind: "SUPERSEDES",
        label: "대체",
        reason: "사용자 검토가 필요합니다",
        decision: "KEEP",
      }}
      choice="keep"
      disabled={false}
      onChoose={onChoose}
    />
  );
  expect(screen.getAllByText("사용자가 유지한 프로젝트 결정")).toHaveLength(2);
  expect(screen.getByText(/프로젝트 결정 ·/)).toBeInTheDocument();
  expect(onChoose).not.toHaveBeenCalled();
});

it.each([
  { decision: "APPLY" as const, confirmed: false, pending: true },
  { decision: "APPLY" as const, confirmed: true, pending: false },
])(
  "$decision·confirmed=$confirmed 초안의 실제 반영 상태와 저장된 값을 표시한다",
  async ({ decision, confirmed, pending: isPending }) => {
    const onChoose = vi.fn().mockResolvedValue(true);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("unexpected request"));
    try {
      render(
        <QueryClientProvider client={new QueryClient()}>
          <TaskChangeSuggestion
            change={{
              target: {
                itemId: "task",
                revision: 1,
                originalProposalRef: null,
              },
              status: "CANCELLED",
              assignee: {
                value: { type: "USER", id: "old", name: "원래 제안 담당" },
              },
              due: { value: "2026-11-15" },
              reason: "기존 제안",
              decision,
              draft: {
                expectedRevision: 1,
                status: "COMPLETED",
                assignee: { value: { type: "USER", id: "saved" } },
                due: { value: "2026-12-31" },
              },
            }}
            task={{
              taskId: "task",
              projectId: "project",
              projectName: "프로젝트",
              revision: 1,
              content: "프로젝트 할 일",
              taskStatus: "OPEN",
              assignee: null,
              due: null,
              externalAgentChange: null,
            }}
            noteId="note"
            choices={[{ type: "USER", id: "saved", name: "저장한 담당" }]}
            choice="change"
            taskState="ready"
            onRetryTask={vi.fn()}
            disabled={false}
            confirmed={confirmed}
            onChoose={onChoose}
          />
        </QueryClientProvider>
      );
      const pending = screen.getByRole("radio", {
        name: isPending ? "반영 예정" : "반영됨",
      });
      expect(pending).toHaveAttribute("aria-checked", "true");
      if (isPending)
        expect(
          screen.queryByRole("radio", { name: "반영됨" })
        ).not.toBeInTheDocument();
      expect(screen.getByText("완료")).toBeInTheDocument();
      expect(screen.getByText("저장한 담당")).toBeInTheDocument();
      expect(screen.getByText(formatDueDate("2026-12-31"))).toBeInTheDocument();
      expect(screen.queryByText("원래 제안 담당")).not.toBeInTheDocument();
      fireEvent.click(pending);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(onChoose).not.toHaveBeenCalled();
      const keep = screen.getByRole("radio", { name: "넘기기" });
      if (isPending) {
        expect(keep).toBeEnabled();
        fireEvent.click(keep);
        await waitFor(() =>
          expect(onChoose).toHaveBeenCalledWith(
            "keep",
            expect.objectContaining({ expectedRevision: 1 })
          )
        );
      } else {
        expect(keep).toBeDisabled();
        fireEvent.click(keep);
        expect(onChoose).not.toHaveBeenCalled();
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  }
);

describe("ReviewRow", () => {
  it("반영 스위치는 내용을 펼치지 않고 선택만 저장합니다", () => {
    const onToggle = vi.fn();
    const { onSave } = renderRow({
      item: item({ projectSelected: false }),
      open: false,
      onToggle,
    });
    const toggle = screen.getByRole("switch", { name: /프로젝트에 추가/ });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(onSave).toHaveBeenCalledWith({ projectSelected: true });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("내용 편집은 Enter 로 저장하고 Esc 로 닫는다", async () => {
    const { onSave } = renderRow();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    const editor = screen.getByRole("textbox", { name: "항목 내용" });
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(
      screen.queryByRole("textbox", { name: "항목 내용" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByRole("textbox", { name: "항목 내용" }), {
      target: { value: "요금은 분 단위로 계산한다" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "항목 내용" }), {
      key: "Enter",
    });
    expect(onSave).toHaveBeenCalledWith({
      content: "요금은 분 단위로 계산한다",
    });
  });

  it("제외한 항목은 제외 취소만 두고, 사람이 더한 항목이라고 말한다", () => {
    const { onSave } = renderRow({
      item: item({ included: false, originalProposalRef: null }),
    });

    expect(
      screen.queryByRole("button", { name: "수정" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("제외됨 · 직접 추가")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "제외 취소" }));
    expect(onSave).toHaveBeenCalledWith({ included: true });
  });

  it("다른 항목이 저장 중이면 이 줄의 조작도 잠근다", () => {
    renderRow({ locked: true });
    expect(screen.getByRole("button", { name: "수정" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "제외" })).toBeDisabled();
  });

  it("고칠 수 없으면 조작을 두지 않고, 결정 줄에는 나온 때만 표시한다", () => {
    renderRow({ canEdit: false, whenMs: 75_000 });
    expect(
      screen.queryByRole("button", { name: "제외" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("차별점과 요금")).toBeNull();
    expect(screen.getByText("01:15")).toBeInTheDocument();
  });

  it("할 일 줄은 담당이 보는 사람 자신이면 「나」가 붙고, 기한이 없으면 기한 정하기가 선다", () => {
    renderRow({
      item: item({ kind: "ACTION_ITEM" }),
      assignable: true,
      mine: true,
    });
    expect(screen.getByText("나")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "기한 정하기" })
    ).toBeInTheDocument();
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
    expect(
      screen.getByText("직접 추가한 항목이라 회의 중 기록이 없습니다.")
    ).toBeInTheDocument();
  });

  it("불러오는 동안 자리를 잡고, 실패하면 다시 시도를 둔다", () => {
    revisionsState.current = {
      data: undefined,
      isLoading: true,
      refetch: vi.fn(),
    };
    const { rerender } = trail();
    expect(screen.getByLabelText("수정이력 불러오는 중")).toBeInTheDocument();

    const refetch = vi.fn();
    revisionsState.current = { data: undefined, isLoading: false, refetch };
    rerender(
      <ItemTrail
        noteId="n1"
        item={item()}
        segments={segments}
        resolveSpeaker={() => null}
        onOpenScript={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("스크립트를 불러오지 못했으면 단계마다 없다고 적지 않고 다시 시도만 둔다", () => {
    const onRetryScript = vi.fn();
    revisionsState.current = {
      data: {
        status: 200,
        data: { success: true, data: { proposalId: "p1", revisions: [] } },
      },
      isLoading: false,
      refetch: vi.fn(),
    };
    trail({ segments: [], scriptState: "failed", onRetryScript });

    expect(screen.queryByText("스크립트 없음")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetryScript).toHaveBeenCalled();
  });

  it("수정이력이 하나면 버전 pill을 숨깁니다", () => {
    revisionsState.current = {
      data: {
        status: 200,
        data: {
          success: true,
          data: {
            proposalId: "p1",
            revisions: [
              {
                revision: 1,
                operation: "CREATE",
                content: "처음 내용",
                citations: [],
              },
            ],
          },
        },
      },
      isLoading: false,
      refetch: vi.fn(),
    };
    trail({ item: item({ content: "처음 내용" }) });
    expect(screen.getByText("처음 내용")).toBeInTheDocument();
    expect(screen.queryByText("v1", { exact: true })).not.toBeInTheDocument();
  });

  it("모두 펼치기와 접기가 스크립트가 있는 단계 전체에 걸린다", () => {
    const revision = (
      n: number,
      operation: ProposalRevision["operation"],
      at: number
    ) =>
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
      data: {
        status: 200,
        data: {
          success: true,
          data: {
            proposalId: "p1",
            revisions: [revision(1, "CREATE", 0), revision(2, "AMEND", 2)],
          },
        },
      },
      isLoading: false,
      refetch: vi.fn(),
    };
    trail({ item: item({ content: "판 2" }) });

    expect(
      screen.getByRole("list", { name: "수정이력" }).querySelector("li")
    ).toHaveTextContent("v2");
    const toggles = screen.getAllByRole("button", { expanded: false });
    expect(toggles.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "모두 펼치기" }));
    expect(
      screen.getByRole("button", { name: "모두 접기" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "모두 접기" }));
    expect(
      screen.getByRole("button", { name: "모두 펼치기" })
    ).toBeInTheDocument();
  });
});

describe("AddItemForm", () => {
  it("종류가 여럿이면 골라서 Enter 로 더하고, 더해지면 비우며 Esc 로 닫는다", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const onCancel = vi.fn();
    render(
      <AddItemForm
        kinds={["ISSUE", "QUESTION"]}
        busy={false}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    const box = screen.getByRole("textbox", { name: "새 항목 내용" });
    expect(screen.getByRole("button", { name: "추가" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "질문" }));
    expect(box).toHaveAttribute("placeholder", "질문 내용");

    fireEvent.change(box, { target: { value: "  요금 기준은?  " } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("QUESTION", "요금 기준은?")
    );
    await waitFor(() => expect(box).toHaveValue(""));

    fireEvent.keyDown(box, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("거절되면 쓴 내용을 남기고, 보내는 중에는 다시 보내지 않는다", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    const { rerender } = render(
      <AddItemForm
        kinds={["DECISION"]}
        busy={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    const box = screen.getByRole("textbox", { name: "새 항목 내용" });
    fireEvent.change(box, { target: { value: "요금은 분 단위" } });
    fireEvent.submit(box.closest("form")!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(box).toHaveValue("요금은 분 단위");

    rerender(
      <AddItemForm
        kinds={["DECISION"]}
        busy
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    );
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("ReviewOverview", () => {
  it("요약이 오는 동안에는 없다고 먼저 말하지 않고 자리만 잡는다", () => {
    render(<ReviewOverview summary={null} pending />);
    expect(screen.getByLabelText("요약 불러오는 중")).toBeInTheDocument();
    expect(screen.queryByText(/주제 요약이 없습니다/)).not.toBeInTheDocument();
  });
});

describe("SectionBlock", () => {
  it("섹션마다 복사 버튼을 두지 않는다 — 복사는 화면 머리가 한 번에 한다", () => {
    render(
      <SectionBlock title="결정" count={1}>
        <p>내용</p>
      </SectionBlock>
    );
    expect(screen.queryByRole("button", { name: /복사/ })).toBeNull();
  });
});

describe("MeetingMap", () => {
  it("같은 때에 포개지는 표시는 한 묶음이고, 누를 때마다 묶음 안의 다음 항목으로 간다", () => {
    const onSelect = vi.fn();
    render(
      <MeetingMap
        lengthMs={3_600_000}
        chapters={[]}
        marks={[
          { itemId: "a", kind: "DECISION", atMs: 60_000, content: "가" },
          { itemId: "b", kind: "ACTION_ITEM", atMs: 60_000, content: "나" },
          { itemId: "c", kind: "DECISION", atMs: 1_800_000, content: "다" },
        ]}
        onSelect={onSelect}
      />
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAccessibleName("01:00 · 2개 · 결정 가 / 할 일 나");

    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[0]);
    expect(onSelect.mock.calls.map(([id]) => id)).toEqual(["a", "b", "a"]);
  });

  it("고정 칸 경계 양쪽에 걸친 가까운 표시도 한 묶음이다", () => {
    // 60분 회의의 8.99초와 9.01초는 같은 자리(0.25%)에 그려진다. 22초 간격도 640px 막대에서 4px 안쪽이다.
    const groups = groupMarks(
      [
        { itemId: "a", kind: "DECISION", atMs: 8_990, content: "가" },
        { itemId: "b", kind: "DECISION", atMs: 9_010, content: "나" },
        { itemId: "c", kind: "DECISION", atMs: 31_010, content: "다" },
        { itemId: "d", kind: "DECISION", atMs: 600_000, content: "라" },
      ],
      3_600_000
    );
    expect(groups.map((group) => group.map((mark) => mark.itemId))).toEqual([
      ["a", "b", "c"],
      ["d"],
    ]);
  });
});

describe("ConfirmBar", () => {
  it("확정하면 안 되는 까닭이 있으면 버튼을 막고 그 까닭을 적는다", () => {
    const summary = { newTasks: 1, endedDecisions: 0, changedTasks: 0 };
    const { rerender } = render(
      <ConfirmBar
        summary={summary}
        decisions={2}
        pending={false}
        blocked="기존 할 일에 반영하는 중입니다"
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "검토 완료" })).toBeDisabled();
    expect(
      screen.getByText("기존 할 일에 반영하는 중입니다")
    ).toBeInTheDocument();

    rerender(
      <ConfirmBar
        summary={summary}
        decisions={2}
        pending={false}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "검토 완료" })).toBeEnabled();
    expect(screen.getByText(/개 추가/)).toHaveTextContent(
      "결정 2개 · 할 일 1개 추가"
    );
  });

  it("고를 제안이 남았으면 그 수와 그 줄로 가는 링크를 세운다", () => {
    const onShowUnchosen = vi.fn();
    render(
      <ConfirmBar
        summary={{ newTasks: 1, endedDecisions: 0, changedTasks: 0 }}
        decisions={2}
        pending={false}
        blocked="고르지 않은 제안이 2개 남았습니다"
        unchosen={2}
        onShowUnchosen={onShowUnchosen}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText(/확인할 제안/)).toHaveTextContent(
      "확인할 제안 2개"
    );
    fireEvent.click(screen.getByRole("button", { name: "제안으로 가기" }));
    expect(onShowUnchosen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "검토 완료" })).toBeDisabled();
  });

  it("확정이 거절된 까닭은 사라지지 않고 확정 줄에 남는다", () => {
    render(
      <ConfirmBar
        summary={{ newTasks: 1, endedDecisions: 0, changedTasks: 0 }}
        decisions={0}
        pending={false}
        error="프로젝트 승인 기준이 변경되었습니다."
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "프로젝트 승인 기준이 변경되었습니다."
    );
  });
});

describe("ItemDetail", () => {
  it("여러 안건을 링크로 표시하고 선택한 안건을 엽니다", () => {
    const summary = {
      status: "SUCCEEDED",
      agendas: [
        {
          ordinal: 1,
          agendaId: "a",
          title: "요금 정책",
          members: [{ itemId: "i1", kind: "DECISION" }],
          relations: [],
          memberships: [{ itemId: "i1", secondary: false }],
        },
        {
          ordinal: 2,
          agendaId: "b",
          title: "출시 준비",
          members: [],
          relations: [],
          memberships: [{ itemId: "i1", secondary: true }],
        },
        {
          ordinal: 3,
          agendaId: "c",
          title: "관계없는 안건",
          members: [],
          relations: [],
          memberships: [],
        },
      ],
    } as unknown as MeetingReviewSummary;
    const onSelectAgenda = vi.fn();
    render(
      <ItemDetail
        item={item()}
        summary={summary}
        itemsById={new Map()}
        trail={<p>긴 발언 기록</p>}
        onSelectItem={vi.fn()}
        onSelectAgenda={onSelectAgenda}
      />
    );
    const connected = screen.getByRole("region", { name: "연결된 안건" });
    expect(connected).toHaveTextContent("요금 정책");
    expect(connected).toHaveTextContent("출시 준비");
    expect(connected).not.toHaveTextContent("관계없는 안건");
    fireEvent.click(screen.getByRole("link", { name: "출시 준비" }));
    expect(onSelectAgenda).toHaveBeenCalledWith("b");
  });

  it("관련 항목은 열 수 있는 것으로 거른 뒤 넷까지 세운다", () => {
    // 앞의 넷은 화면에 없는 항목이다. 먼저 자르면 뒤의 결정까지 사라진다.
    const others = ["h1", "h2", "h3", "h4", "d2"];
    const summary = {
      agendas: [
        {
          members: [{ itemId: "agenda", kind: "AGENDA" }],
          memberships: [],
          openItemIds: [],
          relations: others.map((targetItemId) => ({
            sourceItemId: "i1",
            targetItemId,
            label: "이어짐",
          })),
        },
      ],
    } as unknown as MeetingReviewSummary;
    const visible = item({
      itemId: "d2",
      content: "발표 자료에 출처를 함께 적는다",
    });
    const onSelectItem = vi.fn();
    render(
      <ItemDetail
        item={item()}
        summary={summary}
        itemsById={new Map([["d2", visible]])}
        trail={null}
        onSelectItem={onSelectItem}
      />
    );
    const link = screen.getByRole("button", {
      name: /이어짐.*발표 자료에 출처를 함께 적는다/,
    });
    expect(
      screen.getByRole("region", { name: "연결된 항목" }).querySelectorAll("li")
    ).toHaveLength(1);
    fireEvent.click(link);
    expect(onSelectItem).toHaveBeenCalledWith("d2");
  });
});

describe("roleOfItem", () => {
  const summary = {
    agendas: [{ openItemIds: ["open"] }],
  } as unknown as MeetingReviewSummary;

  it("미해결은 주제가 열린 채 남긴 이슈 · 질문뿐이다", () => {
    expect(roleOfItem({ itemId: "d", kind: "DECISION" }, summary)).toBe(
      "DECISION"
    );
    expect(roleOfItem({ itemId: "t", kind: "ACTION_ITEM" }, summary)).toBe(
      "ACTION"
    );
    expect(roleOfItem({ itemId: "open", kind: "ISSUE" }, summary)).toBe("OPEN");
    expect(roleOfItem({ itemId: "answered", kind: "QUESTION" }, summary)).toBe(
      "REFERENCE"
    );
    expect(roleOfItem({ itemId: "r", kind: "INSIGHT" }, null)).toBe(
      "REFERENCE"
    );
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
    const { container } = render(
      <DueCell value={null} editable onChange={vi.fn()} />
    );
    (
      container.querySelector("input[type=date]") as HTMLInputElement & {
        showPicker: () => void;
      }
    ).showPicker = showPicker;

    fireEvent.click(screen.getByRole("button", { name: "기한 정하기" }));
    expect(showPicker).toHaveBeenCalled();
  });
});

it("대체를 고르면 이전 결정에 취소선을 긋고 새 결정을 표시합니다", () => {
  const replacement: ReviewItem["replacements"][number] = {
    target: {
      itemId: "old",
      revision: 1,
      kind: "DECISION",
      content: "기존 요금 유지",
      noteId: null,
      noteTitle: null,
      originalProposalRef: null,
      approvedAt: "2026-09-04T00:00:00Z",
      endedAt: null,
    },
    kind: "SUPERSEDES",
    label: "대체",
    reason: "요금을 변경했습니다",
    decision: null,
  };
  const { rerender } = render(
    <ReplacementSuggestion
      replacement={replacement}
      newContent="새 요금 적용"
      choice="change"
      disabled={false}
      onChoose={vi.fn()}
    />
  );
  expect(screen.getByText("기존 요금 유지").tagName).toBe("DEL");
  expect(screen.getByRole("group", { name: "대체 후 모습" })).toHaveTextContent(
    "새 요금 적용"
  );
  rerender(
    <ReplacementSuggestion
      replacement={replacement}
      newContent="새 요금 적용"
      choice="keep"
      disabled={false}
      onChoose={vi.fn()}
    />
  );
  expect(
    screen
      .getAllByText("기존 요금 유지")
      .every((node) => node.tagName !== "DEL")
  ).toBe(true);
  expect(
    screen.getByRole("group", { name: "함께 유지할 결정" })
  ).toHaveTextContent("새 요금 적용");
});

it("이미 종료된 결정에는 대체·유지 선택을 표시하지 않습니다", () => {
  const replacement: ReviewItem["replacements"][number] = {
    target: {
      itemId: "old",
      revision: 1,
      kind: "DECISION",
      content: "종료된 결정",
      noteId: null,
      noteTitle: null,
      originalProposalRef: null,
      approvedAt: "2026-09-04T00:00:00Z",
      endedAt: "2026-09-05T00:00:00Z",
    },
    kind: "SUPERSEDES",
    label: "대체",
    reason: "",
    decision: "KEEP",
  };
  render(
    <ReplacementSuggestion
      replacement={replacement}
      newContent="새 결정"
      choice="keep"
      disabled={false}
      onChoose={vi.fn()}
    />
  );
  expect(screen.queryByRole("radiogroup")).toBeNull();
  expect(screen.getByText(/이미 종료됨/)).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "함께 유지할 결정" })).toBeNull();
});
