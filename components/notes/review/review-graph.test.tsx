import { useImperativeHandle, type Ref } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewGraph } from "@/components/notes/review/review-graph";
import type { MeetingReviewResponseDataItemsItem } from "@/lib/api/generated/models";
import type { MeetingReviewSummary, SummaryTopic } from "@/lib/notes/review/summary";

type Props = Record<string, unknown> & { ref?: Ref<unknown> };

/**
 * 캔버스는 jsdom 에서 그려지지 않는다. 라이브러리 자리에 받은 속성과 API 만 남기는 대역을 둔다.
 * 그리기 콜백은 가짜 붓으로 불러 무엇을 적는지 본다.
 */
const forceGraph = vi.hoisted(() => ({
  props: null as Props | null,
  api: {
    zoom: vi.fn(() => 1),
    zoomToFit: vi.fn(),
    centerAt: vi.fn(),
    graph2ScreenCoords: vi.fn((x: number, y: number) => ({ x: 100 + x * 0, y: 100 + y * 0 })),
    d3Force: vi.fn(),
    d3ReheatSimulation: vi.fn(),
  },
}));

vi.mock("react-force-graph-2d", () => ({
  default: function ForceGraphDouble(props: Props) {
    forceGraph.props = props;
    useImperativeHandle(props.ref, () => forceGraph.api);
    return <canvas />;
  },
}));

let panelWidth = 840;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() {
        this.callback([{ contentRect: { width: panelWidth } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      disconnect() {}
      unobserve() {}
    }
  );
});

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

async function renderGraph(onSelect = vi.fn(), selectedItemId: string | null = null) {
  const view = render(
    <ReviewGraph summary={summary} items={items} selectedItemId={selectedItemId} onSelect={onSelect} />
  );
  // 캔버스는 브라우저에서만 불러온다(next/dynamic, ssr: false)
  await vi.waitFor(() => expect(forceGraph.props).not.toBeNull());
  return { ...view, onSelect };
}

const graphProps = () => forceGraph.props as Props & {
  graphData: { nodes: Array<{ id: string; hub: boolean; item: unknown; x: number; y: number }> };
  onNodeClick: (node: unknown) => void;
  onRenderFramePost: (ctx: CanvasRenderingContext2D, scale: number) => void;
};

/** 이름 그리기를 가짜 붓으로 돌려 적힌 글자를 모은다 */
function drawnLabels(scale = 1) {
  const texts: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, key) => (key === "fillText" ? (text: string) => texts.push(text) : target[key as string] ?? (() => {})),
    set: (target, key, value) => ((target[key as string] = value), true),
  });
  graphProps().onRenderFramePost(ctx as unknown as CanvasRenderingContext2D, scale);
  return texts;
}

describe("ReviewGraph", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    forceGraph.props = null;
    panelWidth = 840;
  });

  it("주제는 허브 점, 포함한 항목만 항목 점으로 넘긴다", async () => {
    await renderGraph();

    expect(graphProps().graphData.nodes.map((node) => [node.id, node.hub])).toEqual([
      ["topic:1", true],
      ["d1", false],
      ["a1", false],
    ]);
  });

  it("캔버스에서 항목을 누르면 그 항목을 고르고, 허브를 누르면 고르지 않고 판을 그리로 옮긴다", async () => {
    const { onSelect } = await renderGraph();
    const [hub, decision] = graphProps().graphData.nodes;

    graphProps().onNodeClick(decision);
    expect(onSelect).toHaveBeenCalledWith("d1");

    graphProps().onNodeClick(hub);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(forceGraph.api.centerAt).toHaveBeenCalledWith(hub.x, hub.y, 300);
  });

  it("캔버스를 못 쓰는 사람을 위해 같은 항목을 버튼 목록으로 두고, 누르면 고른다", async () => {
    const { onSelect } = await renderGraph(vi.fn(), "d1");

    const decision = screen.getByRole("button", { name: "결정 요금은 회의 시간 기준으로 계산한다" });
    expect(decision.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "할 일 요금 계산표를 고친다" }));
    expect(onSelect).toHaveBeenCalledWith("a1");
    expect(screen.queryByRole("button", { name: /뺀 항목/ })).toBeNull();
  });

  it("목록의 항목에 초점이 오면 그 항목의 설명 상자를 연다", async () => {
    await renderGraph();

    fireEvent.focus(screen.getByRole("button", { name: "할 일 요금 계산표를 고친다" }));

    expect(screen.getByRole("tooltip").textContent).toContain("01 요금");
    expect(screen.getByRole("tooltip").textContent).toContain("요금 계산표를 고친다");
  });

  it("확대 · 축소 · 맞춤 버튼과 + · − · 0 키가 판 배율을 바꾼다", async () => {
    await renderGraph();

    fireEvent.click(screen.getByRole("button", { name: "확대" }));
    expect(forceGraph.api.zoom).toHaveBeenLastCalledWith(1.25, 200);
    fireEvent.click(screen.getByRole("button", { name: "축소" }));
    expect(forceGraph.api.zoom).toHaveBeenLastCalledWith(0.8, 200);
    fireEvent.click(screen.getByRole("button", { name: "맞춤" }));
    expect(forceGraph.api.zoomToFit).toHaveBeenCalledTimes(1);

    const node = screen.getByRole("button", { name: "할 일 요금 계산표를 고친다" });
    fireEvent.keyDown(node, { key: "+" });
    expect(forceGraph.api.zoom).toHaveBeenLastCalledWith(1.25, 200);
    fireEvent.keyDown(node, { key: "0" });
    expect(forceGraph.api.zoomToFit).toHaveBeenCalledTimes(2);
  });

  it("주제는 늘 적되 멀리서 작은 주제는 번호만, 항목 이름은 확대했을 때만 적는다", async () => {
    await renderGraph();

    expect(drawnLabels(1)).toEqual(["01"]);
    expect(drawnLabels(1.5)).toEqual(["01 요금"]);
    expect(drawnLabels(3)).toEqual(expect.arrayContaining(["01 요금", "요금 계산표를 고친다"]));
  });

  it("좁은 화면에서는 주제 이름 대신 번호만 남긴다", async () => {
    panelWidth = 390;
    await renderGraph();

    expect(drawnLabels(1.5)).toEqual(["01"]);
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
