import { describe, expect, it } from "vitest";

import type { MeetingReviewResponseDataItemsItem } from "@/lib/api/generated/models";
import { buildReviewGraph } from "@/lib/notes/review/graph-model";
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

const relation = (sourceItemId: string, targetItemId: string) => ({
  sourceItemId,
  targetItemId,
  kind: "ABOUT",
  label: "주제",
  reason: "",
  judgment: "PROPOSED" as const,
  evidence: [],
});

describe("buildReviewGraph 다른 주제 연결", () => {
  it("안건이 있으면 「다른 주제에도 속함」을 중심이 아니라 안건에서 잇는다", () => {
    const summary: MeetingReviewSummary = {
      noteId: "n",
      status: "SUCCEEDED",
      resultVersion: "v",
      headline: null,
      lead: [],
      topics: [
        topic(1, {
          agendaItemId: "g1",
          centerItemId: "a1",
          alsoItemIds: ["d1"],
          members: [
            { itemId: "g1", kind: "AGENDA", uncertain: false },
            { itemId: "a1", kind: "ACTION_ITEM", uncertain: false },
          ],
        }),
      ],
    };
    const graph = buildReviewGraph(summary, [
      reviewItem("g1", "AGENDA"),
      reviewItem("a1", "ACTION_ITEM"),
      reviewItem("d1", "DECISION"),
    ]);

    expect(graph.edges).toEqual([{ source: "g1", target: "d1", weight: 0.12, also: true }]);
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
      topics: [
        topic(1, {
          centerItemId: "d1",
          members: [
            { itemId: "d1", kind: "DECISION", uncertain: false },
            { itemId: "q1", kind: "QUESTION", uncertain: false },
            { itemId: "q2", kind: "QUESTION", uncertain: false },
            { itemId: "x", kind: "ACTION_ITEM", uncertain: false },
          ],
          openItemIds: ["q1"],
          relations: [relation("d1", "q1"), relation("q1", "d1"), relation("d1", "x")],
        }),
        topic(2, { centerItemId: "a1", alsoItemIds: ["d1"], members: [{ itemId: "a1", kind: "ACTION_ITEM", uncertain: false }] }),
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
    expect(graph.nodes.find((node) => node.id === "d1")?.center).toBe(true);
    // 양방향 관계는 선 하나, 제외 항목으로 가는 관계는 없다
    expect(graph.edges).toEqual([
      { source: "d1", target: "q1", weight: 1, also: false },
      { source: "a1", target: "d1", weight: 0.12, also: true },
    ]);
  });
});
