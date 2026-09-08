import { z } from "zod";

import {
  proposalCitationSchema,
  proposalKindSchema,
  wireInstantSchema,
} from "@/lib/notes/proposals/contract";

/**
 * **임시 계약이다.** server public 계약(`openapi3-server.yml`)에 검토·승인·개념 요약
 * 경로가 아직 없다. 이 스키마는 docs
 * `projects/PRO-34-…/spec/APP-464/docs/openapi.yaml`(검토용 소비자 제안)을 옮긴 것이고,
 * 실제 계약이 docs 에 checkpoint 되면 미러 갱신 → `pnpm orval` → 생성 타입과 방향성
 * 가드로 묶는다. 절차는 `ADAPTER.md`.
 *
 * `z.object` 로 모르는 필드를 무시한다 — 배포 순서(ai → server → web)의 창을 버티는
 * 완화이고, 이유는 `lib/notes/proposals/contract.ts` 머리와 같다.
 *
 * 화면은 이 타입을 직접 읽지 않는다. `select.ts` 가 만든 화면용 타입만 읽는다 —
 * 계약이 제안과 달라져도 바뀌는 곳이 이 폴더 안에서 끝나게 하기 위해서다.
 */

const tsidSchema = z
  .string()
  .length(13)
  .regex(/^[0-9A-HJKMNP-TV-Z]{13}$/);

/** 영역별 준비 상태. 화면은 이것으로 spinner · 빈 상태 · 실패 · 오래됨을 가른다. */
export const regionStatusSchema = z.enum([
  "NOT_READY",
  "GENERATING",
  "READY",
  "EMPTY",
  "FAILED",
  "STALE",
]);

/** 관계·승인 효과의 끝점. APPROVED 는 승인 항목, REVIEW 는 검토 항목이다. */
export const itemRefSchema = z.object({
  type: z.enum(["APPROVED", "REVIEW"]),
  itemId: tsidSchema,
  /** revision 은 1부터다(server 확인). */
  revision: z.number().int().min(1),
});

/** 정본의 ProposalCitation 에 화자 이름·라벨이 얹힌다. 이름이 없으면 라벨만 그린다. */
export const reviewCitationSchema = proposalCitationSchema.extend({
  speakerLabel: z.string().nullable().optional(),
  speakerName: z.string().nullable().optional(),
});

export const originalProposalRefSchema = z.object({
  proposalId: tsidSchema,
  revision: z.number().int().min(1),
});

export const reviewItemSchema = z.object({
  itemId: tsidSchema,
  revision: z.number().int().min(1),
  /** 사람이 추가한 항목은 null 이다. 원본이 있어도 검토 항목 ID 로 대체하지 않는다. */
  originalProposalRef: originalProposalRefSchema.nullable(),
  kind: proposalKindSchema,
  content: z.string(),
  included: z.boolean(),
  authoredBy: z.object({
    type: z.enum(["AI", "USER"]),
    userId: tsidSchema.optional(),
  }),
  edited: z.boolean(),
  stale: z.boolean(),
  assigneeText: z.string().nullable().optional(),
  dueText: z.string().nullable().optional(),
  citations: z.array(reviewCitationSchema),
});

export const regionSchema = z.object({
  regionId: tsidSchema,
  /** 열린 문자열. web 은 분기하지 않고 제목만 그린다. */
  kind: z.string(),
  title: z.string(),
  order: z.number().int(),
  itemIds: z.array(tsidSchema),
});

/** AI 실행의 결과 버전은 TSID 문자열이다(server 확인). 숫자로 바꾸지 않는다. */
const resultVersionSchema = tsidSchema.nullable();

export const evaluationSchema = z.object({
  status: regionStatusSchema,
  resultVersion: resultVersionSchema,
  inputVersion: z.string().nullable().optional(),
  generatedAt: wireInstantSchema.nullable().optional(),
  stale: z.boolean(),
  sections: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
      citations: z.array(reviewCitationSchema),
      itemRefs: z.array(itemRefSchema),
    })
  ),
  limitations: z.string().nullable().optional(),
  citations: z.array(reviewCitationSchema),
  error: z.string().nullable().optional(),
});

export const relationJudgementSchema = z.object({
  status: z.enum(["PROPOSED", "ACCEPTED", "MODIFIED", "REJECTED"]),
  label: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export const relationSchema = z.object({
  relationId: tsidSchema,
  revision: z.number().int().min(1),
  layer: z.enum(["IN_MEETING", "PROJECT"]),
  /** 열린 문자열. server 도 web 도 분기하지 않는다. */
  kind: z.string(),
  label: z.string(),
  /** 양의 정수(server 확인). 의미가 바뀌면 오른다. web 은 보여만 준다. */
  definitionVersion: z.number().int().min(1),
  from: itemRefSchema,
  to: itemRefSchema,
  rationale: z.string(),
  citations: z.array(reviewCitationSchema),
  judgement: relationJudgementSchema,
  stale: z.boolean(),
  /** 판정이 끝나야 승인할 수 있는 관계. */
  required: z.boolean(),
  previousApproved: z
    .object({
      itemId: tsidSchema,
      revision: z.number().int().min(1),
      kind: proposalKindSchema,
      content: z.string(),
      approvedAt: wireInstantSchema,
      noteId: tsidSchema.optional(),
    })
    .nullable()
    .optional(),
  effect: z
    .object({ type: z.string(), label: z.string() })
    .nullable()
    .optional(),
});

export const approvalBlockerCodeSchema = z.enum([
  "UNREVIEWED_ITEMS",
  "UNREVIEWED_RELATIONS",
  "STALE_RELATIONS",
  "REQUIRED_RELATION_FAILED",
  "RELATIONS_GENERATING",
  "NOT_MEETING_STARTER",
]);

export const approvalGateSchema = z.object({
  /** server 판정. 버튼 활성의 근거이고 web 이 다시 계산하지 않는다. */
  canApprove: z.boolean(),
  blockers: z.array(
    z.object({
      code: approvalBlockerCodeSchema,
      refs: z.array(tsidSchema).optional(),
    })
  ),
  unreviewedItemIds: z.array(tsidSchema),
  unreviewedRelationIds: z.array(tsidSchema),
});

export const meetingReviewSchema = z.object({
  noteId: tsidSchema,
  /** 검토본 CAS. 저장마다 응답의 값으로 갱신한다. */
  reviewVersion: z.number().int().min(0),
  /** 비교한 프로젝트 승인 버전. 승인본이 없으면 null 이다 — 0 을 사실처럼 만들지 않는다(server 확인). */
  projectApprovalVersion: z.number().int().min(1).nullable(),
  readiness: z.object({
    items: regionStatusSchema,
    evaluation: regionStatusSchema,
    inMeetingRelations: regionStatusSchema,
    projectRelations: regionStatusSchema,
  }),
  regions: z.array(regionSchema),
  items: z.array(reviewItemSchema),
  evaluation: evaluationSchema,
  relations: z.array(relationSchema),
  approval: approvalGateSchema,
  approved: z
    .object({
      approvalVersion: z.number().int().min(1),
      approvedAt: wireInstantSchema,
      approvedBy: tsidSchema,
    })
    .nullable()
    .optional(),
});

/** 저장 응답. 새 검토본 버전과 저장된 항목/관계, 갱신된 승인 게이트. */
export const reviewMutationSchema = z.object({
  reviewVersion: z.number().int().min(0),
  item: reviewItemSchema.optional(),
  relation: relationSchema.optional(),
  approval: approvalGateSchema.optional(),
});

/** 409 봉투의 `error`. `current` 를 로컬 편집과 나란히 보여 주고 자동으로 덮지 않는다. */
export const reviewConflictSchema = z.object({
  code: z.enum([
    "REVIEW_VERSION_CONFLICT",
    "ITEM_REVISION_CONFLICT",
    "RELATION_REVISION_CONFLICT",
  ]),
  message: z.string(),
  currentReviewVersion: z.number().int().min(0).optional(),
  current: z
    .object({
      item: reviewItemSchema.optional(),
      relation: relationSchema.optional(),
    })
    .optional(),
});

export const approvalRejectedSchema = z.object({
  code: z.enum([
    "UNREVIEWED_ITEMS",
    "UNREVIEWED_RELATIONS",
    "STALE_RELATIONS",
    "REQUIRED_RELATION_FAILED",
    "REVIEW_VERSION_CONFLICT",
    "PROJECT_VERSION_CONFLICT",
  ]),
  message: z.string(),
  approval: approvalGateSchema.optional(),
  currentReviewVersion: z.number().int().min(0).optional(),
  currentProjectApprovalVersion: z.number().int().min(0).optional(),
});

export const approvedItemSchema = z.object({
  itemId: tsidSchema,
  revision: z.number().int().min(1),
  reviewItemId: tsidSchema,
  kind: proposalKindSchema,
  content: z.string(),
  originalProposalRef: originalProposalRefSchema.nullable(),
  assigneeText: z.string().nullable().optional(),
  dueText: z.string().nullable().optional(),
  citations: z.array(reviewCitationSchema),
});

export const meetingApprovalSchema = z.object({
  approvalVersion: z.number().int().min(1),
  approvedAt: wireInstantSchema,
  approvedBy: tsidSchema,
  reviewVersion: z.number().int().min(0),
  items: z.array(approvedItemSchema),
  relations: z.array(relationSchema),
  analysisRef: z.record(z.string(), z.unknown()).nullable().optional(),
  evaluationRef: z
    .object({
      status: regionStatusSchema,
      resultVersion: resultVersionSchema,
    })
    .nullable()
    .optional(),
});

export const conceptSummaryStatusSchema = z.enum([
  "NONE",
  "GENERATING",
  "READY",
  "INSUFFICIENT_EVIDENCE",
  "FAILED",
  "STALE",
]);

export const summaryStatementSchema = z.object({
  term: z.string().nullable().optional(),
  text: z.string(),
  sources: z.array(
    z.object({
      type: z.enum(["APPROVED_ITEM", "PROJECT_DESCRIPTION"]),
      itemId: tsidSchema.optional(),
      revision: z.number().int().optional(),
      noteId: tsidSchema.optional(),
      descriptionRevision: z.number().int().optional(),
      citations: z.array(reviewCitationSchema).optional(),
    })
  ),
});

const summaryBasisSchema = z.object({
  descriptionRevision: z.number().int().min(0),
  approvalVersion: z.number().int().min(0),
});

export const conceptSummarySchema = z.object({
  projectId: tsidSchema,
  status: conceptSummaryStatusSchema,
  /** 이 요약이 읽은 기준. 오래됨 판정은 server 가 하고 web 은 두 버전을 보여만 준다. */
  basis: summaryBasisSchema,
  current: summaryBasisSchema.partial().optional(),
  resultVersion: resultVersionSchema,
  generatedAt: wireInstantSchema.nullable().optional(),
  error: z.string().nullable().optional(),
  sections: z.object({
    purposeAndScope: z.array(summaryStatementSchema),
    concepts: z.array(summaryStatementSchema),
    direction: z.array(summaryStatementSchema),
    openIssues: z.array(summaryStatementSchema),
  }),
});

export type RegionStatus = z.infer<typeof regionStatusSchema>;
export type ItemRef = z.infer<typeof itemRefSchema>;
export type ReviewCitation = z.infer<typeof reviewCitationSchema>;
export type ReviewItem = z.infer<typeof reviewItemSchema>;
export type ReviewRegion = z.infer<typeof regionSchema>;
export type ReviewEvaluation = z.infer<typeof evaluationSchema>;
export type ReviewRelation = z.infer<typeof relationSchema>;
export type RelationJudgement = z.infer<typeof relationJudgementSchema>;
export type ApprovalGate = z.infer<typeof approvalGateSchema>;
export type ApprovalBlockerCode = z.infer<typeof approvalBlockerCodeSchema>;
export type MeetingReview = z.infer<typeof meetingReviewSchema>;
export type ReviewMutation = z.infer<typeof reviewMutationSchema>;
export type ReviewConflict = z.infer<typeof reviewConflictSchema>;
export type ApprovalRejected = z.infer<typeof approvalRejectedSchema>;
export type MeetingApproval = z.infer<typeof meetingApprovalSchema>;
export type ApprovedItem = z.infer<typeof approvedItemSchema>;
export type ConceptSummary = z.infer<typeof conceptSummarySchema>;
export type ConceptSummaryStatus = z.infer<typeof conceptSummaryStatusSchema>;
export type SummaryStatement = z.infer<typeof summaryStatementSchema>;
