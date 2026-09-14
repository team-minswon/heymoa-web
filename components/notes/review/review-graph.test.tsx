import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewGraph } from "@/components/notes/review/review-graph";
import type { MeetingReviewResponseDataItemsItem } from "@/lib/api/generated/models";
import type { MeetingReviewSummary, SummaryTopic } from "@/lib/notes/review/summary";

function reviewItem(
  itemId: string,
  kind: MeetingReviewResponseDataItemsItem["kind"],
  over: Partial<MeetingReviewResponseDataItemsItem> = {}
): MeetingReviewResponseDataItemsItem {
  return {
    itemId,
    revision: 1,
    kind,
    content: itemId,
    included: true,
    edited: false,
    authoredByUserId: null,
    originalProposalRef: null,
    citations: [],
    assignee: null,
    due: null,
    replacements: [],
    taskChanges: [],
    ...over,
  };
}

function topic(ordinal: number, over: Partial<SummaryTopic>): SummaryTopic {
  return {
    ordinal,
    title: `주제 ${ordinal}`,
    agendaItemId: null,
    centerItemId: null,
    members: [],
    alsoItemIds: [],
    relations: [],
    sentences: [],
    outline: { decisions: [], actionItems: [], issues: [], observationItemIds: [] },
    openItemIds: [],
    signals: { itemCount: 0, conclusionCount: 0, openCount: 0, agendaSequence: null },
    ...over,
  };
}

const summary: MeetingReviewSummary = {
  noteId: "n",
  status: "SUCCEEDED",
  resultVersion: "v",
  headline: null,
  lead: [],
  topics: [
    topic(1, {
      title: "요금",
      centerItemId: "d1",
      members: [
        { itemId: "d1", kind: "DECISION", uncertain: false },
        { itemId: "a1", kind: "ACTION_ITEM", uncertain: false },
      ],
      relations: [
        { sourceItemId: "d1", targetItemId: "a1", kind: "LEADS_TO", label: "후속 할 일", reason: "", judgment: "PROPOSED" as const, evidence: [] },
      ],
    }),
  ],
};

const items = [
  reviewItem("d1", "DECISION", { content: "요금은 회의 시간 기준으로 계산한다" }),
  reviewItem("a1", "ACTION_ITEM", { content: "요금 계산표를 고친다" }),
  reviewItem("x", "ACTION_ITEM", { content: "뺀 항목", included: false }),
];

const FIT = "0 0 840 520";
// 한 번 확대(×1.25)하면 가운데를 둔 채 보이는 폭이 840/1.25 = 672 가 된다.
const ZOOMED = "84 52 672 416";

function renderGraph(onSelect = vi.fn()) {
  const view = render(
    <ReviewGraph summary={summary} items={items} selectedItemId={null} onSelect={onSelect} />
  );
  const viewBox = () =>
    screen.getByRole("group", { name: "주제별로 묶은 항목 그래프" }).getAttribute("viewBox");
  return { ...view, onSelect, viewBox };
}

describe("ReviewGraph", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("포함한 항목만 점으로 그리고, 누르거나 Enter·Space 로 그 항목을 고른다", () => {
    const { container, onSelect } = renderGraph();

    expect(container.querySelectorAll("[data-item-id]")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "할 일 요금 계산표를 고친다" }));
    expect(onSelect).toHaveBeenCalledWith("a1");

    const decision = screen.getByRole("button", { name: "결정 요금은 회의 시간 기준으로 계산한다" });
    fireEvent.keyDown(decision, { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith("d1");
    fireEvent.keyDown(screen.getByRole("button", { name: "할 일 요금 계산표를 고친다" }), { key: " " });
    expect(onSelect).toHaveBeenLastCalledWith("a1");
  });

  it("확대·축소 버튼이 보이는 영역을 바꾸고 맞춤이 처음으로 되돌린다", () => {
    const { viewBox } = renderGraph();

    expect(viewBox()).toBe(FIT);
    expect(screen.getByRole("button", { name: "축소" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "맞춤" })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "확대" }));
    expect(viewBox()).toBe(ZOOMED);

    fireEvent.click(screen.getByRole("button", { name: "맞춤" }));
    expect(viewBox()).toBe(FIT);
  });

  it("그래프에 초점이 있으면 + · − · 0 으로 확대하고 되돌린다", () => {
    const { viewBox } = renderGraph();
    const node = screen.getByRole("button", { name: "할 일 요금 계산표를 고친다" });

    fireEvent.keyDown(node, { key: "+" });
    expect(viewBox()).toBe(ZOOMED);
    fireEvent.keyDown(node, { key: "-" });
    expect(viewBox()).toBe(FIT);
    fireEvent.keyDown(node, { key: "+" });
    fireEvent.keyDown(node, { key: "0" });
    expect(viewBox()).toBe(FIT);
  });

  it("좁은 화면에서는 주제 이름 대신 번호만 남긴다", () => {
    const labelTexts = () =>
      [...document.querySelectorAll("[data-topic-label]")].map((node) => node.textContent?.trim());

    renderGraph();
    expect(labelTexts()).toEqual(["01 요금"]);
    cleanup();

    // 그려진 폭을 390px 로 알린다
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe() {
          this.callback([{ contentRect: { width: 390 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
        }
        disconnect() {}
        unobserve() {}
      }
    );
    renderGraph();
    expect(labelTexts()).toEqual(["01"]);
  });

  it("주제 묶음이 없으면 빈 그래프 대신 한 줄로 말한다", () => {
    render(
      <ReviewGraph
        summary={{ ...summary, status: "FAILED", topics: [] }}
        items={items}
        selectedItemId={null}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText("주제 묶음이 없어 그래프를 그릴 수 없습니다")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
