import type {
  ConceptSummary,
  MeetingApproval,
  MeetingReview,
  ReviewCitation,
  ReviewItem,
  ReviewRelation,
} from "@/lib/notes/meeting-review/contract";

/**
 * 제안 계약(`docs/openapi.yaml`)의 예제 형태를 그대로 옮긴 고정 표본.
 *
 * 테스트와 MSW 시드가 **같은 표본**을 쓴다 — 둘이 갈리면 화면은 되는데 실제로는 안 되는
 * 목이 된다. 무작위값은 없다. 화면 상태를 전부 지나도록 다음이 하나씩 들어 있다:
 * 미검토 항목 · 사람 추가 항목(원본 null) · 제외된 항목 · 오래된 관계 · 근거 없는 관계 ·
 * 프로젝트 레벨 대체 제안 · 판정이 끝난 관계.
 */

export const REVIEW_NOTE_ID = "01K0000000001";
export const REVIEW_PROJECT_ID = "01K0000000P01";
export const REVIEW_STARTER_ID = "01J0000000001";

const T = (n: number) => `0HZX2K7M9R${String(n).padStart(3, "0")}`;
export const ITEM = {
  agenda: T(1),
  decision: T(2),
  action: T(3),
  issue: T(4),
  humanAdded: T(5),
  excluded: T(6),
} as const;
export const RELATION = {
  decisionToAction: T(11),
  issueToDecision: T(12),
  staleNoCitation: T(13),
  projectReplace: T(14),
} as const;
export const APPROVED_PREVIOUS = T(21);

function citation(sequence: number, text: string, speakerName: string | null): ReviewCitation {
  return {
    segmentId: `0HZX2K7M9Q${String(sequence).padStart(3, "0")}`,
    sequence,
    startedAtMs: sequence * 10_000,
    endedAtMs: sequence * 10_000 + 8_000,
    text,
    role: "SUPPORTS",
    speakerLabel: `S${(sequence % 3) + 1}`,
    speakerName,
  };
}

function item(over: Partial<ReviewItem> & Pick<ReviewItem, "itemId" | "kind" | "content">): ReviewItem {
  return {
    revision: 1,
    originalProposalRef: { proposalId: `0HZX2K7M9QA${over.itemId.slice(-2)}`, revision: 2 },
    included: true,
    authoredBy: { type: "AI" },
    edited: false,
    stale: false,
    assigneeText: null,
    dueText: null,
    citations: [citation(3, "출시일을 9월 말로 확정합니다.", "민형")],
    ...over,
  };
}

export function sampleItems(): ReviewItem[] {
  return [
    item({ itemId: ITEM.agenda, kind: "AGENDA", content: "출시 일정 재조정" }),
    item({
      itemId: ITEM.decision,
      kind: "DECISION",
      content: "출시일을 9월 말로 확정한다",
      citations: [citation(3, "출시일을 9월 말로 확정합니다.", "민형")],
    }),
    item({
      itemId: ITEM.action,
      kind: "ACTION_ITEM",
      content: "QA 일정을 9월 셋째 주로 당긴다",
      assigneeText: "QA 리드",
      dueText: "9월 셋째 주",
      citations: [citation(7, "QA는 셋째 주에 시작하죠.", null)],
    }),
    item({
      itemId: ITEM.issue,
      kind: "ISSUE",
      content: "결제 모듈 인증이 아직 안 끝났다",
      citations: [],
      stale: true,
    }),
    item({
      itemId: ITEM.humanAdded,
      kind: "INSIGHT",
      content: "사람이 덧붙인 항목",
      originalProposalRef: null,
      authoredBy: { type: "USER", userId: REVIEW_STARTER_ID },
      edited: true,
      citations: [],
    }),
    item({
      itemId: ITEM.excluded,
      kind: "STATUS_REPORT",
      content: "지난주 진행 보고",
      included: false,
      citations: [citation(1, "지난주 진행 상황입니다.", "서연")],
    }),
  ];
}

export function sampleRelations(): ReviewRelation[] {
  const review = (itemId: string, revision = 1) => ({ type: "REVIEW" as const, itemId, revision });
  return [
    {
      relationId: RELATION.decisionToAction,
      revision: 1,
      layer: "IN_MEETING",
      kind: "DERIVES_ACTION",
      label: "실행 항목을 만든다",
      definitionVersion: 1,
      from: review(ITEM.decision),
      to: review(ITEM.action),
      rationale: "출시일 확정에서 QA 일정 조정이 따라 나왔다",
      citations: [citation(7, "QA는 셋째 주에 시작하죠.", null)],
      judgement: { status: "PROPOSED" },
      stale: false,
      required: true,
      previousApproved: null,
      effect: null,
    },
    {
      relationId: RELATION.issueToDecision,
      revision: 1,
      layer: "IN_MEETING",
      kind: "CONDITIONS",
      label: "조건을 건다",
      definitionVersion: 1,
      from: review(ITEM.issue),
      to: review(ITEM.decision),
      rationale: "인증 완료가 출시일의 조건이다",
      citations: [citation(9, "인증이 끝나야 출시가 가능합니다.", "민형")],
      judgement: { status: "ACCEPTED" },
      stale: false,
      required: false,
      previousApproved: null,
      effect: null,
    },
    {
      relationId: RELATION.staleNoCitation,
      revision: 2,
      layer: "IN_MEETING",
      kind: "SOME_FUTURE_KIND",
      label: "근거 없는 연결",
      definitionVersion: 3,
      from: review(ITEM.agenda),
      to: review(ITEM.issue),
      rationale: "모델이 근거를 못 찾았다",
      citations: [],
      judgement: { status: "PROPOSED" },
      stale: true,
      required: false,
      previousApproved: null,
      effect: null,
    },
    {
      relationId: RELATION.projectReplace,
      revision: 1,
      layer: "PROJECT",
      kind: "SUPERSEDES",
      label: "이전 결정을 대체한다",
      definitionVersion: 1,
      from: review(ITEM.decision),
      to: { type: "APPROVED", itemId: APPROVED_PREVIOUS, revision: 3 },
      rationale: "이전 회의의 8월 말 출시 결정을 9월 말로 바꾼다",
      citations: [citation(3, "출시일을 9월 말로 확정합니다.", "민형")],
      judgement: { status: "PROPOSED" },
      stale: false,
      required: true,
      previousApproved: {
        itemId: APPROVED_PREVIOUS,
        revision: 3,
        kind: "DECISION",
        content: "출시일을 8월 말로 한다",
        approvedAt: "2026-08-20T09:00:00.000Z",
        noteId: "01K0000000002",
      },
      effect: { type: "SUPERSEDE", label: "이전 결정을 현재 목록에서 뺀다" },
    },
  ];
}

export function sampleReview(over: Partial<MeetingReview> = {}): MeetingReview {
  return {
    noteId: REVIEW_NOTE_ID,
    reviewVersion: 4,
    projectApprovalVersion: 2,
    readiness: {
      items: "READY",
      evaluation: "READY",
      inMeetingRelations: "READY",
      projectRelations: "READY",
    },
    regions: [
      { regionId: T(31), kind: "AGENDA", title: "안건", order: 0, itemIds: [ITEM.agenda] },
      {
        regionId: T(32),
        kind: "DECISION",
        title: "결정",
        order: 1,
        itemIds: [ITEM.decision, ITEM.excluded],
      },
      {
        regionId: T(33),
        kind: "ACTION_ITEM",
        title: "할 일",
        order: 2,
        itemIds: [ITEM.action],
      },
      { regionId: T(34), kind: "ISSUE", title: "이슈", order: 3, itemIds: [ITEM.issue] },
    ],
    items: sampleItems(),
    evaluation: {
      status: "READY",
      resultVersion: "0HZX2K7M9RE01",
      inputVersion: "in-1",
      generatedAt: "2026-09-01T10:05:00.000Z",
      stale: false,
      sections: [
        {
          title: "논의의 폭",
          body: "결정은 명확했지만 위험 검토가 짧았다.",
          citations: [citation(9, "인증이 끝나야 출시가 가능합니다.", "민형")],
          itemRefs: [{ type: "REVIEW", itemId: ITEM.issue, revision: 1 }],
        },
      ],
      limitations: "화자 한 명의 발화가 인식되지 않았다.",
      citations: [],
      error: null,
    },
    relations: sampleRelations(),
    approval: {
      canApprove: false,
      blockers: [
        { code: "UNREVIEWED_ITEMS", refs: [ITEM.issue, ITEM.humanAdded] },
        {
          code: "UNREVIEWED_RELATIONS",
          refs: [RELATION.decisionToAction, RELATION.projectReplace],
        },
        { code: "STALE_RELATIONS", refs: [RELATION.staleNoCitation] },
      ],
      unreviewedItemIds: [ITEM.issue, ITEM.humanAdded],
      unreviewedRelationIds: [
        RELATION.decisionToAction,
        RELATION.staleNoCitation,
        RELATION.projectReplace,
      ],
    },
    approved: null,
    ...over,
  };
}

export function sampleApproval(): MeetingApproval {
  return {
    approvalVersion: 3,
    approvedAt: "2026-09-01T11:00:00.000Z",
    approvedBy: REVIEW_STARTER_ID,
    reviewVersion: 9,
    items: sampleItems()
      .filter((entry) => entry.included)
      .map((entry, index) => ({
        itemId: T(41 + index),
        revision: 1,
        reviewItemId: entry.itemId,
        kind: entry.kind,
        content: entry.content,
        originalProposalRef: entry.originalProposalRef,
        assigneeText: entry.assigneeText ?? null,
        dueText: entry.dueText ?? null,
        citations: entry.citations,
      })),
    relations: sampleRelations().map((relation) => ({
      ...relation,
      judgement: { status: "ACCEPTED" },
      stale: false,
    })),
    analysisRef: { analysisId: "0K9GVJT2C4Q1Z" },
    evaluationRef: { status: "READY", resultVersion: "0HZX2K7M9RE01" },
  };
}

export function sampleConceptSummary(
  over: Partial<ConceptSummary> = {}
): ConceptSummary {
  return {
    projectId: REVIEW_PROJECT_ID,
    status: "READY",
    basis: { descriptionRevision: 2, approvalVersion: 3 },
    current: { descriptionRevision: 2, approvalVersion: 3 },
    resultVersion: "0HZX2K7M9RV01",
    generatedAt: "2026-09-01T11:05:00.000Z",
    error: null,
    sections: {
      purposeAndScope: [
        {
          text: "9월 말 출시를 목표로 결제 기능을 마무리한다.",
          sources: [{ type: "PROJECT_DESCRIPTION", descriptionRevision: 2 }],
        },
      ],
      concepts: [
        {
          term: "인증 게이트",
          text: "결제 모듈 인증 완료를 출시의 선행 조건으로 부르는 말.",
          sources: [
            {
              type: "APPROVED_ITEM",
              itemId: T(44),
              revision: 1,
              noteId: REVIEW_NOTE_ID,
              citations: [citation(9, "인증이 끝나야 출시가 가능합니다.", "민형")],
            },
          ],
        },
      ],
      direction: [
        {
          text: "출시일은 9월 말로 확정됐고 QA 는 셋째 주에 시작한다.",
          sources: [
            { type: "APPROVED_ITEM", itemId: T(42), revision: 1, noteId: REVIEW_NOTE_ID },
          ],
        },
      ],
      openIssues: [
        {
          text: "결제 모듈 인증 일정이 아직 없다.",
          sources: [
            { type: "APPROVED_ITEM", itemId: T(44), revision: 1, noteId: REVIEW_NOTE_ID },
          ],
        },
      ],
    },
    ...over,
  };
}
