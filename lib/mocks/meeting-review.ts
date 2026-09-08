import type {
  ApprovalGate,
  ConceptSummary,
  MeetingApproval,
  MeetingReview,
  RelationJudgement,
  ReviewItem,
  ReviewRelation,
} from "@/lib/notes/meeting-review/contract";
import {
  ITEM,
  sampleApproval,
  sampleConceptSummary,
  sampleReview,
} from "@/lib/notes/meeting-review/fixtures";

/**
 * 검토본·승인·개념 요약의 목 저장소. **제안 계약(`spec/APP-464/docs/openapi.yaml`)의
 * 형태를 그대로 흘린다** — 임의 필드를 더하면 파서 결함이 가려진다(APP-557 의 교훈).
 *
 * 시드는 `lib/notes/meeting-review/fixtures.ts` 하나다. 테스트와 목이 같은 표본을 쓴다.
 * 무작위값은 없다. 상태 전이(생성 중 → 준비, 충돌, 승인, 오래됨)를 여기서 결정적으로
 * 흉내내고, REST 핸들러는 HTTP 봉투만 입힌다.
 *
 * 특별 노트:
 * - `REVIEW_GENERATING_NOTE_ID` — 평가가 두 번 조회 뒤에 준비된다(폴링 검증)
 * - `REVIEW_FAILED_EVALUATION_NOTE_ID` — 평가 실패 · 프로젝트 관계 빈 결과
 * - 회의 시작자가 현재 사용자가 아닌 노트(`01K0000000021`)에서는 편집·승인이 403 이다
 */

export const REVIEW_GENERATING_NOTE_ID = "01K0000000023";
/** 처음부터 요약이 있는 프로젝트(`db.ts` 의 첫 프로젝트 「주간」). 나머지는 첫 조회가 생성을 시작한다. */
export const SUMMARY_READY_PROJECT_ID = "01K0000000001";
export const REVIEW_FAILED_EVALUATION_NOTE_ID = "01K0000000024";

/** 두 번 조회한 뒤 준비된다. 「끝나는 시각이 정해지지 않은 작업」을 짧게 흉내낸다. */
const GENERATING_POLLS = 2;

export class MockApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

type NoteState = {
  review: MeetingReview;
  approval: MeetingApproval | null;
  approvals: Map<string, MeetingApproval>;
  generatingPolls: number;
  recheckPolls: number;
  nextId: number;
};

type SummaryState = {
  summary: ConceptSummary;
  polls: number;
};

let notes = new Map<string, NoteState>();
let summaries = new Map<string, SummaryState>();

/**
 * MSW 브라우저 목의 핸들러는 페이지 메모리에서 돈다 — 새로고침이면 상태가 사라진다.
 * 「새로고침 뒤에도 저장된 검토본이 복원된다」를 e2e 로 보려면 서버 쪽 기억을 흉내내야
 * 하므로 `sessionStorage` 에 적는다. node(vitest)에는 없으니 그때는 메모리뿐이다.
 */
const STORAGE_KEY = "heymoa:mock:meeting-review";

function persist() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        notes: [...notes].map(([id, state]) => [id, { ...state, approvals: [...state.approvals] }]),
        summaries: [...summaries],
      })
    );
  } catch {
    // 저장 불가(용량·프라이빗 창)는 목의 기능이 아니라 무시한다.
  }
}

function restore() {
  if (typeof sessionStorage === "undefined" || notes.size > 0 || summaries.size > 0) return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      notes: [string, Omit<NoteState, "approvals"> & { approvals: [string, MeetingApproval][] }][];
      summaries: [string, SummaryState][];
    };
    notes = new Map(
      parsed.notes.map(([id, state]) => [id, { ...state, approvals: new Map(state.approvals) }])
    );
    summaries = new Map(parsed.summaries);
  } catch {
    // 깨진 저장은 버린다.
  }
}

export function resetMeetingReviewMock() {
  notes = new Map();
  summaries = new Map();
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(STORAGE_KEY);
}

export type SeedOptions = {
  /** 방금 끝난 회의. 명제 정리가 아직이라 회의 결과부터 기다린다(두 번 조회 뒤 준비). */
  justEnded?: boolean;
  /**
   * 이 노트의 실제 전사 segment ID. 표본의 인용을 여기에 얹어 근거 → 전사 이동이 목에서도
   * 실제 발화에 닿게 한다. 전사가 없는 노트는 표본 ID 그대로다(닿을 곳이 없다).
   */
  segmentIds?: readonly string[];
};

function seedNote(noteId: string, options: SeedOptions): NoteState {
  const review = sampleReview({ noteId });
  if (options.segmentIds && options.segmentIds.length > 0) {
    const ids = options.segmentIds;
    const bySequence = new Map<number, string>();
    const remap = <T extends { segmentId: string; sequence: number }>(citation: T): T => {
      const id = bySequence.get(citation.sequence) ?? ids[bySequence.size % ids.length];
      bySequence.set(citation.sequence, id);
      return { ...citation, segmentId: id };
    };
    review.items = review.items.map((item) => ({ ...item, citations: item.citations.map(remap) }));
    review.relations = review.relations.map((relation) => ({
      ...relation,
      citations: relation.citations.map(remap),
    }));
    review.evaluation = {
      ...review.evaluation,
      citations: review.evaluation.citations.map(remap),
      sections: review.evaluation.sections.map((section) => ({
        ...section,
        citations: section.citations.map(remap),
      })),
    };
  }
  if (options.justEnded) {
    review.readiness = {
      items: "GENERATING",
      evaluation: "NOT_READY",
      inMeetingRelations: "NOT_READY",
      projectRelations: "NOT_READY",
    };
  }
  if (noteId === REVIEW_GENERATING_NOTE_ID) {
    review.readiness = { ...review.readiness, evaluation: "GENERATING" };
    review.evaluation = { ...review.evaluation, status: "GENERATING", sections: [] };
  }
  if (noteId === REVIEW_FAILED_EVALUATION_NOTE_ID) {
    review.readiness = {
      ...review.readiness,
      evaluation: "FAILED",
      projectRelations: "EMPTY",
    };
    review.evaluation = {
      ...review.evaluation,
      status: "FAILED",
      sections: [],
      error: "평가 생성이 제한 시간을 넘겼습니다.",
    };
    review.relations = review.relations.filter((relation) => relation.layer !== "PROJECT");
  }
  return {
    review,
    approval: null,
    approvals: new Map(),
    generatingPolls: 0,
    recheckPolls: 0,
    nextId: 0,
  };
}

function stateOf(noteId: string, options: SeedOptions = {}): NoteState {
  restore();
  let state = notes.get(noteId);
  if (!state) {
    state = seedNote(noteId, options);
    notes.set(noteId, state);
  }
  return state;
}

/** 13자를 지킨다 — 접두 11자 + 두 자리. 한 노트에 99개까지면 목으로 충분하다. */
function newId(state: NoteState) {
  state.nextId += 1;
  return `0HZX2K7M9RN${String(state.nextId % 100).padStart(2, "0")}`;
}

/** 서버 판정을 흉내낸다. web 은 이 값을 다시 계산하지 않는다. */
function gateOf(review: MeetingReview, isStarter: boolean): ApprovalGate {
  const unreviewedItemIds = review.approval.unreviewedItemIds;
  const unreviewedRelationIds = review.relations
    .filter((relation) => relation.judgement.status === "PROPOSED")
    .map((relation) => relation.relationId);
  const staleRequired = review.relations
    .filter((relation) => relation.stale && relation.required)
    .map((relation) => relation.relationId);
  const generating =
    review.readiness.inMeetingRelations === "GENERATING" ||
    review.readiness.projectRelations === "GENERATING";

  const blockers: ApprovalGate["blockers"] = [];
  if (!isStarter) blockers.push({ code: "NOT_MEETING_STARTER" });
  if (unreviewedItemIds.length) blockers.push({ code: "UNREVIEWED_ITEMS", refs: unreviewedItemIds });
  if (unreviewedRelationIds.length) {
    blockers.push({ code: "UNREVIEWED_RELATIONS", refs: unreviewedRelationIds });
  }
  if (staleRequired.length) blockers.push({ code: "STALE_RELATIONS", refs: staleRequired });
  if (generating) blockers.push({ code: "RELATIONS_GENERATING" });

  return {
    canApprove: blockers.length === 0,
    blockers,
    unreviewedItemIds,
    unreviewedRelationIds,
  };
}

function refreshGate(state: NoteState, isStarter: boolean) {
  state.review.approval = gateOf(state.review, isStarter);
}

export function readMeetingReview(
  noteId: string,
  isStarter: boolean,
  options: SeedOptions = {}
): MeetingReview {
  const state = stateOf(noteId, options);
  const { review } = state;

  if (review.readiness.items === "GENERATING") {
    state.generatingPolls += 1;
    if (state.generatingPolls >= GENERATING_POLLS) {
      review.readiness = {
        items: "READY",
        evaluation: "READY",
        inMeetingRelations: "READY",
        projectRelations: "READY",
      };
      state.generatingPolls = 0;
    }
  } else if (review.readiness.evaluation === "GENERATING") {
    state.generatingPolls += 1;
    if (state.generatingPolls >= GENERATING_POLLS) {
      review.readiness = { ...review.readiness, evaluation: "READY" };
      review.evaluation = { ...sampleReview().evaluation, status: "READY" };
    }
  }
  if (review.readiness.inMeetingRelations === "GENERATING") {
    state.recheckPolls += 1;
    if (state.recheckPolls >= GENERATING_POLLS) {
      review.readiness = {
        ...review.readiness,
        inMeetingRelations: "READY",
        projectRelations: review.readiness.projectRelations === "EMPTY" ? "EMPTY" : "READY",
      };
      review.relations = review.relations.map((relation) => ({ ...relation, stale: false }));
      review.reviewVersion += 1;
    }
  }

  refreshGate(state, isStarter);
  persist();
  return structuredClone(review);
}

function assertStarter(isStarter: boolean) {
  if (!isStarter) {
    throw new MockApiError(403, "NOT_MEETING_STARTER", "회의 시작자만 검토를 저장할 수 있습니다.");
  }
}

function assertReviewVersion(state: NoteState, expected: number) {
  if (expected !== state.review.reviewVersion) {
    throw new MockApiError(409, "REVIEW_VERSION_CONFLICT", "검토본이 다른 곳에서 먼저 바뀌었습니다.", {
      currentReviewVersion: state.review.reviewVersion,
    });
  }
}

function markRelationsStale(review: MeetingReview, itemId: string) {
  review.relations = review.relations.map((relation) =>
    (relation.from.type === "REVIEW" && relation.from.itemId === itemId) ||
    (relation.to.type === "REVIEW" && relation.to.itemId === itemId)
      ? { ...relation, stale: true }
      : relation
  );
}

export type MutationResult = {
  reviewVersion: number;
  item?: ReviewItem;
  relation?: ReviewRelation;
  approval: ApprovalGate;
};

export function createReviewItemMock(
  noteId: string,
  isStarter: boolean,
  input: { expectedReviewVersion: number; regionId?: string; kind: string; content: string }
): MutationResult {
  assertStarter(isStarter);
  const state = stateOf(noteId);
  assertReviewVersion(state, input.expectedReviewVersion);

  const item: ReviewItem = {
    itemId: newId(state),
    revision: 1,
    originalProposalRef: null,
    kind: input.kind as ReviewItem["kind"],
    content: input.content,
    included: true,
    authoredBy: { type: "USER" },
    edited: true,
    stale: false,
    assigneeText: null,
    dueText: null,
    citations: [],
  };
  state.review.items.push(item);
  const region = state.review.regions.find((candidate) => candidate.regionId === input.regionId);
  if (region) region.itemIds.push(item.itemId);
  state.review.reviewVersion += 1;
  refreshGate(state, isStarter);
  persist();
  return {
    reviewVersion: state.review.reviewVersion,
    item: structuredClone(item),
    approval: structuredClone(state.review.approval),
  };
}

export function updateReviewItemMock(
  noteId: string,
  isStarter: boolean,
  itemId: string,
  input: {
    expectedReviewVersion: number;
    expectedItemRevision: number;
    content?: string;
    included?: boolean;
    assigneeText?: string | null;
    dueText?: string | null;
  }
): MutationResult {
  assertStarter(isStarter);
  const state = stateOf(noteId);
  const item = state.review.items.find((candidate) => candidate.itemId === itemId);
  if (!item) throw new MockApiError(404, "REVIEW_ITEM_NOT_FOUND", "검토 항목을 찾을 수 없습니다.");
  // 항목 충돌을 먼저 본다 — 서버의 현재 항목을 실어 줄 수 있어 화면이 대조를 그린다.
  if (input.expectedItemRevision !== item.revision) {
    throw new MockApiError(409, "ITEM_REVISION_CONFLICT", "이 항목이 다른 곳에서 먼저 바뀌었습니다.", {
      currentReviewVersion: state.review.reviewVersion,
      current: { item: structuredClone(item) },
    });
  }
  assertReviewVersion(state, input.expectedReviewVersion);

  if (input.content !== undefined && input.content !== item.content) {
    item.content = input.content;
    markRelationsStale(state.review, itemId);
  }
  if (input.included !== undefined) item.included = input.included;
  if (input.assigneeText !== undefined) item.assigneeText = input.assigneeText;
  if (input.dueText !== undefined) item.dueText = input.dueText;
  item.revision += 1;
  item.edited = true;
  item.stale = false;
  state.review.approval.unreviewedItemIds = state.review.approval.unreviewedItemIds.filter(
    (candidate) => candidate !== itemId
  );
  state.review.reviewVersion += 1;
  refreshGate(state, isStarter);
  persist();
  return {
    reviewVersion: state.review.reviewVersion,
    item: structuredClone(item),
    approval: structuredClone(state.review.approval),
  };
}

export function judgeRelationMock(
  noteId: string,
  isStarter: boolean,
  relationId: string,
  input: {
    expectedReviewVersion: number;
    expectedRelationRevision: number;
    judgement: Exclude<RelationJudgement["status"], "PROPOSED">;
    label?: string;
    note?: string | null;
  }
): MutationResult {
  assertStarter(isStarter);
  const state = stateOf(noteId);
  const relation = state.review.relations.find((candidate) => candidate.relationId === relationId);
  if (!relation) throw new MockApiError(404, "RELATION_NOT_FOUND", "관계를 찾을 수 없습니다.");
  if (input.expectedRelationRevision !== relation.revision) {
    throw new MockApiError(409, "RELATION_REVISION_CONFLICT", "이 관계가 다른 곳에서 먼저 바뀌었습니다.", {
      currentReviewVersion: state.review.reviewVersion,
      current: { relation: structuredClone(relation) },
    });
  }
  assertReviewVersion(state, input.expectedReviewVersion);

  relation.judgement = {
    status: input.judgement,
    label: input.judgement === "MODIFIED" ? (input.label ?? relation.label) : null,
    note: input.note ?? null,
  };
  relation.revision += 1;
  state.review.reviewVersion += 1;
  refreshGate(state, isStarter);
  persist();
  return {
    reviewVersion: state.review.reviewVersion,
    relation: structuredClone(relation),
    approval: structuredClone(state.review.approval),
  };
}

export function recheckRelationsMock(
  noteId: string,
  isStarter: boolean,
  expectedReviewVersion: number
) {
  assertStarter(isStarter);
  const state = stateOf(noteId);
  assertReviewVersion(state, expectedReviewVersion);
  if (state.review.readiness.inMeetingRelations === "GENERATING") {
    throw new MockApiError(409, "RECHECK_IN_PROGRESS", "이미 재검토 중입니다.");
  }
  state.review.readiness = { ...state.review.readiness, inMeetingRelations: "GENERATING" };
  state.recheckPolls = 0;
  refreshGate(state, isStarter);
  persist();
}

export function approveMeetingMock(
  noteId: string,
  isStarter: boolean,
  currentUserId: string,
  input: { idempotencyKey: string; reviewVersion: number; projectApprovalVersion: number | null }
): MeetingApproval {
  const state = stateOf(noteId);
  const replay = state.approvals.get(input.idempotencyKey);
  if (replay) return structuredClone(replay);

  if (!isStarter) {
    throw new MockApiError(403, "NOT_MEETING_STARTER", "회의 시작자만 승인할 수 있습니다.");
  }
  if (input.reviewVersion !== state.review.reviewVersion) {
    throw new MockApiError(409, "REVIEW_VERSION_CONFLICT", "검토본이 바뀌어 다시 확인해야 합니다.", {
      currentReviewVersion: state.review.reviewVersion,
      approval: structuredClone(state.review.approval),
    });
  }
  if ((input.projectApprovalVersion ?? null) !== state.review.projectApprovalVersion) {
    throw new MockApiError(409, "PROJECT_VERSION_CONFLICT", "프로젝트 승인 버전이 바뀌었습니다.", {
      currentProjectApprovalVersion: state.review.projectApprovalVersion,
      approval: structuredClone(state.review.approval),
    });
  }
  refreshGate(state, isStarter);
  const gate = state.review.approval;
  if (!gate.canApprove) {
    const first = gate.blockers[0];
    const code =
      first.code === "RELATIONS_GENERATING" || first.code === "NOT_MEETING_STARTER"
        ? "UNREVIEWED_RELATIONS"
        : first.code;
    throw new MockApiError(409, code, "아직 검토가 끝나지 않은 항목이 있습니다.", {
      approval: structuredClone(gate),
      currentReviewVersion: state.review.reviewVersion,
    });
  }

  const base = sampleApproval();
  const approval: MeetingApproval = {
    ...base,
    approvalVersion: (state.review.projectApprovalVersion ?? 0) + 1,
    approvedAt: "2026-09-08T12:00:00.000Z",
    approvedBy: currentUserId.length === 13 ? currentUserId : base.approvedBy,
    reviewVersion: state.review.reviewVersion,
    items: state.review.items
      .filter((item) => item.included)
      .map((item, index) => ({
        itemId: `0HZX2K7M9RA${String(index + 1).padStart(2, "0")}`,
        revision: 1,
        reviewItemId: item.itemId,
        kind: item.kind,
        content: item.content,
        originalProposalRef: item.originalProposalRef,
        assigneeText: item.assigneeText ?? null,
        dueText: item.dueText ?? null,
        citations: item.citations,
      })),
    relations: state.review.relations.filter(
      (relation) => relation.judgement.status !== "REJECTED"
    ),
    evaluationRef: {
      status: state.review.evaluation.status,
      resultVersion: state.review.evaluation.resultVersion,
    },
  };
  state.approval = approval;
  state.approvals.set(input.idempotencyKey, approval);
  state.review.approved = {
    approvalVersion: approval.approvalVersion,
    approvedAt: approval.approvedAt,
    approvedBy: approval.approvedBy,
  };
  state.review.projectApprovalVersion = approval.approvalVersion;
  state.review.reviewVersion += 1;
  persist();
  return structuredClone(approval);
}

export function readMeetingApproval(noteId: string): MeetingApproval {
  const state = stateOf(noteId);
  if (!state.approval) {
    throw new MockApiError(404, "MEETING_NOT_APPROVED", "아직 승인되지 않은 회의입니다.");
  }
  return structuredClone(state.approval);
}

/** 승인이 일어난 프로젝트의 요약을 오래됨으로 돌린다. server 가 기준 버전을 비교하는 것을 흉내낸다. */
export function markSummaryStale(projectId: string, approvalVersion: number) {
  const state = summaries.get(projectId);
  if (!state) return;
  state.summary = {
    ...state.summary,
    status: state.summary.status === "NONE" ? "NONE" : "STALE",
    current: { ...state.summary.basis, approvalVersion },
  };
  persist();
}

function summaryStateOf(
  projectId: string,
  seedReady: boolean,
  evidence: SummarySeedOptions["evidence"] = null
): SummaryState {
  restore();
  let state = summaries.get(projectId);
  if (!state) {
    const summary = seedReady
      ? bindSummaryEvidence(sampleConceptSummary({ projectId }), evidence)
      : sampleConceptSummary({
          projectId,
          status: "NONE",
          resultVersion: null,
          generatedAt: null,
          basis: { descriptionRevision: 1, approvalVersion: 0 },
          current: { descriptionRevision: 1, approvalVersion: 0 },
          sections: { purposeAndScope: [], concepts: [], direction: [], openIssues: [] },
        });
    state = { summary, polls: 0 };
    summaries.set(projectId, state);
  }
  return state;
}

/**
 * `seedReady` 가 거짓인 프로젝트는 첫 조회가 생성을 시작한다(NONE → GENERATING → READY).
 * 참이면 처음부터 READY 다. 어느 쪽인지는 핸들러가 프로젝트 순서로 정한다.
 */
export type SummarySeedOptions = {
  /** 근거가 가리킬 이 프로젝트의 실제 목 노트와 그 전사 segment. 없으면 표본 그대로다. */
  evidence?: { noteId: string; segmentIds: readonly string[] } | null;
};

/** 표본 요약의 근거를 실제 노트·전사에 얹는다. 링크와 인용이 목에서도 닿게. */
function bindSummaryEvidence(summary: ConceptSummary, evidence: SummarySeedOptions["evidence"]): ConceptSummary {
  if (!evidence || evidence.segmentIds.length === 0) return summary;
  const ids = evidence.segmentIds;
  const bySequence = new Map<number, string>();
  const remap = <T extends { segmentId: string; sequence: number }>(citation: T): T => {
    const id = bySequence.get(citation.sequence) ?? ids[bySequence.size % ids.length];
    bySequence.set(citation.sequence, id);
    return { ...citation, segmentId: id };
  };
  const sections = Object.fromEntries(
    Object.entries(summary.sections).map(([key, statements]) => [
      key,
      statements.map((statement) => ({
        ...statement,
        sources: statement.sources.map((source) =>
          source.type === "APPROVED_ITEM"
            ? { ...source, noteId: evidence.noteId, citations: source.citations?.map(remap) }
            : source
        ),
      })),
    ])
  ) as ConceptSummary["sections"];
  return { ...summary, sections };
}

export function readConceptSummary(
  projectId: string,
  seedReady: boolean,
  options: SummarySeedOptions = {}
): ConceptSummary {
  const state = summaryStateOf(projectId, seedReady, options.evidence);
  if (state.summary.status === "NONE") {
    state.summary = { ...state.summary, status: "GENERATING" };
    state.polls = 0;
    return structuredClone(state.summary);
  }
  if (state.summary.status === "GENERATING") {
    state.polls += 1;
    if (state.polls >= GENERATING_POLLS) {
      const ready = bindSummaryEvidence(sampleConceptSummary({ projectId }), options.evidence);
      state.summary = {
        ...ready,
        resultVersion: nextResultVersion(state.summary.resultVersion),
        basis: state.summary.current
          ? { ...ready.basis, ...state.summary.current }
          : ready.basis,
        current: state.summary.current ?? ready.current,
      };
    }
  }
  persist();
  return structuredClone(state.summary);
}

export function refreshConceptSummaryMock(projectId: string, seedReady: boolean) {
  const state = summaryStateOf(projectId, seedReady);
  if (state.summary.status === "GENERATING") {
    throw new MockApiError(409, "SUMMARY_GENERATING", "이미 생성 중입니다.");
  }
  state.summary = { ...state.summary, status: "GENERATING" };
  state.polls = 0;
  persist();
}

/** AI 의 결과 버전은 TSID 문자열이다(server 확인). 마지막 두 자리를 올려 다음 판을 만든다. */
function nextResultVersion(previous: string | null) {
  const n = previous ? Number.parseInt(previous.slice(-2), 10) + 1 : 1;
  return `0HZX2K7M9RV${String(n).padStart(2, "0")}`;
}

/** 테스트와 핸들러가 같은 항목 ID 를 가리키게 재수출한다. */
export { ITEM as REVIEW_ITEM_IDS };
