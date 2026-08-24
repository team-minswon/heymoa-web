import { z } from "zod";

/**
 * **이 파일은 임시 계약이다.** `openapi3.yml`에 context candidate 경로가 아직 없어서 orval이
 * 훅을 만들지 못한다. 그래서 wire 형태를 여기 한곳에만 두고 화면·MSW·reducer가 전부 이걸
 * 가져다 쓴다.
 *
 * **언제 지우나** — heymoa-server의 APP-459가 머지되어 `openapi3.yml`에 두 경로가 들어오면
 * `pnpm orval`을 돌리고 이 파일을 생성 타입의 재수출로 바꾼다. 그때 바뀌는 것은 이 파일뿐이다.
 *
 * **모르는 필드를 버리지 않고 무시한다(`z.object`).** 이 레포의 다른 실시간 스키마는
 * `z.strictObject`인데 여기만 다르고, 이유는 **배포 순서가 web을 마지막에 두기 때문**이다
 * (heymoa-ai → heymoa-server → heymoa-web). server가 필드를 하나 더 실어 보낸 뒤 web이
 * 아직 안 올라간 창이 반드시 생기는데, `strictObject`면 그 동안 **레일이 통째로 빈다.**
 * 모르는 필드는 무시하는 편이 낫다 — 계약이 `openapi3.yml`에 들어와 orval로 생성되면 이
 * 파일과 함께 이 완화도 사라진다.
 *
 * 관대해진 대신 **드리프트를 테스트가 잡는다** — `contract.test.ts`가 필수 필드 누락은
 * 여전히 실패시키고, 모르는 필드는 통과하되 버려지는 것을 고정한다.
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

/**
 * 공용 13자리 TSID. `note-topic-protocol.ts`와 같은 형태다.
 *
 * **첫 글자를 `[0-9A-F]`로 좁히지 않는다.** APP-459 제안 YAML에 그 strict 패턴이 있지만
 * 그것은 **취소된 rollout(APP-467~471, 전부 Canceled+archived)을 선반영한 것**이라
 * 현재 released 계약과 충돌한다. 지금 released 패턴은 이 broad 형태이고 server 생성
 * OpenAPI도 같을 예정이다.
 *
 * 좁히면 released 식별자 중 첫 글자가 `G` 이상인 것이 전부 파싱에서 떨어진다 —
 * 그 이벤트는 `z.object`의 관대함으로도 못 구한다. 필드 무시와 값 거절은 다르다.
 */
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
 * **v1은 `LIVE` 하나뿐이다.** APP-458 최종 합의에서 POSTPROCESS 선예약을 걷었다 —
 * 후처리 producer 가 폐기돼 그 값을 낼 주체가 없는데 계약이 존재를 주장하면 안 된다.
 *
 * 나중에 producer 가 생기면 **값 추가**로 넓힌다. 값 추가는 필드 추가와 달라서, 그때
 * 여기 한 줄을 늘리고 web 을 먼저 배포하면 된다. 지금 미리 열어 두면 계약이 거짓말이 된다.
 */
export const revisionSourceSchema = z.enum(["LIVE"]);

/**
 * **`range.appliedAt`의 wire 표기다.** 생성 OpenAPI가 `format: date-time`에 더해 정규식까지
 * 못박았다 — 밀리초 세 자리에 `Z`뿐이고 offset 표기는 계약에 없다. 그 정밀도를 여기서 그대로
 * 받는다. `z.string()`으로 두면 깨진 값이 화면까지 가서 `Invalid Date`가 된다.
 *
 * 관대함은 *모르는 필드*를 흘려보내는 것이지, **아는 필드의 깨진 값을 받는 것이 아니다.**
 */
export const wireInstantSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  /**
   * **정규식은 모양만 본다.** `2026-99-99T99:99:99.999Z`도 그 모양을 만족한다.
   * 실제로 존재하는 시각인지는 따로 물어야 한다.
   *
   * `Date.parse`가 NaN인지만 보면 부족하다 — JS는 `2026-02-31`을 3월 3일로 굴려서
   * 조용히 통과시킨다. **왕복시켜 같은 문자열로 돌아오는지**를 본다. wire 표기가 정확히
   * `toISOString()`의 형태라 이 비교가 곧 유효성 검사다.
   */
  .refine(
    (value) => {
      const parsed = new Date(value);
      // Invalid Date 에 `toISOString()` 을 부르면 RangeError 를 던진다 — 먼저 거른다.
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed.toISOString() === value;
    },
    { message: "실제로 존재하는 시각이 아닙니다" }
  );

/**
 * **event의 `occurredAt`은 이보다 넓다.** APP-459 AsyncAPI가 `format: date-time`만 정하고
 * 정규식은 안 두었다. 계약에 없는 정밀도로 좁히면 relay가 표기를 바꿨을 때 이벤트를 통째로
 * 버린다 — 좁히는 쪽이 안전해 보이지만 여기서는 반대다.
 */
export const instantSchema = z.iso.datetime({ offset: true });

export const contextEvidenceSchema = z.object({
  segmentId: tsidSchema,
  sequence: z.number().int().min(1),
  /** 회의 축. 전사 정렬 축과 같다 — `lib/transcription/presentation.ts`가 이 값으로 세운다. */
  startedAtMs: z.number().int().min(0),
  /**
   * server 의 `ContextCandidateEvidenceResponse.endedAtMs` 는 **non-null 필수**다.
   * 빠뜨리면 근거 구간의 끝을 모른 채 시작점만 찍게 되고, 나중에 계약으로 굳을 때
   * 조용히 드리프트한다. web 이 마지막에 배포되므로 필수로 받아도 안전하다.
   */
  endedAtMs: z.number().int().min(0),
  text: z.string(),
  role: contextEvidenceRoleSchema,
});

export const contextCandidateHeadSchema = z.object({
  candidateId: tsidSchema,
  revision: z.number().int().min(1),
  operation: contextOperationSchema,
  kind: contextCandidateKindSchema,
  status: z.enum(["OPEN", "CLOSED"]),
  /** `OPEN`이면 `null`. `RESOLVED`는 `QUESTION`에만 온다. */
  closeReason: z.enum(["RETRACTED", "RESOLVED"]).nullable(),
  revisionSource: revisionSourceSchema,
  /**
   * NFC 문자열. 계약 상한이 **500 code point** 다.
   *
   * `.max(500)` 을 쓰면 안 된다 — zod 는 `String.length`, 즉 **UTF-16 code unit** 을 센다.
   * 이모지처럼 surrogate pair 인 글자는 하나가 2로 계산돼, 계약상 유효한 500 code point
   * 문자열을 web 이 1000 으로 보고 거절한다.
   */
  content: z
    .string()
    .min(1)
    .refine((value) => [...value].length <= 500, {
      message: "content는 500 code point 이하여야 합니다",
    }),
  /** 시간순 정렬 키. `updatedAt`으로 정렬하면 수정마다 카드가 아래로 튄다. */
  createdSequence: z.number().int().min(1),
  lastEvidenceSequence: z.number().int().min(1),
  aiSemanticRevisionCount: z.number().int().min(0),
  /** 결과 후보가 매달린 질문. 질문 자신과 일반 후보는 `null`이다. */
  resolvesCandidateId: tsidSchema.nullable(),
  evidence: z.array(contextEvidenceSchema),
})
  /**
   * **상태 행렬을 강제한다.** 계약(APP-452 spec.md:188-189)이 세 조합만 허용한다 —
   * `OPEN/null`, `CLOSED/RETRACTED`, 그리고 `QUESTION` 에 한해 `CLOSED/RESOLVED`.
   *
   * 필드를 따로 검사하면 「OPEN 인데 RETRACTED」 같은 조합이 통과해 화면이 철회선과
   * 열림 상태를 동시에 그린다. 조합으로 봐야 걸린다.
   */
  .refine(
    (c) =>
      (c.status === "OPEN" && c.closeReason === null) ||
      (c.status === "CLOSED" && c.closeReason === "RETRACTED") ||
      (c.status === "CLOSED" &&
        c.closeReason === "RESOLVED" &&
        c.kind === "QUESTION"),
    { message: "status·closeReason·kind 조합이 계약 행렬 밖입니다" }
  );

/**
 * 성공적으로 적용된 분류 배치 하나의 범위. **범위 사이의 구멍이 읽지 못한 구간이다.**
 * `REJECTED_OUTPUT`은 여기 안 들어온다 — 그 구간은 실시간으로 영영 오지 않는다.
 */
export const appliedRangeSchema = z.object({
  runKey: runKeySchema,
  applyStatus: z.enum(["APPLIED", "PARTIAL_RECORDED"]),
  fromSequence: z.number().int().min(1),
  toSequence: z.number().int().min(1),
  fromStartedAtMs: z.number().int().min(0),
  toEndedAtMs: z.number().int().min(0),
  /** 모델이 delta 상한에 닿았다. **더 있다는 확정이 아니라 가능성이다.** */
  rawDeltaSaturated: z.boolean(),
  semanticUnitSaturated: z.boolean(),
  appliedAt: wireInstantSchema,
});

export const contextCandidateSnapshotSchema = z.object({
  candidates: z.array(contextCandidateHeadSchema),
  appliedRanges: z.array(appliedRangeSchema),
});

export const contextCandidateRevisionsSchema = z.object({
  candidateId: tsidSchema,
  revisions: z.array(contextCandidateHeadSchema),
});

/** note topic이 싣는 두 프레임. `note-topic-protocol.ts`가 이걸 union에 넣는다. */
export const contextCandidateChangedSchema = z.object({
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
  occurredAt: instantSchema,
  candidate: contextCandidateHeadSchema,
});

export const contextBatchAppliedSchema = z.object({
  type: z.literal("context.classification.batch.applied"),
  /** batch의 dedupe 키다. */
  eventId: tsidSchema,
  occurredAt: instantSchema,
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
