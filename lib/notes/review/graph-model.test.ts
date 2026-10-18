import { describe, expect, it } from "vitest";

import type { MeetingReviewResponseDataItemsItem } from "@/lib/api/generated/models";
import {
  buildReviewGraph,
  hubId,
  neighborsOf,
  nodeRadius,
  screenRadius,
  toForceGraph,
} from "@/lib/notes/review/graph-model";
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
    content: `${itemId} 내용`,
    included: true,
    edited: false,
    authoredByUserId: null,
    originalProposalRef: null,
    citations: [],
    assignee: null,
    due: null,
    replacements: [],
    taskChanges: [],
    suggestedAssignment: null,
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
    openItemIds: [],
    agendaId: null,
    summary: null,
    completed: true,
    description: [],
    conclusions: [],
    openItems: [],
    ...over,
  };
}

const relation = (sourceItemId: string, targetItemId: string) => ({
  sourceItemId,
  targetItemId,
  kind: "ABOUT",
  label: "주제",
});

describe("buildReviewGraph 다른 주제 연결", () => {
  it("둘 이상의 주제에 속한 항목은 첫 주제가 집이고 나머지 주제와는 약하게 잇는다", () => {
    const summary: MeetingReviewSummary = {
      noteId: "n",
      status: "SUCCEEDED",
      resultVersion: "v",
      headline: null,
      lead: [],
      topics: [],
      agendas: [
        topic(1, { members: [{ itemId: "a1", kind: "ACTION_ITEM" }] }),
        topic(2, { members: [{ itemId: "d1", kind: "DECISION" }, { itemId: "a1", kind: "ACTION_ITEM" }] }),
      ],
    };
    const graph = buildReviewGraph(summary, [reviewItem("a1", "ACTION_ITEM"), reviewItem("d1", "DECISION")]);

    expect(graph.nodes.map((node) => [node.id, node.group, node.alsoGroups])).toEqual([
      ["a1", 1, [2]],
      ["d1", 2, []],
    ]);
  });

  it("옛 요약이 alsoItemIds 에만 실은 다른 주제 소속도 약하게 잇는다", () => {
    const summary: MeetingReviewSummary = {
      noteId: "n",
      status: "SUCCEEDED",
      resultVersion: "v",
      headline: null,
      lead: [],
      topics: [],
      agendas: [
        topic(1, { members: [{ itemId: "a1", kind: "ACTION_ITEM" }] }),
        topic(2, { members: [{ itemId: "d1", kind: "DECISION" }], alsoItemIds: ["a1"] }),
      ],
    };
    const graph = buildReviewGraph(summary, [reviewItem("a1", "ACTION_ITEM"), reviewItem("d1", "DECISION")]);
    expect(graph.nodes.find((node) => node.id === "a1")?.alsoGroups).toEqual([2]);
  });

  it("앞 주제의 보조 소속(alsoItemIds)이 뒤 주제의 집을 빼앗지 않는다", () => {
    const summary: MeetingReviewSummary = {
      noteId: "n",
      status: "SUCCEEDED",
      resultVersion: "v",
      headline: null,
      lead: [],
      topics: [],
      agendas: [
        topic(1, { members: [{ itemId: "d1", kind: "DECISION" }], alsoItemIds: ["a1"] }),
        topic(2, { members: [{ itemId: "a1", kind: "ACTION_ITEM" }] }),
      ],
    };
    const graph = buildReviewGraph(summary, [reviewItem("a1", "ACTION_ITEM"), reviewItem("d1", "DECISION")]);
    const a1 = graph.nodes.find((node) => node.id === "a1");
    expect([a1?.group, a1?.alsoGroups]).toEqual([2, [1]]);
  });

  it("다른 주제에도 속한 항목만 남은 주제도 허브가 서고 점선이 닿는다", () => {
    const summary: MeetingReviewSummary = {
      noteId: "n",
      status: "SUCCEEDED",
      resultVersion: "v",
      headline: null,
      lead: [],
      topics: [],
      agendas: [
        topic(1, { members: [{ itemId: "a1", kind: "ACTION_ITEM" }] }),
        topic(2, { members: [{ itemId: "a1", kind: "ACTION_ITEM" }] }),
      ],
    };
    const { nodes, links } = toForceGraph(buildReviewGraph(summary, [reviewItem("a1", "ACTION_ITEM")]));
    expect(nodes.filter((node) => node.hub).map((node) => node.id)).toEqual([hubId(1), hubId(2)]);
    expect(links).toContainEqual({ source: hubId(2), target: "a1", kind: "also" });
  });
});

describe("buildReviewGraph", () => {
  it("제외한 항목을 빼고, 주제·색 역할·연결을 붙인다", () => {
    const summary: MeetingReviewSummary = {
      noteId: "n",
      status: "SUCCEEDED",
      resultVersion: "v",
      headline: null,
      lead: [],
      topics: [],
      agendas: [
        topic(1, {
          members: [
            { itemId: "d1", kind: "DECISION" },
            { itemId: "q1", kind: "QUESTION" },
            { itemId: "q2", kind: "QUESTION" },
            { itemId: "x", kind: "ACTION_ITEM" },
          ],
          openItemIds: ["q1"],
          relations: [relation("d1", "q1"), relation("q1", "d1"), relation("d1", "x")],
        }),
        // d1 은 주제 2 에도 속한다 — 첫 주제가 집이고 주제 2 와는 약하게 잇는다
        topic(2, { members: [{ itemId: "a1", kind: "ACTION_ITEM" }, { itemId: "d1", kind: "DECISION" }] }),
      ],
    };
    const graph = buildReviewGraph(summary, [
      reviewItem("d1", "DECISION"),
      reviewItem("q1", "QUESTION"),
      reviewItem("q2", "QUESTION"),
      reviewItem("x", "ACTION_ITEM", { included: false }),
      reviewItem("a1", "ACTION_ITEM"),
      reviewItem("loose", "INSIGHT"),
    ]);

    expect(graph.nodes.map((node) => [node.id, node.group, node.role])).toEqual([
      ["d1", 1, "DECISION"],
      ["q1", 1, "OPEN"],
      ["q2", 1, "REFERENCE"],
      ["a1", 2, "ACTION"],
      ["loose", null, "REFERENCE"],
    ]);
    expect(graph.nodes.find((node) => node.id === "d1")?.alsoGroups).toEqual([2]);
    // 양방향 관계는 선 하나, 제외 항목으로 가는 관계는 없다
    expect(graph.edges).toEqual([{ source: "d1", target: "q1" }]);
    // 다른 주제에도 속한 항목은 그 주제의 허브와 약하게 잇는다
    expect(toForceGraph(graph).links).toContainEqual({ source: "topic:2", target: "d1", kind: "also" });
  });
});

describe("toForceGraph", () => {
  const summary: MeetingReviewSummary = {
    noteId: "n",
    status: "SUCCEEDED",
    resultVersion: "v",
    headline: null,
    lead: [],
    topics: [],
    agendas: [
      topic(1, {
        title: "요금",
        members: [
          { itemId: "d1", kind: "DECISION" },
          { itemId: "a1", kind: "ACTION_ITEM" },
          { itemId: "a2", kind: "ACTION_ITEM" },
        ],
        relations: [relation("d1", "a1"), relation("d1", "a2")],
      }),
      topic(2, {
        title: "온보딩",
        members: [
          { itemId: "g2", kind: "AGENDA" },
          { itemId: "a1", kind: "ACTION_ITEM" },
        ],
      }),
      // 항목이 전부 제외된 주제는 허브도 없다
      topic(3, { members: [{ itemId: "x", kind: "DECISION" }] }),
    ],
  };
  const items = [
    reviewItem("d1", "DECISION"),
    reviewItem("a1", "ACTION_ITEM"),
    reviewItem("a2", "ACTION_ITEM"),
    reviewItem("g2", "AGENDA"),
    reviewItem("x", "DECISION", { included: false }),
    reviewItem("loose", "INSIGHT"),
  ];
  const force = () => toForceGraph(buildReviewGraph(summary, items));

  it("항목이 남은 주제마다 번호 붙은 허브를 두고, 주제 안 항목은 허브에 잇는다", () => {
    const { nodes, links } = force();

    expect(nodes.filter((node) => node.hub).map((node) => [node.id, node.label])).toEqual([
      [hubId(1), "01 요금"],
      [hubId(2), "02 온보딩"],
    ]);
    expect(links.filter((link) => link.kind === "hub")).toEqual([
      { source: hubId(1), target: "d1", kind: "hub" },
      { source: hubId(1), target: "a1", kind: "hub" },
      { source: hubId(1), target: "a2", kind: "hub" },
      { source: hubId(2), target: "g2", kind: "hub" },
    ]);
    // 주제 밖 항목은 허브 없이 관계선만 갖는다
    expect(links.some((link) => link.target === "loose" || link.source === "loose")).toBe(false);
  });

  it("항목 사이 관계와 「다른 주제에도 속함」은 종류를 갈라 그대로 옮긴다", () => {
    const { links } = force();

    expect(links.filter((link) => link.kind !== "hub")).toEqual([
      { source: "d1", target: "a1", kind: "relation" },
      { source: "d1", target: "a2", kind: "relation" },
      { source: hubId(2), target: "a1", kind: "also" },
    ]);
  });

  it("점 크기는 연결 수를 따르고, 허브는 같은 연결 수의 항목보다 크다", () => {
    const byId = new Map(force().nodes.map((node) => [node.id, node]));

    expect(byId.get("d1")?.degree).toBe(3);
    expect(byId.get("a1")?.degree).toBe(3);
    expect(byId.get("a2")?.degree).toBe(2);
    expect(byId.get("loose")?.degree).toBe(0);
    expect(byId.get(hubId(1))?.degree).toBe(3);
    expect(byId.get("d1")!.radius).toBeGreaterThan(byId.get("a2")!.radius);
    expect(byId.get("a2")!.radius).toBeGreaterThan(byId.get("loose")!.radius);
    expect(nodeRadius(3, true)).toBeGreaterThan(nodeRadius(3, false));
  });

  it("항목 점은 역할 색이 보일 만큼 크고, 허브가 항목을 압도하지 않는다", () => {
    expect(nodeRadius(0, false)).toBeGreaterThanOrEqual(5);
    expect(nodeRadius(60, true) / nodeRadius(3, false)).toBeLessThan(2.5);
  });

  it("그리는 크기는 화면 px 로 아래위를 묶어, 멀리서는 사라지지 않고 가까이서는 부풀지 않는다", () => {
    // 배율 0.4 에서 반지름 5 는 화면 2px — 색이 안 보인다. 화면 4px 은 넘게 그린다.
    expect(screenRadius(5, false, 0.4) * 0.4).toBeGreaterThanOrEqual(4);
    // 배율 8 에서 반지름 10 은 화면 80px. 화면 상한으로 묶는다.
    expect(screenRadius(10, false, 8) * 8).toBeLessThanOrEqual(16);
    expect(screenRadius(14, true, 8) * 8).toBeLessThanOrEqual(24);
    // 중간 배율은 제 크기 그대로다
    expect(screenRadius(6, false, 1.5)).toBe(6);
  });

  it("처음 좌표는 ID 로 정해져 같은 검토본은 열 때마다 같은 자리에서 시작한다", () => {
    const first = force().nodes.map(({ id, x, y }) => ({ id, x, y }));
    const second = force().nodes.map(({ id, x, y }) => ({ id, x, y }));

    expect(second).toEqual(first);
    expect(new Set(first.map(({ x, y }) => `${x},${y}`)).size).toBe(first.length);
    // 항목은 남의 허브보다 제 허브 가까이에서 시작한다
    const at = new Map(first.map((row) => [row.id, row]));
    const distance = (a: string, b: string) => Math.hypot(at.get(a)!.x - at.get(b)!.x, at.get(a)!.y - at.get(b)!.y);
    expect(distance("a2", hubId(1))).toBeLessThan(distance("a2", hubId(2)));
  });

  it("이웃은 양쪽으로 센다", () => {
    const neighbors = neighborsOf(force().links);

    expect([...neighbors.get("a1")!].sort()).toEqual(["d1", hubId(1), hubId(2)].sort());
    expect(neighbors.get(hubId(2))).toEqual(new Set(["g2", "a1"]));
    expect(neighbors.get("loose")).toBeUndefined();
  });
});


describe("회의 안 안건 이어짐", () => {
  const summary: MeetingReviewSummary = {
    noteId: "now", status: "SUCCEEDED", resultVersion: "v", headline: null, lead: [], topics: [],
    agendas: [
      topic(1, { agendaId: "ag1", title: "문제 정의", members: [{ itemId: "d1", kind: "DECISION" }] }),
      topic(2, { agendaId: "ag2", title: "해결 방안", members: [] }),
      topic(3, { agendaId: "ag3", title: "연결 없는 안건", members: [] }),
    ],
  };
  const previous = (noteId: string, agendaId: string) => ({ noteId, agendaId, title: "회의", agendaTitle: "안건" });
  const agendaLinks = new Map([
    ["ag2", [previous("now", "ag1"), previous("now", "ag1"), previous("past", "ag1"), previous("now", "missing"), previous("now", "ag2")]],
    ["missing", [previous("now", "ag1")]],
  ]);

  it("현재 회의의 앞선 안건에서 뒤 안건으로 한 번만 연결하고 다른 회의·미확인·자기 연결을 제외한다", () => {
    const graph = buildReviewGraph(summary, [reviewItem("d1", "DECISION")], agendaLinks);
    expect(graph.agendaEdges).toEqual([{ source: hubId(1), target: hubId(2) }]);
    const force = toForceGraph(graph);
    expect(force.links.filter((link) => link.kind === "agenda")).toEqual([{ source: hubId(1), target: hubId(2), kind: "agenda" }]);
    expect(force.nodes.filter((node) => node.hub).map((node) => node.id)).toEqual([hubId(1), hubId(2)]);
  });

  it("안건 연결이 늘어도 허브에 표시하는 항목 수를 부풀리지 않는다", () => {
    const { nodes } = toForceGraph(buildReviewGraph(summary, [reviewItem("d1", "DECISION")], agendaLinks));
    expect(nodes.find((node) => node.id === hubId(1))).toMatchObject({ degree: 2, memberCount: 1 });
    expect(nodes.find((node) => node.id === hubId(2))).toMatchObject({ degree: 1, memberCount: 0 });
  });
});
