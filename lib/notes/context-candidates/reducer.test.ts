import { describe, expect, it } from "vitest";

import {
  findCoverageGaps,
  initialContextState,
  reduceContextEvent,
  selectCards,
  type ContextCandidateHead,
} from "@/lib/notes/context-candidates/reducer";

const NOW = "2026-08-24T01:02:03.000Z";

function head(
  over: Partial<ContextCandidateHead> & { candidateId: string }
): ContextCandidateHead {
  return {
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
    ...over,
  };
}

function changed(candidate: ContextCandidateHead, eventId = "0HZX2K7M9Q4B1") {
  return {
    type: "context.candidate.changed",
    eventId,
    occurredAt: NOW,
    candidate,
  } as const;
}

function range(over: Partial<Parameters<typeof rangeBase>[0]> = {}) {
  return rangeBase(over);
}
function rangeBase(over: {
  runKey?: string;
  fromSequence?: number;
  toSequence?: number;
  fromStartedAtMs?: number;
  toEndedAtMs?: number;
  rawDeltaSaturated?: boolean;
  semanticUnitSaturated?: boolean;
}) {
  return {
    runKey: over.runKey ?? "run-1",
    applyStatus: "APPLIED" as const,
    fromSequence: over.fromSequence ?? 1,
    toSequence: over.toSequence ?? 10,
    fromStartedAtMs: over.fromStartedAtMs ?? 0,
    toEndedAtMs: over.toEndedAtMs ?? 100_000,
    rawDeltaSaturated: over.rawDeltaSaturated ?? false,
    semanticUnitSaturated: over.semanticUnitSaturated ?? false,
    appliedAt: NOW,
  };
}

function batch(coverage: ReturnType<typeof rangeBase>, eventId: string) {
  return {
    type: "context.classification.batch.applied",
    eventId,
    occurredAt: coverage.appliedAt,
    coverage,
  } as const;
}

function apply(
  events: Parameters<typeof reduceContextEvent>[1][],
  from = initialContextState
) {
  return events.reduce(reduceContextEvent, from);
}

describe("context candidate reducer", () => {
  it("같은 candidateId의 새 revision은 목록을 늘리지 않고 제자리에서 교체한다", () => {
    const state = apply([
      changed(head({ candidateId: "0HZX2K7M9Q4A1" })),
      changed(
        head({
          candidateId: "0HZX2K7M9Q4A1",
          revision: 2,
          operation: "AMEND",
          content: "경로 데이터 저장소는 MongoDB를 쓰되 샤딩은 미룬다",
          aiSemanticRevisionCount: 1,
        }),
        "0HZX2K7M9Q4B2"
      ),
    ]);

    const cards = selectCards(state);
    expect(cards).toHaveLength(1);
    expect(cards[0].revision).toBe(2);
    expect(cards[0].content).toContain("샤딩은 미룬다");
  });

  it("현재 revision 이하가 뒤늦게 와도 최신을 되돌리지 않는다", () => {
    const state = apply([
      changed(head({ candidateId: "0HZX2K7M9Q4A1", revision: 2, content: "최신" })),
      changed(
        head({ candidateId: "0HZX2K7M9Q4A1", revision: 1, content: "옛것" }),
        "0HZX2K7M9Q4B2"
      ),
    ]);

    expect(selectCards(state)[0].content).toBe("최신");
    expect(selectCards(state)[0].revision).toBe(2);
  });

  it("처음 본 후보가 revision 2 이상이면 재조회를 요구한다", () => {
    const seen = apply([changed(head({ candidateId: "0HZX2K7M9Q4A1" }))]);
    expect(seen.needsRefetch).toBe(false);

    const gap = apply(
      [changed(head({ candidateId: "0HZX2K7M9Q4A9", revision: 3 }), "0HZX2K7M9Q4B3")],
      seen
    );
    expect(gap.needsRefetch).toBe(true);
  });

  it("도착 순서가 아니라 createdSequence로 세운다", () => {
    const state = apply([
      changed(head({ candidateId: "0HZX2K7M9Q4A2", createdSequence: 50 })),
      changed(
        head({ candidateId: "0HZX2K7M9Q4A1", createdSequence: 10 }),
        "0HZX2K7M9Q4B2"
      ),
    ]);

    expect(selectCards(state).map((card) => card.createdSequence)).toEqual([10, 50]);
  });

  it("RESOLVE는 실린 status를 그대로 쓴다 — operation에서 유도하지 않는다", () => {
    // 같은 operation=RESOLVE 가 질문은 CLOSED/RESOLVED 로, 결과는 OPEN/null 로 만든다.
    const state = apply([
      changed(
        head({
          candidateId: "0HZX2K7M9Q4AQ",
          kind: "QUESTION",
          revision: 2,
          operation: "RESOLVE",
          status: "CLOSED",
          closeReason: "RESOLVED",
          content: "인덱스를 줄이면 조회 손해가 얼마나 되나",
          createdSequence: 20,
        })
      ),
      changed(
        head({
          candidateId: "0HZX2K7M9Q4AR",
          kind: "STATUS_REPORT",
          operation: "RESOLVE",
          status: "OPEN",
          closeReason: null,
          resolvesCandidateId: "0HZX2K7M9Q4AQ",
          content: "조회 손해는 15% 안쪽이다",
          createdSequence: 21,
        }),
        "0HZX2K7M9Q4B2"
      ),
    ]);

    // 결과 후보는 최상위가 아니라 질문 아래로 들어간다.
    const [question] = selectCards(state);
    expect(question).toMatchObject({
      candidateId: "0HZX2K7M9Q4AQ",
      status: "CLOSED",
      closeReason: "RESOLVED",
    });
    expect(question.results).toHaveLength(1);
    expect(question.results[0]).toMatchObject({
      candidateId: "0HZX2K7M9Q4AR",
      status: "OPEN",
      closeReason: null,
    });
  });

  it("결과 후보가 resolvesCandidateId로 질문에 매달린다", () => {
    const state = apply([
      changed(
        head({ candidateId: "0HZX2K7M9Q4AQ", kind: "QUESTION", createdSequence: 20 })
      ),
      changed(
        head({
          candidateId: "0HZX2K7M9Q4AR",
          resolvesCandidateId: "0HZX2K7M9Q4AQ",
          createdSequence: 21,
        }),
        "0HZX2K7M9Q4B2"
      ),
    ]);

    const question = selectCards(state).find(
      (card) => card.candidateId === "0HZX2K7M9Q4AQ"
    );
    expect(question?.results.map((r) => r.candidateId)).toEqual(["0HZX2K7M9Q4AR"]);
    // 결과는 최상위에 두 번 나오지 않는다.
    expect(selectCards(state)).toHaveLength(1);
  });

  it("철회된 후보도 목록에 남는다 — 되짚을 표면이 사라지면 안 된다", () => {
    const state = apply([
      changed(
        head({
          candidateId: "0HZX2K7M9Q4A1",
          revision: 2,
          operation: "RETRACT",
          status: "CLOSED",
          closeReason: "RETRACTED",
        })
      ),
    ]);

    expect(selectCards(state)).toHaveLength(1);
    expect(selectCards(state)[0].closeReason).toBe("RETRACTED");
  });

  it("같은 eventId의 batch가 두 번 와도 범위를 한 번만 센다", () => {
    const coverage = range({ runKey: "run-1" });
    const state = apply([
      batch(coverage, "0HZX2K7M9Q4C1"),
      batch(coverage, "0HZX2K7M9Q4C1"),
    ]);

    expect(state.appliedRanges).toHaveLength(1);
  });

  it("마지막 갱신 시각은 batch의 occurredAt에서 온다", () => {
    const state = apply([
      batch({ ...range(), appliedAt: "2026-08-24T02:00:00.000Z" }, "0HZX2K7M9Q4C1"),
    ]);

    expect(state.lastBatchAt).toBe("2026-08-24T02:00:00.000Z");
  });

  it("적용 범위 사이의 구멍이 읽지 못한 구간이다", () => {
    const state = apply([
      batch(
        range({ fromSequence: 1, toSequence: 10, fromStartedAtMs: 0, toEndedAtMs: 100_000 }),
        "0HZX2K7M9Q4C1"
      ),
      batch(
        range({
          runKey: "run-3",
          fromSequence: 16,
          toSequence: 25,
          fromStartedAtMs: 160_000,
          toEndedAtMs: 250_000,
        }),
        "0HZX2K7M9Q4C3"
      ),
    ]);

    expect(findCoverageGaps(state.appliedRanges)).toEqual([
      { fromSequence: 11, toSequence: 15, fromStartedAtMs: 100_000, toEndedAtMs: 160_000 },
    ]);
  });

  it("범위가 이어지면 구멍이 없다", () => {
    const state = apply([
      batch(range({ fromSequence: 1, toSequence: 10 }), "0HZX2K7M9Q4C1"),
      batch(
        range({
          runKey: "run-2",
          fromSequence: 11,
          toSequence: 20,
          fromStartedAtMs: 100_000,
          toEndedAtMs: 200_000,
        }),
        "0HZX2K7M9Q4C2"
      ),
    ]);

    expect(findCoverageGaps(state.appliedRanges)).toEqual([]);
  });

  it("범위가 도착 순서와 무관하게 fromSequence로 정렬된다", () => {
    const state = apply([
      batch(
        range({ runKey: "run-2", fromSequence: 11, toSequence: 20 }),
        "0HZX2K7M9Q4C2"
      ),
      batch(range({ runKey: "run-1", fromSequence: 1, toSequence: 10 }), "0HZX2K7M9Q4C1"),
    ]);

    expect(state.appliedRanges.map((r) => r.fromSequence)).toEqual([1, 11]);
  });

  it("snapshot을 받으면 임시 상태를 버리고 그것으로 선다", () => {
    const live = apply([changed(head({ candidateId: "0HZX2K7M9Q4A1" }))]);
    const settled = reduceContextEvent(live, {
      type: "snapshot",
      candidates: [head({ candidateId: "0HZX2K7M9Q4A2", createdSequence: 5 })],
      appliedRanges: [range()],
    });

    expect(selectCards(settled).map((c) => c.candidateId)).toEqual(["0HZX2K7M9Q4A2"]);
    expect(settled.needsRefetch).toBe(false);
  });
});
