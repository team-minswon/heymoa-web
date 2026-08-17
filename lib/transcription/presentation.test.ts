import { describe, expect, it } from "vitest";

import {
  formatOffset,
  groupTranscriptSegments,
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

describe("groupTranscriptSegments", () => {
  it("서버 좌표를 그대로 쓴다 — 브라우저가 더하지 않는다", () => {
    const blocks = groupTranscriptSegments([
      segment("s1", 1, "첫 세션", 0, 2_000),
      segment("s2", 2, "다음 세션", 620_000, 621_000),
    ]);

    expect(blocks.map((block) => block.startedAtMs)).toEqual([0, 620_000]);
  });

  it("이어지는 발화를 한 블록으로 묶는다", () => {
    const blocks = groupTranscriptSegments([
      segment("s1", 1, " 첫 번째  문장입니다. ", 0, 800),
      segment("s2", 2, "두 번째 문장입니다.", 1_000, 1_800),
    ]);

    expect(blocks).toEqual([
      expect.objectContaining({
        blockId: "s1",
        segmentIds: ["s1", "s2"],
        text: "첫 번째 문장입니다. 두 번째 문장입니다.",
        startedAtMs: 0,
        endedAtMs: 1_800,
      }),
    ]);
  });

  it("화자가 다르면 블록을 가른다", () => {
    // 한 덩어리에 두 사람의 말이 섞이면 화자 라벨이 거짓이 된다
    const blocks = groupTranscriptSegments([
      segment("s1", 1, "제안합니다", 0, 800, "A"),
      segment("s2", 2, "저는 반대입니다", 1_000, 1_800, "B"),
    ]);

    expect(blocks.map((block) => block.speakerLabel)).toEqual(["A", "B"]);
  });

  it("화자가 같으면 묶는다", () => {
    const blocks = groupTranscriptSegments([
      segment("s1", 1, "앞", 0, 800, "A"),
      segment("s2", 2, "뒤", 1_000, 1_800, "A"),
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].speakerLabel).toBe("A");
  });

  it("화자가 없는 것과 있는 것을 안 섞는다", () => {
    const blocks = groupTranscriptSegments([
      segment("s1", 1, "분리 전", 0, 800, null),
      segment("s2", 2, "분리 후", 1_000, 1_800, "A"),
    ]);

    expect(blocks).toHaveLength(2);
  });

  it("침묵이 길면 새 블록으로 간다", () => {
    const blocks = groupTranscriptSegments([
      segment("s1", 1, "앞 문장", 0, 500),
      segment("s2", 2, "긴 침묵 뒤 문장", 2_001, 2_800),
    ]);

    expect(blocks.map((block) => block.segmentIds)).toEqual([["s1"], ["s2"]]);
  });

  it("블록 글자 수 상한을 넘기지 않는다", () => {
    const longText = "가".repeat(250);
    const blocks = groupTranscriptSegments([
      segment("s1", 1, longText, 0, 800),
      segment("s2", 2, "나".repeat(20), 900, 1_600),
    ]);

    expect(blocks.map((block) => block.text)).toEqual([
      longText,
      "나".repeat(20),
    ]);
  });
});
