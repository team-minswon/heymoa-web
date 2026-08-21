import { describe, expect, it } from "vitest";

import type { GapRow } from "@/lib/transcription/gaps";
import {
  formatOffset,
  interleaveTranscript,
  type TranscriptPresentationSegment,
} from "@/lib/transcription/presentation";

function segment(
  segmentId: string,
  sequence: number,
  text: string,
  startedAtMs: number,
  endedAtMs: number,
  speakerLabel: string | null = null
): TranscriptPresentationSegment {
  return { segmentId, sequence, text, startedAtMs, endedAtMs, speakerLabel };
}

function gap(gapId: string, startedAtMs: number): GapRow {
  return {
    gapId,
    kind: "PAUSE",
    startedAtMs,
    endedAtMs: startedAtMs,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(startedAtMs + 60_000).toISOString(),
    durationMs: 60_000,
  };
}

describe("formatOffset", () => {
  it("한 시간 미만은 mm:ss 다", () => {
    expect(formatOffset(0)).toBe("00:00");
    expect(formatOffset(1_820_000)).toBe("30:20");
    expect(formatOffset(3_599_000)).toBe("59:59");
  });

  it("한 시간을 넘으면 시를 붙인다", () => {
    // 예전에는 90분 회의의 마지막 발화가 `90:00`으로 나왔다
    expect(formatOffset(3_600_000)).toBe("1:00:00");
    expect(formatOffset(5_400_000)).toBe("1:30:00");
    expect(formatOffset(7_265_000)).toBe("2:01:05");
  });
});

describe("interleaveTranscript", () => {
  it("세그먼트 하나가 행 하나다 — 이어 붙이지 않는다", () => {
    // 묶기(6세그먼트·30초·1.5초·260자)를 지운 뒤의 계약이다. 이 단언이 깨지면
    // 묶기가 어디선가 되살아난 것이다.
    const rows = interleaveTranscript(
      [
        segment("s1", 1, "첫 번째 문장입니다.", 0, 800),
        segment("s2", 2, "두 번째 문장입니다.", 1_000, 1_800),
      ],
      []
    );

    expect(rows).toEqual([
      expect.objectContaining({
        type: "segment",
        startedAtMs: 0,
        segment: expect.objectContaining({ segmentId: "s1" }),
      }),
      expect.objectContaining({
        type: "segment",
        startedAtMs: 1_000,
        segment: expect.objectContaining({ segmentId: "s2" }),
      }),
    ]);
  });

  it("화자가 같아도 안 묶는다", () => {
    const rows = interleaveTranscript(
      [
        segment("s1", 1, "앞", 0, 800, "A"),
        segment("s2", 2, "뒤", 1_000, 1_800, "A"),
      ],
      []
    );

    expect(rows).toHaveLength(2);
  });

  it("서버 좌표를 그대로 쓴다 — 브라우저가 더하지 않는다", () => {
    const rows = interleaveTranscript(
      [
        segment("s1", 1, "첫 세션", 0, 2_000),
        segment("s2", 2, "다음 세션", 620_000, 621_000),
      ],
      []
    );

    expect(rows.map((row) => row.startedAtMs)).toEqual([0, 620_000]);
  });

  it("회의 축 순서로 세우고 같은 좌표면 공백이 먼저다", () => {
    const rows = interleaveTranscript(
      [segment("s2", 2, "뒤", 2_000, 2_800), segment("s1", 1, "앞", 0, 800)],
      [gap("g1", 2_000)]
    );

    expect(rows.map((row) => [row.type, row.startedAtMs])).toEqual([
      ["segment", 0],
      ["gap", 2_000],
      ["segment", 2_000],
    ]);
  });

  it("빈 발화는 행을 만들지 않는다", () => {
    // 서버는 안 보내지만 오면 빈 행이 된다 — 없는 것을 있는 것처럼 그리지 않는다.
    const rows = interleaveTranscript(
      [segment("s1", 1, "   ", 0, 800), segment("s2", 2, "본문", 1_000, 1_800)],
      []
    );

    expect(rows).toHaveLength(1);
  });
});
