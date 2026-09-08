import { describe, expect, it } from "vitest";

import { ITEM, RELATION, sampleReview } from "@/lib/notes/meeting-review/fixtures";
import { layoutRelationWeb } from "@/lib/notes/meeting-review/relation-web";
import { toReviewScreen } from "@/lib/notes/meeting-review/select";

function web(centerId: string) {
  const screen = toReviewScreen(sampleReview());
  return layoutRelationWeb(centerId, screen.itemsById, screen.relations, {
    width: 600,
    rowHeight: 50,
    minHeight: 100,
  });
}

describe("layoutRelationWeb", () => {
  it("가운데에 선택 항목, 왼쪽에 들어오는 끝점, 오른쪽에 나가는 끝점을 놓는다", () => {
    const layout = web(ITEM.decision)!;
    const sides = Object.fromEntries(layout.nodes.map((node) => [node.id, node.side]));
    expect(sides[`REVIEW:${ITEM.decision}`]).toBe("center");
    expect(sides[`REVIEW:${ITEM.issue}`]).toBe("left"); // issue → decision
    expect(sides[`REVIEW:${ITEM.action}`]).toBe("right"); // decision → action
    expect(sides["APPROVED:0HZX2K7M9R021"]).toBe("right"); // decision → previous approved
    expect(layout.nodes.find((node) => node.side === "center")?.x).toBe(300);
  });

  it("APPROVED 끝점은 이전 확정 내용을 라벨로 쓰고 reachable 이 아니다", () => {
    const layout = web(ITEM.decision)!;
    const previous = layout.nodes.find((node) => node.id === "APPROVED:0HZX2K7M9R021")!;
    expect(previous.label).toBe("출시일을 8월 말로 한다");
    expect(previous.kind).toBe("DECISION");
    expect(previous.reachable).toBe(false);
  });

  it("간선은 label · 근거 개수 · 판정만 싣고 kind 를 모른다", () => {
    const layout = web(ITEM.decision)!;
    const edge = layout.edges.find((candidate) => candidate.id === RELATION.decisionToAction)!;
    expect(edge).toMatchObject({
      label: "실행 항목을 만든다",
      citationCount: 1,
      judgement: "PROPOSED",
      stale: false,
    });
    expect(edge).not.toHaveProperty("kind");
    // 방향은 좌표로 드러난다: 가운데에서 오른쪽으로.
    expect(edge.x1).toBe(300);
    expect(edge.x2).toBeGreaterThan(300);
  });

  it("사람이 고친 표시 이름이 있으면 그것을 쓴다", () => {
    const screen = toReviewScreen(sampleReview());
    const relations = screen.relations.map((relation) =>
      relation.relationId === RELATION.decisionToAction
        ? { ...relation, judgement: { status: "MODIFIED" as const, label: "QA 를 앞당긴다" } }
        : relation
    );
    const layout = layoutRelationWeb(ITEM.decision, screen.itemsById, relations)!;
    expect(layout.edges.find((edge) => edge.id === RELATION.decisionToAction)?.label).toBe(
      "QA 를 앞당긴다"
    );
  });

  it("기각된 관계는 그리지 않고, 근거 없는 관계는 0 으로 그린다", () => {
    const screen = toReviewScreen(sampleReview());
    const relations = screen.relations.map((relation) =>
      relation.relationId === RELATION.issueToDecision
        ? { ...relation, judgement: { status: "REJECTED" as const } }
        : relation
    );
    const layout = layoutRelationWeb(ITEM.agenda, screen.itemsById, relations)!;
    // agenda → issue (근거 없음, 오래됨) 하나만 남는다.
    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0]).toMatchObject({ citationCount: 0, stale: true });
    const decisionLayout = layoutRelationWeb(ITEM.decision, screen.itemsById, relations)!;
    expect(decisionLayout.edges.map((edge) => edge.id)).not.toContain(RELATION.issueToDecision);
  });

  it("같은 두 항목 사이의 관계가 여럿이면 서로 다른 lane 을 받는다", () => {
    const screen = toReviewScreen(sampleReview());
    const base = screen.relations.find((relation) => relation.relationId === RELATION.issueToDecision)!;
    const relations = [
      ...screen.relations,
      // 같은 끝점을 반대 방향으로 잇는 둘째 관계.
      { ...base, relationId: "0HZX2K7M9R0ZZ", from: base.to, to: base.from, label: "되짚음" },
    ];
    const layout = layoutRelationWeb(ITEM.decision, screen.itemsById, relations)!;
    const pair = layout.edges.filter((edge) => [base.relationId, "0HZX2K7M9R0ZZ"].includes(edge.id));
    expect(pair).toHaveLength(2);
    expect(new Set(pair.map((edge) => edge.lane)).size).toBe(2);
    // 끝점이 다른 간선은 그대로 가운데다.
    expect(layout.edges.filter((edge) => !pair.includes(edge)).every((edge) => edge.lane === 0)).toBe(true);
  });

  it("여러 끝점은 세로로 고르게 놓이고 높이가 줄 수를 따라간다", () => {
    const layout = web(ITEM.decision)!;
    const right = layout.nodes.filter((node) => node.side === "right");
    expect(right).toHaveLength(2);
    expect(right[0].y).toBeLessThan(right[1].y);
    expect(layout.height).toBe(100); // max(minHeight, 2 rows × 50)
  });

  it("모르는 항목을 가운데에 두면 null 이다", () => {
    expect(web("0HZX2K7M9RZZZ")).toBeNull();
  });
});
