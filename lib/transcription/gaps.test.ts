import { describe, expect, it } from "vitest";

import {
  formatGapDuration,
  spansVisibleClockMinutes,
  toGapRows,
  type TranscriptGap,
} from "@/lib/transcription/gaps";

function gap(partial: Partial<TranscriptGap>): TranscriptGap {
  return {
    gapId: "g1",
    kind: "CAPTURE",
    startedAtMs: 0,
    endedAtMs: 1_000,
    startedAt: "2026-08-18T10:00:00Z",
    endedAt: "2026-08-18T10:00:01Z",
    reason: null,
    ...partial,
  };
}

describe("toGapRows", () => {
  it("접는다 — 세 종류가 두 부류가 된다", () => {
    const rows = toGapRows([
      gap({ gapId: "a", kind: "CAPTURE", startedAtMs: 0, endedAtMs: 1_000 }),
      gap({ gapId: "b", kind: "UPLOAD", startedAtMs: 5_000, endedAtMs: 6_000 }),
      gap({
        gapId: "c",
        kind: "PAUSE",
        startedAtMs: 10_000,
        endedAtMs: 10_000,
      }),
    ]);

    expect(rows.map((row) => row.kind)).toEqual(["LOST", "LOST", "PAUSE"]);
  });

  it("겹친 사고 공백을 행 하나로 합친다", () => {
    const rows = toGapRows([
      gap({ gapId: "a", kind: "CAPTURE", startedAtMs: 0, endedAtMs: 20_000 }),
      gap({ gapId: "b", kind: "UPLOAD", startedAtMs: 5_000, endedAtMs: 25_000 }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "LOST",
      startedAtMs: 0,
      endedAtMs: 25_000,
      durationMs: 25_000,
    });
  });

  it("맞닿지 않은 사고는 따로 남긴다", () => {
    const rows = toGapRows([
      gap({ gapId: "a", startedAtMs: 0, endedAtMs: 1_000 }),
      gap({ gapId: "b", startedAtMs: 60_000, endedAtMs: 61_000 }),
    ]);

    expect(rows).toHaveLength(2);
  });

  it("중지는 점이고 길이가 벽시계에서 온다", () => {
    const rows = toGapRows([
      gap({
        gapId: "p",
        kind: "PAUSE",
        startedAtMs: 612_000,
        endedAtMs: 612_000,
        startedAt: "2026-08-18T10:10:12Z",
        endedAt: "2026-08-18T10:19:41Z",
      }),
    ]);

    // 회의 축의 차는 0이다 — 축이 안 나아갔다
    expect(rows[0].endedAtMs - rows[0].startedAtMs).toBe(0);
    expect(rows[0].durationMs).toBe(569_000);
  });

  it("진행 중 공백은 끝이 열려 있다", () => {
    const rows = toGapRows([
      gap({ gapId: "a", startedAtMs: 0, endedAtMs: 4_000, endedAt: null }),
    ]);

    expect(rows[0].endedAt).toBeNull();
  });

  it("겹친 것 중 하나가 진행 중이면 합친 행도 진행 중이다", () => {
    const rows = toGapRows([
      gap({ gapId: "a", startedAtMs: 0, endedAtMs: 20_000 }),
      gap({
        gapId: "b",
        kind: "UPLOAD",
        startedAtMs: 5_000,
        endedAtMs: 25_000,
        endedAt: null,
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].endedAt).toBeNull();
  });
});

describe("spansVisibleClockMinutes", () => {
  it("같은 분이면 절대 시각을 숨긴다", () => {
    // 「09:10에 멈추고 09:10에 재개했습니다」가 실제로 나왔고 우스꽝스러웠다
    const [row] = toGapRows([
      gap({
        kind: "PAUSE",
        startedAt: "2026-08-18T09:10:02Z",
        endedAt: "2026-08-18T09:10:41Z",
      }),
    ]);

    expect(spansVisibleClockMinutes(row)).toBe(false);
  });

  it("분이 다르면 보인다", () => {
    const [row] = toGapRows([
      gap({
        kind: "PAUSE",
        startedAt: "2026-08-18T09:10:02Z",
        endedAt: "2026-08-18T09:20:41Z",
      }),
    ]);

    expect(spansVisibleClockMinutes(row)).toBe(true);
  });
});

describe("formatGapDuration", () => {
  it("분과 초를 사람이 읽는 대로 쓴다", () => {
    expect(formatGapDuration(16_000)).toBe("16초");
    expect(formatGapDuration(120_000)).toBe("2분");
    expect(formatGapDuration(588_000)).toBe("9분 48초");
  });
});
