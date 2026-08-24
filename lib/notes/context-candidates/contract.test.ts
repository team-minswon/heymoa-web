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
});
