import { describe, expect, it } from "vitest";

import { ITEM, RELATION, sampleReview } from "@/lib/notes/meeting-review/fixtures";
import {
  directionFrom,
  needsPolling,
  presentRegion,
  toReviewScreen,
} from "@/lib/notes/meeting-review/select";

describe("toReviewScreen", () => {
  it("영역을 order 순으로 세우고 항목을 ID 로 찾아 넣는다", () => {
    const screen = toReviewScreen(sampleReview());
    expect(screen.regions.map((region) => region.title)).toEqual([
      "안건",
      "결정",
      "할 일",
      "이슈",
    ]);
    expect(screen.regions[1].items.map((item) => item.itemId)).toEqual([
      ITEM.decision,
      ITEM.excluded,
    ]);
  });

  it("영역에 안 들어간 항목은 unplaced 로 남긴다 — 사람 추가 항목이 그렇다", () => {
    const screen = toReviewScreen(sampleReview());
    expect(screen.unplacedItems.map((item) => item.itemId)).toEqual([ITEM.humanAdded]);
  });

  it("영역이 모르는 itemId 를 가리켜도 던지지 않고 건너뛴다", () => {
    const review = sampleReview();
    review.regions[0].itemIds.push("0HZX2K7M9RZZZ");
    expect(() => toReviewScreen(review)).not.toThrow();
    expect(toReviewScreen(review).regions[0].items).toHaveLength(1);
  });

  it("관계를 REVIEW 끝점마다 붙인다. APPROVED 끝점은 항목 색인에 안 들어간다", () => {
    const screen = toReviewScreen(sampleReview());
    expect(
      screen.relationsByItem.get(ITEM.decision)?.map((relation) => relation.relationId)
    ).toEqual([RELATION.decisionToAction, RELATION.issueToDecision, RELATION.projectReplace]);
    expect(screen.relationsByItem.has("0HZX2K7M9R021")).toBe(false);
  });

  it("미검토 집합과 개수는 서버 게이트에서 온다 — web 이 다시 계산하지 않는다", () => {
    const screen = toReviewScreen(sampleReview());
    expect([...screen.unreviewedItemIds]).toEqual([ITEM.issue, ITEM.humanAdded]);
    expect(screen.counts).toEqual({
      items: 6,
      excluded: 1,
      unreviewedItems: 2,
      unreviewedRelations: 3,
      staleRelations: 1,
    });
    expect(screen.approval.canApprove).toBe(false);
  });
});

describe("presentRegion · needsPolling · directionFrom", () => {
  it("여섯 상태를 네 갈래로 접는다", () => {
    expect(presentRegion("NOT_READY")).toEqual({ kind: "waiting", reason: "not-ready" });
    expect(presentRegion("GENERATING")).toEqual({ kind: "waiting", reason: "generating" });
    expect(presentRegion("EMPTY")).toEqual({ kind: "empty" });
    expect(presentRegion("FAILED")).toEqual({ kind: "failed" });
    expect(presentRegion("STALE")).toEqual({ kind: "ready", stale: true });
    expect(presentRegion("READY")).toEqual({ kind: "ready", stale: false });
  });

  it("기다리는 영역이 하나라도 있으면 폴링한다", () => {
    const readiness = sampleReview().readiness;
    expect(needsPolling(readiness)).toBe(false);
    expect(needsPolling({ ...readiness, evaluation: "GENERATING" })).toBe(true);
    expect(needsPolling({ ...readiness, projectRelations: "NOT_READY" })).toBe(true);
    // 실패·오래됨은 기다리는 것이 아니다.
    expect(needsPolling({ ...readiness, evaluation: "FAILED", items: "STALE" })).toBe(false);
  });

  it("항목 시점의 방향을 가른다", () => {
    const [derives] = sampleReview().relations;
    expect(directionFrom(ITEM.decision, derives)).toBe("outgoing");
    expect(directionFrom(ITEM.action, derives)).toBe("incoming");
    expect(directionFrom(ITEM.agenda, derives)).toBe("none");
  });
});
