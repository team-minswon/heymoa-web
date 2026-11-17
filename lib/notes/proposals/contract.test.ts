import { describe, expect, it } from "vitest";

import {
  contextBatchAppliedSchema,
  proposalChangedSchema,
  proposalHeadSchema,
  proposalSnapshotSchema,
} from "@/lib/notes/proposals/contract";

const head = {
  proposalId: "0HZX2K7M9Q4A1",
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
  resolvesProposalId: null,
  citations: [
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
  runId: "0RDDJ5MSFHQQX",
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
  it("모르는 필드가 붙어도 파싱이 살아 있고 그 필드는 버려진다", () => {
    const parsed = proposalHeadSchema.parse({
      ...head,
      thisFieldDoesNotExistYet: "나중에 server 가 더한 것",
    });

    expect(parsed.proposalId).toBe("0HZX2K7M9Q4A1");
    expect(parsed).not.toHaveProperty("thisFieldDoesNotExistYet");
  });

  it("event 봉투에도 모르는 필드가 붙을 수 있다", () => {
    expect(() =>
      proposalChangedSchema.parse({
        type: "proposal.changed",
        occurredAt: "2026-08-25T01:00:00.000Z",
        proposal: head,
        traceId: "나중에 붙을 수도 있는 것",
      })
    ).not.toThrow();

    expect(() =>
      contextBatchAppliedSchema.parse({
        type: "transcript-analysis-run.applied",
        occurredAt: range.appliedAt,
        range: { ...range, newFlag: true },
      })
    ).not.toThrow();
  });

  it("필수 필드가 빠지면 실패한다", () => {
    const withoutSource: Record<string, unknown> = { ...head };
    delete withoutSource.revisionSource;
    expect(proposalHeadSchema.safeParse(withoutSource).success).toBe(false);
  });

  it("enum 밖의 값은 실패한다", () => {
    expect(
      proposalHeadSchema.safeParse({ ...head, kind: "PROPOSAL" }).success
    ).toBe(false);
    expect(
      proposalHeadSchema.safeParse({ ...head, operation: "REAFFIRM" }).success
    ).toBe(false);
  });

  it("상태 행렬 밖의 조합을 거절한다", () => {
    const bad = [
      { status: "OPEN", closeReason: "RETRACTED" },
      { status: "CLOSED", closeReason: null },
      { status: "CLOSED", closeReason: "RESOLVED", kind: "DECISION" },
    ];
    for (const over of bad) {
      expect(proposalHeadSchema.safeParse({ ...head, ...over }).success).toBe(
        false
      );
    }
    expect(
      proposalHeadSchema.safeParse({
        ...head,
        kind: "QUESTION",
        status: "CLOSED",
        closeReason: "RESOLVED",
      }).success
    ).toBe(true);
  });

  it("content 길이는 UTF-16 이 아니라 code point 로 센다", () => {
    const emoji500 = "\u{1F600}".repeat(500);
    expect([...emoji500].length).toBe(500);
    expect(emoji500.length).toBe(1000);
    expect(
      proposalHeadSchema.safeParse({ ...head, content: emoji500 }).success
    ).toBe(true);
    expect(
      proposalHeadSchema.safeParse({
        ...head,
        content: "\u{1F600}".repeat(501),
      }).success
    ).toBe(false);
  });

  it("TSID 첫 글자를 좁히지 않는다 — 취소된 rollout 을 선반영하지 않는다", () => {
    for (const proposalId of [
      "0HZX2K7M9Q4A1",
      "ZZZZZZZZZZZZZ",
      "G123456789ABC",
    ]) {
      expect(
        proposalHeadSchema.safeParse({ ...head, proposalId }).success
      ).toBe(true);
    }
    for (const bad of ["0HZX2K7M9Q4A", "0HZX2K7M9Q4AI", "0hzx2k7m9q4a1"]) {
      expect(
        proposalHeadSchema.safeParse({ ...head, proposalId: bad }).success
      ).toBe(false);
    }
  });

  it("revisionSource 는 v1 에서 LIVE 하나뿐이다", () => {
    expect(proposalHeadSchema.safeParse(head).success).toBe(true);
    expect(
      proposalHeadSchema.safeParse({ ...head, revisionSource: "POSTPROCESS" })
        .success
    ).toBe(false);
  });

  it("runId 는 확정 계약대로 TSID 13자다", () => {
    expect(
      proposalSnapshotSchema.safeParse({
        proposals: [],
        runs: [{ ...range, runId: "0RDDJ5MSFHQQX" }],
      }).success
    ).toBe(true);
    expect(
      proposalSnapshotSchema.safeParse({
        proposals: [],
        runs: [{ ...range, runId: "recovery_run-2026-08-25_attempt3" }],
      }).success
    ).toBe(false);
  });

  it("status 와 closeReason 이 행렬대로 실린다", () => {
    expect(
      proposalHeadSchema.safeParse({
        ...head,
        kind: "QUESTION",
        operation: "RESOLVE",
        status: "CLOSED",
        closeReason: "RESOLVED",
      }).success
    ).toBe(true);
    expect(
      proposalHeadSchema.safeParse({
        ...head,
        operation: "RESOLVE",
        status: "OPEN",
        closeReason: null,
      }).success
    ).toBe(true);
  });

  describe("appliedAt", () => {
    const parseRange = (appliedAt: string) =>
      proposalSnapshotSchema.safeParse({
        proposals: [],
        runs: [{ ...range, appliedAt }],
      }).success;

    it("계약 표기를 받는다", () => {
      expect(parseRange("2026-08-25T01:00:00.000Z")).toBe(true);
    });

    it("모양이 맞아도 존재하지 않는 시각이면 거절한다", () => {
      expect(parseRange("2026-99-99T99:99:99.999Z")).toBe(false);
      expect(parseRange("2026-02-31T01:00:00.000Z")).toBe(false);
    });

    it("계약에 없는 표기는 거절한다", () => {
      expect(parseRange("2026-08-25T10:00:00.000+09:00")).toBe(false);
      expect(parseRange("2026-08-25T01:00:00Z")).toBe(false);
      expect(parseRange("2026-08-25T01:00:00.000000Z")).toBe(false);
      expect(parseRange("언젠가")).toBe(false);
    });

    it("event 의 occurredAt 은 확정 계약대로 밀리초 Z 표기만 받는다", () => {
      const event = {
        type: "transcript-analysis-run.applied",
        range,
      };
      expect(
        contextBatchAppliedSchema.safeParse({
          ...event,
          occurredAt: "2026-08-25T01:00:00.000Z",
        }).success
      ).toBe(true);
      expect(
        contextBatchAppliedSchema.safeParse({
          ...event,
          occurredAt: "2026-08-25T10:00:00+09:00",
        }).success
      ).toBe(false);
      expect(
        contextBatchAppliedSchema.safeParse({ ...event, occurredAt: "언젠가" })
          .success
      ).toBe(false);
    });
  });
});
