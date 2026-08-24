import { describe, expect, it } from "vitest";

import type { AppliedRange } from "@/lib/notes/context-candidates/contract";
import { withCoverageRows } from "@/lib/notes/context-candidates/timeline";
import type { TranscriptRow } from "@/lib/transcription/presentation";

function segment(startedAtMs: number, segmentId: string): TranscriptRow {
  return {
    type: "segment",
    startedAtMs,
    segment: {
      segmentId,
      sequence: startedAtMs / 10_000,
      text: "발화",
      startedAtMs,
      endedAtMs: startedAtMs + 5_000,
    },
  };
}

function range(
  fromSequence: number,
  toSequence: number,
  over: Partial<AppliedRange> = {}
): AppliedRange {
  return {
    runKey: `run-${fromSequence}`,
    applyStatus: "APPLIED",
    fromSequence,
    toSequence,
    fromStartedAtMs: fromSequence * 10_000,
    toEndedAtMs: toSequence * 10_000,
    rawDeltaSaturated: false,
    semanticUnitSaturated: false,
    appliedAt: "2026-08-24T01:00:00.000Z",
    ...over,
  };
}

describe("withCoverageRows", () => {
  it("범위가 이어지면 아무것도 얹지 않는다", () => {
    const rows = [segment(10_000, "a"), segment(20_000, "b")];
    expect(withCoverageRows(rows, [range(1, 10), range(11, 20)])).toEqual(rows);
  });

  it("범위 구멍이 회의 축의 제자리에 선다", () => {
    const rows = [segment(50_000, "a"), segment(200_000, "b")];
    const merged = withCoverageRows(rows, [range(1, 10), range(16, 25)]);

    expect(merged.map((row) => row.type)).toEqual([
      "segment", // 50_000
      "coverage-gap", // 100_000 – 160_000
      "segment", // 200_000
    ]);
  });

  it("포화 구간은 그 끝에 선다", () => {
    const rows = [segment(50_000, "a")];
    const merged = withCoverageRows(rows, [
      range(1, 10, { rawDeltaSaturated: true }),
    ]);

    const saturated = merged.find((row) => row.type === "saturated");
    expect(saturated).toBeDefined();
    expect(saturated!.startedAtMs).toBe(100_000);
  });

  it("두 flag 중 하나만 참이어도 얹는다", () => {
    const merged = withCoverageRows(
      [],
      [range(1, 10, { semanticUnitSaturated: true })]
    );
    expect(merged.map((row) => row.type)).toEqual(["saturated"]);
  });

  /**
   * **포화 flag 만 보면 드롭이 안 보인다.** 실전사 108발화에서 13런 중 포화는 1건인데
   * 모델 출력 26건이 버려졌다. 그 구간을 「읽었다」로 그리면 범위가 찼다는 표시가 내용이
   * 담겼다는 뜻으로 읽힌다 — 빈 화면보다 나쁘다.
   */
  it("PARTIAL_RECORDED 도 포화와 같은 자리에 선다 — 사용자가 할 일이 같다", () => {
    const merged = withCoverageRows(
      [],
      [range(1, 10, { applyStatus: "PARTIAL_RECORDED" })]
    );
    expect(merged.map((row) => row.type)).toEqual(["saturated"]);
  });

  it("APPLIED 이고 포화도 아니면 아무것도 안 얹는다", () => {
    expect(withCoverageRows([], [range(1, 10)])).toEqual([]);
  });

  it("같은 좌표에서는 전사가 먼저다 — 안내가 그 구간 발화보다 위에 서면 안 된다", () => {
    const rows = [segment(100_000, "a")];
    const merged = withCoverageRows(rows, [
      range(1, 10, { rawDeltaSaturated: true }),
    ]);

    expect(merged.map((row) => row.type)).toEqual(["segment", "saturated"]);
  });

  it("원본 배열을 건드리지 않는다 — 복사에 나가는 전사와 화면용이 갈린다", () => {
    // 마크다운 복사는 회의록이라 분류 커버리지 같은 화면 주석이 섞이면 안 된다.
    // `transcript-view` 가 `rows`(전사) 와 `renderRows`(전사+커버리지) 를 나눠 쓰는 근거다.
    const rows = [segment(50_000, "a")];
    const before = [...rows];
    withCoverageRows(rows, [range(1, 10, { rawDeltaSaturated: true })]);
    expect(rows).toEqual(before);
    expect(rows).toHaveLength(1);
  });

  it("포화가 아닌 범위는 아무것도 얹지 않는다", () => {
    expect(withCoverageRows([], [range(1, 10)])).toEqual([]);
  });
});
