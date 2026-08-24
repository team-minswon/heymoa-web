import { describe, expect, it } from "vitest";

import {
  contextBatchAppliedSchema,
  contextCandidateChangedSchema,
  contextCandidateHeadSchema,
  contextCandidateSnapshotSchema,
} from "@/lib/notes/context-candidates/contract";

const head = {
  candidateId: "0HZX2K7M9Q4A1",
  revision: 1,
  operation: "CREATE",
  kind: "DECISION",
  status: "OPEN",
  closeReason: null,
  revisionSource: "LIVE",
  content: "경로 데이터 저장소는 MongoDB를 사용한다",
  createdSequence: 10,
  lastEvidenceSequence: 10,
  aiSemanticRevisionCount: 0,
  resolvesCandidateId: null,
  evidence: [
    {
      segmentId: "0HZX2K7M9Q4AH",
      sequence: 10,
      startedAtMs: 1_872_000,
      endedAtMs: 1_876_000,
      text: "그럼 MongoDB로 갑시다",
      role: "SUPPORTS",
    },
  ],
};

const range = {
  runKey: "run-1",
  applyStatus: "APPLIED",
  fromSequence: 1,
  toSequence: 10,
  fromStartedAtMs: 0,
  toEndedAtMs: 100_000,
  rawDeltaSaturated: false,
  semanticUnitSaturated: false,
  appliedAt: "2026-08-25T01:00:00.000Z",
};

describe("draft 계약의 관대함", () => {
  // 배포가 heymoa-ai → server → web 순서라, server 가 먼저 필드를 실어 보내는 창이 반드시
  // 생긴다. 그 동안 레일이 통째로 비면 안 된다.
  it("모르는 필드가 붙어도 파싱이 살아 있고 그 필드는 버려진다", () => {
    const parsed = contextCandidateHeadSchema.parse({
      ...head,
      thisFieldDoesNotExistYet: "나중에 server 가 더한 것",
    });

    expect(parsed.candidateId).toBe("0HZX2K7M9Q4A1");
    expect(parsed).not.toHaveProperty("thisFieldDoesNotExistYet");
  });

  it("event 봉투에도 모르는 필드가 붙을 수 있다", () => {
    expect(() =>
      contextCandidateChangedSchema.parse({
        type: "context.candidate.changed",
        eventId: "0HZX2K7M9Q4B1",
        changeOrdinal: 0,
        occurredAt: "2026-08-25T01:00:00.000Z",
        candidate: head,
        traceId: "나중에 붙을 수도 있는 것",
      })
    ).not.toThrow();

    expect(() =>
      contextBatchAppliedSchema.parse({
        type: "context.classification.batch.applied",
        eventId: "0HZX2K7M9Q4C1",
        occurredAt: range.appliedAt,
        range: { ...range, newFlag: true },
      })
    ).not.toThrow();
  });

  // 관대함이 드리프트를 감추면 안 된다. **빠진 것은 여전히 실패한다.**
  it("필수 필드가 빠지면 실패한다", () => {
    const withoutSource: Record<string, unknown> = { ...head };
    delete withoutSource.revisionSource;
    expect(contextCandidateHeadSchema.safeParse(withoutSource).success).toBe(
      false
    );
  });

  it("enum 밖의 값은 실패한다", () => {
    expect(
      contextCandidateHeadSchema.safeParse({ ...head, kind: "PROPOSAL" }).success
    ).toBe(false);
    // `REAFFIRM` 은 candidate event 를 만들지 않으므로 wire enum 에 없다.
    expect(
      contextCandidateHeadSchema.safeParse({ ...head, operation: "REAFFIRM" })
        .success
    ).toBe(false);
  });

  it("상태 행렬 밖의 조합을 거절한다", () => {
    // 필드를 따로 보면 통과하는 조합들이다. 조합으로 봐야 걸린다.
    const bad = [
      { status: "OPEN", closeReason: "RETRACTED" },
      { status: "CLOSED", closeReason: null },
      // RESOLVED 는 QUESTION 에만 허용된다.
      { status: "CLOSED", closeReason: "RESOLVED", kind: "DECISION" },
    ];
    for (const over of bad) {
      expect(
        contextCandidateHeadSchema.safeParse({ ...head, ...over }).success
      ).toBe(false);
    }
    expect(
      contextCandidateHeadSchema.safeParse({
        ...head,
        kind: "QUESTION",
        status: "CLOSED",
        closeReason: "RESOLVED",
      }).success
    ).toBe(true);
  });

  it("content 길이는 UTF-16 이 아니라 code point 로 센다", () => {
    // 이모지는 surrogate pair 라 `String.length` 가 2 다. 계약은 code point 500 이므로
    // 이모지 500 개는 유효한데, `.max(500)` 이면 1000 으로 보고 거절한다.
    const emoji500 = "\u{1F600}".repeat(500);
    expect([...emoji500].length).toBe(500);
    expect(emoji500.length).toBe(1000);
    expect(
      contextCandidateHeadSchema.safeParse({ ...head, content: emoji500 }).success
    ).toBe(true);
    expect(
      contextCandidateHeadSchema.safeParse({
        ...head,
        content: "\u{1F600}".repeat(501),
      }).success
    ).toBe(false);
  });

  it("TSID 첫 글자를 좁히지 않는다 — 취소된 rollout 을 선반영하지 않는다", () => {
    // APP-467~471 은 전부 Canceled+archived 다. 그 strict 패턴(`^[0-9A-F]...`)을 넣으면
    // released 식별자 중 첫 글자가 G 이상인 것이 통째로 거절된다.
    for (const candidateId of ["0HZX2K7M9Q4A1", "ZZZZZZZZZZZZZ", "G123456789ABC"]) {
      expect(
        contextCandidateHeadSchema.safeParse({ ...head, candidateId }).success
      ).toBe(true);
    }
    // 그래도 형태는 지킨다 — 길이와 제외 문자(I·L·O·U)는 여전히 막는다.
    for (const bad of ["0HZX2K7M9Q4A", "0HZX2K7M9Q4AI", "0hzx2k7m9q4a1"]) {
      expect(
        contextCandidateHeadSchema.safeParse({ ...head, candidateId: bad }).success
      ).toBe(false);
    }
  });

  it("revisionSource 는 v1 에서 LIVE 하나뿐이다", () => {
    // APP-458 최종 합의: POSTPROCESS 선예약을 걷었다. 낼 주체가 없는 값을 받아 두면
    // 계약이 존재하지 않는 것을 주장하게 된다.
    expect(contextCandidateHeadSchema.safeParse(head).success).toBe(true);
    expect(
      contextCandidateHeadSchema.safeParse({ ...head, revisionSource: "POSTPROCESS" })
        .success
    ).toBe(false);
  });

  it("runKey 는 TSID 가 아니라 opaque 다", () => {
    // APP-466 구현이 지금은 TSID 로 발급해 13자리처럼 보이지만 계약은 64자 opaque 다.
    expect(
      contextCandidateSnapshotSchema.safeParse({
        candidates: [],
        appliedRanges: [{ ...range, runKey: "recovery_run-2026-08-25_attempt3" }],
      }).success
    ).toBe(true);
  });

  it("status 와 closeReason 이 행렬대로 실린다", () => {
    // 유도하지 않고 실린 값을 읽는다 — RESOLVE 하나가 CLOSED 와 OPEN 을 동시에 만든다.
    expect(
      contextCandidateHeadSchema.safeParse({
        ...head,
        kind: "QUESTION",
        operation: "RESOLVE",
        status: "CLOSED",
        closeReason: "RESOLVED",
      }).success
    ).toBe(true);
    expect(
      contextCandidateHeadSchema.safeParse({
        ...head,
        operation: "RESOLVE",
        status: "OPEN",
        closeReason: null,
      }).success
    ).toBe(true);
  });

  /**
   * **`appliedAt`은 모양과 유효성을 둘 다 봐야 한다.** 생성 OpenAPI가 밀리초·`Z`까지
   * 정규식으로 못박은 필드라, 여기서 흘리면 깨진 값이 화면의 「갱신」까지 간다.
   */
  describe("appliedAt", () => {
    const parseRange = (appliedAt: string) =>
      contextCandidateSnapshotSchema.safeParse({
        candidates: [],
        appliedRanges: [{ ...range, appliedAt }],
      }).success;

    it("계약 표기를 받는다", () => {
      expect(parseRange("2026-08-25T01:00:00.000Z")).toBe(true);
    });

    it("모양이 맞아도 존재하지 않는 시각이면 거절한다", () => {
      // 정규식만 보면 통과한다 — 그래서 정규식만으로는 부족하다.
      expect(parseRange("2026-99-99T99:99:99.999Z")).toBe(false);
      // JS 는 이것을 3월로 굴려서 조용히 통과시킨다. 왕복 비교가 그걸 잡는다.
      expect(parseRange("2026-02-31T01:00:00.000Z")).toBe(false);
    });

    it("계약에 없는 표기는 거절한다", () => {
      // offset 표기·밀리초 없음·마이크로초. 셋 다 계약 밖이다.
      expect(parseRange("2026-08-25T10:00:00.000+09:00")).toBe(false);
      expect(parseRange("2026-08-25T01:00:00Z")).toBe(false);
      expect(parseRange("2026-08-25T01:00:00.000000Z")).toBe(false);
      expect(parseRange("언젠가")).toBe(false);
    });

    /**
     * **event 의 `occurredAt` 은 이보다 넓다.** AsyncAPI 가 `format: date-time` 만 정하고
     * 정규식은 안 두었다 — 계약에 없는 정밀도로 좁히면 relay 가 표기를 바꿨을 때 이벤트를
     * 통째로 버린다.
     */
    it("event 의 occurredAt 은 offset 표기를 받는다", () => {
      const event = {
        type: "context.classification.batch.applied",
        eventId: "0HZX2K7M9Q4B1",
        range,
      };
      expect(
        contextBatchAppliedSchema.safeParse({
          ...event,
          occurredAt: "2026-08-25T10:00:00+09:00",
        }).success
      ).toBe(true);
      expect(
        contextBatchAppliedSchema.safeParse({ ...event, occurredAt: "언젠가" })
          .success
      ).toBe(false);
    });
  });
});
