import { describe, expect, it } from "vitest";

import type { GapRow } from "@/lib/transcription/gaps";
import {
  formatOffset,
  interleaveTranscript,
  mergeLiveSegments,
  selectLivePartial,
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

describe("mergeLiveSegments", () => {
  it("저장본이 정본이고 실시간 사본은 저장본에 없는 발화만 뒤에 메운다", () => {
    const persisted = [segment("a", 1, "저장본", 0, 1_000)];
    const merged = mergeLiveSegments(
      persisted,
      [segment("a", 1, "실시간 사본", 0, 1_000)],
      [segment("b", 2, "새 발화", 1_000, 2_000)]
    );

    expect(merged.map((row) => row.text)).toEqual(["저장본", "새 발화"]);
  });
});

describe("selectLivePartial", () => {
  const live = (utteranceId: string, confirmedText = "안녕하세요") => ({
    utteranceId,
    confirmedText,
    pendingText: " 반갑",
  });
  const source = (
    partial: ReturnType<typeof live> | null,
    finals: string[] = []
  ) => ({
    partial,
    finalSegments: finals.map((utteranceId) => ({ utteranceId })),
  });

  it("이 탭이 녹음 중이거나 멈추는 중이면 녹음 소켓의 partial 을 쓴다", () => {
    for (const phase of ["recording", "stopping"] as const) {
      expect(
        selectLivePartial({
          recordingHere: true,
          phase,
          own: source(live("own", "내 소켓")),
          topic: source(live("topic", "토픽")),
        })?.confirmedText
      ).toBe("내 소켓");
    }
  });

  it("녹음이 끝난 탭은 activeNoteId 가 남아 있어도 토픽의 partial 을 쓴다", () => {
    expect(
      selectLivePartial({
        recordingHere: true,
        phase: "completed",
        own: source(null),
        topic: source(live("topic", "토픽")),
      })?.confirmedText
    ).toBe("토픽");
  });

  it("같은 발화가 이미 확정됐으면 그리지 않는다", () => {
    expect(
      selectLivePartial({
        recordingHere: false,
        phase: "idle",
        own: source(null),
        topic: source(live("u1"), ["u1"]),
      })
    ).toBeNull();
  });

  it("앞 공백만 털고 두 토막 사이 공백은 남긴다", () => {
    expect(
      selectLivePartial({
        recordingHere: false,
        phase: "idle",
        own: source(null),
        topic: source({
          utteranceId: "u",
          confirmedText: "",
          pendingText: "  말",
        }),
      })
    ).toEqual({ confirmedText: "", pendingText: "말" });
    expect(
      selectLivePartial({
        recordingHere: false,
        phase: "idle",
        own: source(null),
        topic: source({
          utteranceId: "u",
          confirmedText: " 앞",
          pendingText: " 뒤",
        }),
      })
    ).toEqual({ confirmedText: "앞", pendingText: " 뒤" });
  });
});
