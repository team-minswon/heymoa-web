import { describe, expect, it } from "vitest";

import {
  formatGapDuration,
  spansCalendarDays,
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
      gap({
        gapId: "b",
        kind: "UPLOAD",
        startedAtMs: 5_000,
        endedAtMs: 25_000,
      }),
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
      // 열려 있을 수 있는 것은 CAPTURE 뿐이다 — UPLOAD 는 구멍 다음 번호가 도착해야
      // 알 수 있어서 발견되는 순간 이미 닫혀 있다.
      gap({
        gapId: "b",
        kind: "CAPTURE",
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
  it("1분 미만은 길이를 안 쓴다 — 40초의 40이 뜻을 안 바꾼다", () => {
    expect(formatGapDuration(16_000)).toBe("잠깐");
    expect(formatGapDuration(59_000)).toBe("잠깐");
  });

  it("단위 하나만 반올림해서 쓴다", () => {
    expect(formatGapDuration(588_000)).toBe("약 10분");
    expect(formatGapDuration(9_000_000)).toBe("약 3시간");
    expect(formatGapDuration(216_000_000)).toBe("약 3일");
  });

  it("반올림한 뒤에 칸을 고른다 — 약 60분이 아니라 약 1시간이다", () => {
    expect(formatGapDuration(3_580_000)).toBe("약 1시간");
    expect(formatGapDuration(86_390_000)).toBe("약 1일");
  });
});

describe("spansCalendarDays", () => {
  it("날을 넘긴 중지를 가려낸다", () => {
    const [sameDay] = toGapRows([
      gap({
        kind: "PAUSE",
        startedAt: "2026-08-18T01:00:00Z",
        endedAt: "2026-08-18T05:00:00Z",
      }),
    ]);
    const [acrossDays] = toGapRows([
      gap({
        kind: "PAUSE",
        startedAt: "2026-08-18T01:00:00Z",
        endedAt: "2026-08-20T13:30:00Z",
      }),
    ]);

    expect(spansCalendarDays(sameDay)).toBe(false);
    expect(spansCalendarDays(acrossDays)).toBe(true);
  });

  it("진행 중이면 끝이 없으니 false 다", () => {
    const [row] = toGapRows([gap({ endedAt: null })]);
    expect(spansCalendarDays(row)).toBe(false);
  });
});
