import { beforeEach, describe, expect, it } from "vitest";

import {
  MockApiError,
  REVIEW_GENERATING_NOTE_ID,
  approveMeetingMock,
  createReviewItemMock,
  judgeRelationMock,
  markSummaryStale,
  readConceptSummary,
  readMeetingApproval,
  readMeetingReview,
  recheckRelationsMock,
  refreshConceptSummaryMock,
  resetMeetingReviewMock,
  updateReviewItemMock,
} from "@/lib/mocks/meeting-review";
import { meetingReviewSchema } from "@/lib/notes/meeting-review/contract";
import { ITEM, RELATION } from "@/lib/notes/meeting-review/fixtures";

const NOTE = "01K0000000022";
const STARTER = "user-12345";

function fail(run: () => unknown): MockApiError {
  try {
    run();
  } catch (error) {
    if (error instanceof MockApiError) return error;
    throw error;
  }
  throw new Error("실패해야 하는데 성공했다");
}

/** 시드의 모든 블로커를 푼다. 승인 검증의 전제다. */
function reviewEverything(noteId = NOTE) {
  let review = readMeetingReview(noteId, true);
  for (const itemId of review.approval.unreviewedItemIds) {
    const item = review.items.find((candidate) => candidate.itemId === itemId)!;
    const result = updateReviewItemMock(noteId, true, itemId, {
      expectedReviewVersion: review.reviewVersion,
      expectedItemRevision: item.revision,
      included: item.included,
    });
    review = { ...review, reviewVersion: result.reviewVersion };
  }
  review = readMeetingReview(noteId, true);
  for (const relation of review.relations) {
    if (relation.judgement.status !== "PROPOSED") continue;
    const result = judgeRelationMock(noteId, true, relation.relationId, {
      expectedReviewVersion: review.reviewVersion,
      expectedRelationRevision: relation.revision,
      judgement: "ACCEPTED",
    });
    review = { ...review, reviewVersion: result.reviewVersion };
  }
  review = readMeetingReview(noteId, true);
  if (review.relations.some((relation) => relation.stale)) {
    recheckRelationsMock(noteId, true, review.reviewVersion);
    readMeetingReview(noteId, true);
    readMeetingReview(noteId, true);
  }
  return readMeetingReview(noteId, true);
}

describe("meeting-review 목 저장소", () => {
  beforeEach(() => resetMeetingReviewMock());

  it("시드는 제안 계약을 통과하고 시작자가 아니면 NOT_MEETING_STARTER 가 막는다", () => {
    expect(() => meetingReviewSchema.parse(readMeetingReview(NOTE, true))).not.toThrow();
    const other = readMeetingReview("01K0000000021", false);
    expect(other.approval.blockers.map((blocker) => blocker.code)).toContain("NOT_MEETING_STARTER");
    expect(fail(() => updateReviewItemMock("01K0000000021", false, ITEM.issue, {
      expectedReviewVersion: other.reviewVersion,
      expectedItemRevision: 1,
      included: false,
    })).status).toBe(403);
  });

  it("검토본 버전이 맞지 않으면 409 이고 현재 버전을 실어 준다", () => {
    const review = readMeetingReview(NOTE, true);
    const error = fail(() =>
      updateReviewItemMock(NOTE, true, ITEM.decision, {
        expectedReviewVersion: review.reviewVersion - 1,
        expectedItemRevision: 1,
        content: "x",
      })
    );
    expect(error).toMatchObject({ status: 409, code: "REVIEW_VERSION_CONFLICT" });
    expect(error.extra.currentReviewVersion).toBe(review.reviewVersion);
  });

  it("항목 revision 충돌은 서버의 현재 항목을 실어 준다", () => {
    const review = readMeetingReview(NOTE, true);
    updateReviewItemMock(NOTE, true, ITEM.decision, {
      expectedReviewVersion: review.reviewVersion,
      expectedItemRevision: 1,
      content: "먼저 바꾼 사람",
    });
    const error = fail(() =>
      updateReviewItemMock(NOTE, true, ITEM.decision, {
        expectedReviewVersion: review.reviewVersion + 1,
        expectedItemRevision: 1,
        content: "늦게 바꾼 사람",
      })
    );
    expect(error.code).toBe("ITEM_REVISION_CONFLICT");
    expect((error.extra.current as { item: { content: string } }).item.content).toBe("먼저 바꾼 사람");
  });

  it("내용을 고치면 그 항목의 관계가 오래됨이 되고, 재검토가 두 번 조회 뒤에 푼다", () => {
    const review = readMeetingReview(NOTE, true);
    updateReviewItemMock(NOTE, true, ITEM.action, {
      expectedReviewVersion: review.reviewVersion,
      expectedItemRevision: 1,
      content: "QA 를 둘째 주로 당긴다",
    });
    let next = readMeetingReview(NOTE, true);
    const touched = next.relations.find((relation) => relation.relationId === RELATION.decisionToAction);
    expect(touched?.stale).toBe(true);
    expect(next.approval.blockers.map((blocker) => blocker.code)).toContain("STALE_RELATIONS");

    recheckRelationsMock(NOTE, true, next.reviewVersion);
    next = readMeetingReview(NOTE, true);
    expect(next.readiness.inMeetingRelations).toBe("GENERATING");
    next = readMeetingReview(NOTE, true);
    expect(next.readiness.inMeetingRelations).toBe("READY");
    expect(next.relations.every((relation) => !relation.stale)).toBe(true);
  });

  it("사람이 추가한 항목은 원본이 없고 영역에 들어간다", () => {
    const review = readMeetingReview(NOTE, true);
    const result = createReviewItemMock(NOTE, true, {
      expectedReviewVersion: review.reviewVersion,
      regionId: review.regions[1].regionId,
      kind: "DECISION",
      content: "추가한 결정",
    });
    expect(result.item?.originalProposalRef).toBeNull();
    expect(result.item?.authoredBy.type).toBe("USER");
    const next = readMeetingReview(NOTE, true);
    expect(next.regions[1].itemIds).toContain(result.item?.itemId);
  });

  it("미검토가 남아 있으면 승인이 409 이고 게이트를 실어 준다", () => {
    const review = readMeetingReview(NOTE, true);
    const error = fail(() =>
      approveMeetingMock(NOTE, true, STARTER, {
        idempotencyKey: "0HZX2K7M9RK01",
        reviewVersion: review.reviewVersion,
        projectApprovalVersion: review.projectApprovalVersion,
      })
    );
    expect(error.status).toBe(409);
    expect(error.code).toBe("UNREVIEWED_ITEMS");
    expect((error.extra.approval as { canApprove: boolean }).canApprove).toBe(false);
  });

  it("전부 검토하면 승인되고, 같은 키의 재전송은 같은 결과로 수렴한다", () => {
    const review = reviewEverything();
    expect(review.approval.canApprove).toBe(true);
    const input = {
      idempotencyKey: "0HZX2K7M9RK02",
      reviewVersion: review.reviewVersion,
      projectApprovalVersion: review.projectApprovalVersion,
    };
    const first = approveMeetingMock(NOTE, true, STARTER, input);
    const again = approveMeetingMock(NOTE, true, STARTER, input);
    expect(again.approvalVersion).toBe(first.approvalVersion);
    expect(readMeetingApproval(NOTE).items.map((item) => item.reviewItemId)).not.toContain(ITEM.excluded);
    expect(readMeetingReview(NOTE, true).approved?.approvalVersion).toBe(first.approvalVersion);
    // 승인 뒤 검토본 버전이 올라가 옛 버전의 승인은 충돌이다.
    expect(fail(() => approveMeetingMock(NOTE, true, STARTER, { ...input, idempotencyKey: "0HZX2K7M9RK03" })).code).toBe("REVIEW_VERSION_CONFLICT");
  });

  it("평가가 생성 중인 노트는 두 번 조회 뒤 준비된다", () => {
    expect(readMeetingReview(REVIEW_GENERATING_NOTE_ID, true).readiness.evaluation).toBe("GENERATING");
    expect(readMeetingReview(REVIEW_GENERATING_NOTE_ID, true).readiness.evaluation).toBe("READY");
  });

  it("개념 요약은 첫 조회가 생성을 시작하고, 갱신·승인이 상태를 돌린다", () => {
    const projectId = "01K0000000P02";
    expect(readConceptSummary(projectId, false).status).toBe("GENERATING");
    expect(fail(() => refreshConceptSummaryMock(projectId, false)).code).toBe("SUMMARY_GENERATING");
    readConceptSummary(projectId, false);
    const ready = readConceptSummary(projectId, false);
    expect(ready.status).toBe("READY");
    expect(ready.resultVersion).toBe("0HZX2K7M9RV01");

    markSummaryStale(projectId, 9);
    const stale = readConceptSummary(projectId, false);
    expect(stale.status).toBe("STALE");
    expect(stale.current?.approvalVersion).toBe(9);
    expect(stale.basis.approvalVersion).not.toBe(9);

    refreshConceptSummaryMock(projectId, false);
    readConceptSummary(projectId, false);
    readConceptSummary(projectId, false);
    const refreshed = readConceptSummary(projectId, false);
    expect(refreshed.status).toBe("READY");
    expect(refreshed.resultVersion).toBe("0HZX2K7M9RV02");
    expect(refreshed.basis.approvalVersion).toBe(9);
  });
});
