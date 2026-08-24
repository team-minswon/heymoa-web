import { z } from "zod";

/**
 * **이 파일은 임시 계약이다.** `openapi3.yml`에 context candidate 경로가 아직 없어서 orval이
 * 훅을 만들지 못한다. 그래서 wire 형태를 여기 한곳에만 두고 화면·MSW·reducer가 전부 이걸
 * 가져다 쓴다.
 *
 * **언제 지우나** — heymoa-server의 APP-459가 머지되어 `openapi3.yml`에 두 경로가 들어오면
 * `pnpm orval`을 돌리고 이 파일을 생성 타입의 재수출로 바꾼다. 그때 바뀌는 것은 이 파일뿐이다.
 *
 * 값의 출처는 heymoa-server의 APP-459 답변(추가 답변 3·4)이고 APP-452 계약과 대조했다.
 * 임의로 넓히거나 좁히지 않는다 — 특히 아래 셋이 실제로 밟은 함정이다.
 *
 * 1. **`runKey`는 TSID가 아니다.** 계약이 opaque `^[A-Za-z0-9_-]{1,64}$`다. APP-466 구현이
 *    지금은 `new_tsid`로 발급해 13자리처럼 보이는데, 그걸 보고 스키마를 좁히면 복구 경로에서
 *    형식이 달라졌을 때 깨진다. server는 파싱하지 않고 exact compare만 한다.
 * 2. **`operation`으로 `status`를 유도하면 안 된다.** `RESOLVE` 하나가 질문의 `CLOSED` revision
 *    하나와 결과의 `OPEN` revision 1~3개를 **동시에** 만든다. 그래서 실린 값을 읽는다.
 * 3. **`aiSemanticRevisionCount`를 `revision - 1`로 계산하지 않는다.** `origin`이 사람 편집을
 *    포함하는 축이라 사람이 고치면 `revision`만 오르고 이 값은 그대로다.
 */

/** 공용 13자리 TSID. `note-topic-protocol.ts`와 같은 형태다. */
const tsidSchema = z
  .string()
  .length(13)
  .regex(/^[0-9A-HJKMNP-TV-Z]{13}$/);

/** opaque 멱등키. **TSID가 아니다** — 위 주석 1번. */
const runKeySchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const contextCandidateKindSchema = z.enum([
  "AGENDA",
  "DECISION",
  "ACTION_ITEM",
  "ISSUE",
  "QUESTION",
  "STATUS_REPORT",
  "INSIGHT",
]);

export const contextEvidenceRoleSchema = z.enum([
  "SUPPORTS",
  "REFUTES",
  "CONDITIONS",
  "RETRACTS",
  "REFERENCES",
]);

/** `REAFFIRM`은 candidate event를 만들지 않으므로 wire enum에 없다. */
export const contextOperationSchema = z.enum([
  "CREATE",
  "AMEND",
  "CORRECT",
  "RETRACT",
  "RESOLVE",
]);

/**
 * v1이 실제로 생산하는 값은 `LIVE`뿐이다. **그래도 둘 다 받는다** — 파서가
 * `z.strictObject`라 나중에 값이 하나 늘면 배포를 묶어야 하는데, enum 확장은 안 그렇다.
 */
export const revisionSourceSchema = z.enum(["LIVE", "POSTPROCESS"]);

export const contextEvidenceSchema = z.strictObject({
  segmentId: tsidSchema,
  sequence: z.number().int().min(1),
  /** 회의 축. 전사 정렬 축과 같다 — `lib/transcription/presentation.ts`가 이 값으로 세운다. */
  startedAtMs: z.number().int().min(0),
  text: z.string(),
  role: contextEvidenceRoleSchema,
});

export const contextCandidateHeadSchema = z.strictObject({
  candidateId: tsidSchema,
  revision: z.number().int().min(1),
  operation: contextOperationSchema,
  kind: contextCandidateKindSchema,
  status: z.enum(["OPEN", "CLOSED"]),
  /** `OPEN`이면 `null`. `RESOLVED`는 `QUESTION`에만 온다. */
  closeReason: z.enum(["RETRACTED", "RESOLVED"]).nullable(),
  revisionSource: revisionSourceSchema,
  /** NFC 문자열. 계약 상한이 500 code point다. */
  content: z.string().min(1).max(500),
  /** 시간순 정렬 키. `updatedAt`으로 정렬하면 수정마다 카드가 아래로 튄다. */
  createdSequence: z.number().int().min(1),
  lastEvidenceSequence: z.number().int().min(1),
  aiSemanticRevisionCount: z.number().int().min(0),
  /** 결과 후보가 매달린 질문. 질문 자신과 일반 후보는 `null`이다. */
  resolvesCandidateId: tsidSchema.nullable(),
  evidence: z.array(contextEvidenceSchema),
});

/**
 * 성공적으로 적용된 분류 배치 하나의 범위. **범위 사이의 구멍이 읽지 못한 구간이다.**
 * `REJECTED_OUTPUT`은 여기 안 들어온다 — 그 구간은 실시간으로 영영 오지 않는다.
 */
export const appliedRangeSchema = z.strictObject({
  runKey: runKeySchema,
  applyStatus: z.enum(["APPLIED", "PARTIAL_RECORDED"]),
  fromSequence: z.number().int().min(1),
  toSequence: z.number().int().min(1),
  fromStartedAtMs: z.number().int().min(0),
  toEndedAtMs: z.number().int().min(0),
  /** 모델이 delta 상한에 닿았다. **더 있다는 확정이 아니라 가능성이다.** */
  rawDeltaSaturated: z.boolean(),
  semanticUnitSaturated: z.boolean(),
  appliedAt: z.string(),
});

export const contextCandidateSnapshotSchema = z.strictObject({
  candidates: z.array(contextCandidateHeadSchema),
  appliedRanges: z.array(appliedRangeSchema),
});

export const contextCandidateRevisionsSchema = z.strictObject({
  candidateId: tsidSchema,
  revisions: z.array(contextCandidateHeadSchema),
});

/** note topic이 싣는 두 프레임. `note-topic-protocol.ts`가 이걸 union에 넣는다. */
export const contextCandidateChangedSchema = z.strictObject({
  type: z.literal("context.candidate.changed"),
  /** outbox event ID. **RESOLVE fan-out message가 공유한다** — 그래서 dedupe 키가 아니다. */
  eventId: tsidSchema,
  /**
   * 한 outbox event 안의 순번. 일반 operation은 0이고, RESOLVE는 Question이 0,
   * 결과가 `resultOrdinal + 1`이다(1~3).
   *
   * web의 dedupe 키에는 안 들어간다 — 그건 계속 `(candidateId, revision)`이다. 다만 이
   * 순서 덕분에 **질문이 결과보다 먼저 도착**해서 결과가 부모 없이 뜨는 경로를 안 지난다.
   */
  changeOrdinal: z.number().int().min(0).max(3),
  occurredAt: z.string(),
  candidate: contextCandidateHeadSchema,
});

export const contextBatchAppliedSchema = z.strictObject({
  type: z.literal("context.classification.batch.applied"),
  /** batch의 dedupe 키다. */
  eventId: tsidSchema,
  occurredAt: z.string(),
  range: appliedRangeSchema,
});

export type ContextCandidateHead = z.infer<typeof contextCandidateHeadSchema>;
export type ContextEvidence = z.infer<typeof contextEvidenceSchema>;
export type AppliedRange = z.infer<typeof appliedRangeSchema>;
export type ContextCandidateSnapshot = z.infer<
  typeof contextCandidateSnapshotSchema
>;
export type ContextCandidateChanged = z.infer<
  typeof contextCandidateChangedSchema
>;
export type ContextBatchApplied = z.infer<typeof contextBatchAppliedSchema>;
