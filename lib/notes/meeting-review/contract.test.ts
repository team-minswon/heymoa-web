import { describe, expect, it } from "vitest";

import {
  conceptSummarySchema,
  meetingApprovalSchema,
  meetingReviewSchema,
  reviewConflictSchema,
} from "@/lib/notes/meeting-review/contract";
import {
  sampleApproval,
  sampleConceptSummary,
  sampleReview,
} from "@/lib/notes/meeting-review/fixtures";

describe("meeting-review 임시 계약", () => {
  it("표본 셋이 제안 스키마를 통과한다", () => {
    expect(() => meetingReviewSchema.parse(sampleReview())).not.toThrow();
    expect(() => meetingApprovalSchema.parse(sampleApproval())).not.toThrow();
    expect(() => conceptSummarySchema.parse(sampleConceptSummary())).not.toThrow();
  });

  it("모르는 필드는 버리되 통과시킨다 — 배포 창의 완화", () => {
    const parsed = meetingReviewSchema.parse({
      ...sampleReview(),
      traceId: "나중에 붙을 수도 있는 것",
    });
    expect(parsed).not.toHaveProperty("traceId");
  });

  it("관계 kind 는 열린 문자열이다 — 모르는 값도 거절하지 않는다", () => {
    const review = sampleReview();
    const kinds = review.relations.map((relation) => relation.kind);
    expect(kinds).toContain("SOME_FUTURE_KIND");
    expect(() => meetingReviewSchema.parse(review)).not.toThrow();
  });

  it("사람 추가 항목은 originalProposalRef 가 null 이어야 한다", () => {
    const review = sampleReview();
    const human = review.items.find((item) => item.authoredBy.type === "USER");
    expect(human?.originalProposalRef).toBeNull();
    // 필드 자체가 빠지면 실패한다 — null 과 부재는 다르다.
    const broken = {
      ...review,
      items: review.items.map((item) => {
        const rest: Record<string, unknown> = { ...item };
        delete rest.originalProposalRef;
        return rest;
      }),
    };
    expect(meetingReviewSchema.safeParse(broken).success).toBe(false);
  });

  it("아는 필드의 깨진 값은 거절한다 — 준비 상태와 시각", () => {
    const review = sampleReview();
    expect(
      meetingReviewSchema.safeParse({
        ...review,
        readiness: { ...review.readiness, items: "PENDING" },
      }).success
    ).toBe(false);
    expect(
      meetingApprovalSchema.safeParse({
        ...sampleApproval(),
        approvedAt: "2026-09-01T20:00:00+09:00",
      }).success
    ).toBe(false);
  });

  it("409 봉투는 서버의 현재 값을 실어 온다", () => {
    const item = sampleReview().items[0];
    const parsed = reviewConflictSchema.parse({
      code: "ITEM_REVISION_CONFLICT",
      message: "다른 곳에서 먼저 바뀌었습니다.",
      currentReviewVersion: 5,
      current: { item },
    });
    expect(parsed.current?.item?.itemId).toBe(item.itemId);
  });
});
