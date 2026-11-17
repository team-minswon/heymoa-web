import { z } from "zod";

import { tsidSchema } from "@/lib/api/tsid";

import type { ProposalCitation as GeneratedCitation } from "@/lib/api/generated/models/proposalCitation";
import type { ProposalRevision as GeneratedRevision } from "@/lib/api/generated/models/proposalRevision";
import type { TranscriptAnalysisRunRange as GeneratedRange } from "@/lib/api/generated/models/transcriptAnalysisRunRange";

// orval 은 `client: "react-query"` 라 zod parser 를 만들지 않습니다. WS JSON 파싱에 이 스키마가 필요해 zod 를 둡니다.

const runIdSchema = tsidSchema;

export const proposalKindSchema = z.enum([
  "AGENDA",
  "DECISION",
  "ACTION_ITEM",
  "ISSUE",
  "QUESTION",
  "STATUS_REPORT",
  "INSIGHT",
]);

export const proposalCitationRoleSchema = z.enum([
  "SUPPORTS",
  "REFUTES",
  "CONDITIONS",
  "RETRACTS",
  "REFERENCES",
]);

export const contextOperationSchema = z.enum([
  "CREATE",
  "AMEND",
  "CORRECT",
  "RETRACT",
  "RESOLVE",
]);

export const revisionSourceSchema = z.enum(["LIVE"]);

export const wireInstantSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine(
    (value) => {
      // JS 는 `2026-02-31` 을 3월 3일로 굴려 통과시키므로, 왕복해 같은 문자열로 돌아오는지 봅니다.
      const parsed = new Date(value);
      // Invalid Date 에 `toISOString()` 을 부르면 RangeError 를 던져 먼저 거릅니다.
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed.toISOString() === value;
    },
    { message: "실제로 존재하는 시각이 아닙니다" }
  );

export const proposalCitationSchema = z.object({
  segmentId: tsidSchema,
  sequence: z.number().int().min(1),
  startedAtMs: z.number().int().min(0),
  endedAtMs: z.number().int().min(0),
  text: z.string(),
  role: proposalCitationRoleSchema,
});

export const proposalHeadSchema = z
  .object({
    proposalId: tsidSchema,
    revision: z.number().int().min(1),
    operation: contextOperationSchema,
    kind: proposalKindSchema,
    status: z.enum(["OPEN", "CLOSED"]),
    /** `OPEN`이면 `null`. `RESOLVED`는 `QUESTION`에만 옵니다. */
    closeReason: z.enum(["RETRACTED", "RESOLVED"]).nullable(),
    revisionSource: revisionSourceSchema,
    /** 계약 상한은 500 code point 입니다. zod `.max()` 는 UTF-16 code unit 을 세어 surrogate pair 를 2로 셉니다. */
    content: z
      .string()
      .min(1)
      .refine((value) => [...value].length <= 500, {
        message: "content는 500 code point 이하여야 합니다",
      }),
    createdSequence: z.number().int().min(1),
    lastEvidenceSequence: z.number().int().min(1),
    aiSemanticRevisionCount: z.number().int().min(0),
    /** 결과 후보가 매달린 질문. 질문 자신과 일반 후보는 `null`입니다. */
    resolvesProposalId: tsidSchema.nullable(),
    citations: z.array(proposalCitationSchema),
  })
  .refine(
    (c) =>
      (c.status === "OPEN" && c.closeReason === null) ||
      (c.status === "CLOSED" && c.closeReason === "RETRACTED") ||
      (c.status === "CLOSED" &&
        c.closeReason === "RESOLVED" &&
        c.kind === "QUESTION"),
    { message: "status·closeReason·kind 조합이 계약 행렬 밖입니다" }
  );

export const runRangeSchema = z.object({
  runId: runIdSchema,
  applyStatus: z.enum(["APPLIED", "PARTIAL_RECORDED"]),
  fromSequence: z.number().int().min(1),
  toSequence: z.number().int().min(1),
  fromStartedAtMs: z.number().int().min(0),
  toEndedAtMs: z.number().int().min(0),
  rawDeltaSaturated: z.boolean(),
  semanticUnitSaturated: z.boolean(),
  appliedAt: wireInstantSchema,
});

export const proposalSnapshotSchema = z.object({
  proposals: z.array(proposalHeadSchema),
  runs: z.array(runRangeSchema),
});

export const proposalChangedSchema = z.object({
  type: z.literal("proposal.changed"),
  occurredAt: wireInstantSchema,
  proposal: proposalHeadSchema,
});

export const contextBatchAppliedSchema = z.object({
  type: z.literal("transcript-analysis-run.applied"),
  occurredAt: wireInstantSchema,
  range: runRangeSchema,
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 제약 자체가 검사다
type Assert<T extends true> = never;
type Extends<A, B> = [A] extends [B] ? true : false;

type _guardCitationForward = Assert<
  Extends<z.infer<typeof proposalCitationSchema>, GeneratedCitation>
>;
type _guardCitationBackward = Assert<
  Extends<GeneratedCitation, z.infer<typeof proposalCitationSchema>>
>;
type _guardRangeForward = Assert<
  Extends<z.infer<typeof runRangeSchema>, GeneratedRange>
>;
type _guardRangeBackward = Assert<
  Extends<GeneratedRange, z.infer<typeof runRangeSchema>>
>;
type _guardHeadBackward = Assert<
  Extends<GeneratedRevision, z.infer<typeof proposalHeadSchema>>
>;
// union 에 `keyof` 를 걸면 공통 키만 나와, 분배시켜 갈래별 키의 합집합을 봅니다.
type KeysOfUnion<T> = T extends unknown ? keyof T : never;

type _guardHeadKeys = Assert<
  Extends<
    Exclude<
      KeysOfUnion<GeneratedRevision>,
      keyof z.infer<typeof proposalHeadSchema>
    >,
    never
  >
>;

export type ContextContractGuards = [
  _guardCitationForward,
  _guardCitationBackward,
  _guardRangeForward,
  _guardRangeBackward,
  _guardHeadBackward,
  _guardHeadKeys,
];

export type ProposalHead = z.infer<typeof proposalHeadSchema>;
export type ProposalCitation = z.infer<typeof proposalCitationSchema>;
export type RunRange = z.infer<typeof runRangeSchema>;
export type ProposalSnapshot = z.infer<typeof proposalSnapshotSchema>;
export type ProposalChanged = z.infer<typeof proposalChangedSchema>;
export type ContextBatchApplied = z.infer<typeof contextBatchAppliedSchema>;
