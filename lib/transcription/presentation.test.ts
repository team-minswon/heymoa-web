import { describe, expect, it } from "vitest";

import {
  groupTranscriptSegments,
  type TranscriptPresentationSegment,
} from "@/lib/transcription/presentation";

function segment(
  segmentId: string,
  transcriptionSessionId: string,
  sequence: number,
  text: string,
  startedAtMs: number,
  endedAtMs: number
): TranscriptPresentationSegment {
  return {
    segmentId,
    transcriptionSessionId,
    sequence,
    text,
    startedAtMs,
    endedAtMs,
  };
}

describe("groupTranscriptSegments", () => {
  it("merges adjacent segments from the same session into one presentation block", () => {
    const blocks = groupTranscriptSegments([
      segment("segment-1", "session-1", 1, " 첫 번째  문장입니다. ", 0, 800),
      segment("segment-2", "session-1", 2, "두 번째 문장입니다.", 1_000, 1_800),
    ]);

    expect(blocks).toEqual([
      expect.objectContaining({
        blockId: "segment-1",
        sessionId: "session-1",
        segmentIds: ["segment-1", "segment-2"],
        text: "첫 번째 문장입니다. 두 번째 문장입니다.",
        startedAtMs: 0,
        endedAtMs: 1_800,
      }),
    ]);
  });

  it("keeps session boundaries and carries the timeline into the next session", () => {
    const blocks = groupTranscriptSegments([
      segment("segment-1", "session-1", 1, "첫 세션", 0, 2_000),
      segment("segment-2", "session-2", 1, "다음 세션", 0, 900),
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      sessionId: "session-1",
      timelineStartedAtMs: 0,
      timelineEndedAtMs: 2_000,
    });
    expect(blocks[1]).toMatchObject({
      sessionId: "session-2",
      timelineStartedAtMs: 2_000,
      timelineEndedAtMs: 2_900,
    });
  });

  it("starts a new block when the silence gap is too large", () => {
    const blocks = groupTranscriptSegments([
      segment("segment-1", "session-1", 1, "앞 문장", 0, 500),
      segment("segment-2", "session-1", 2, "긴 침묵 뒤 문장", 2_001, 2_800),
    ]);

    expect(blocks.map((block) => block.segmentIds)).toEqual([
      ["segment-1"],
      ["segment-2"],
    ]);
  });

  it("starts a new block instead of exceeding the block text-length limit", () => {
    const longText = "가".repeat(250);
    const blocks = groupTranscriptSegments([
      segment("segment-1", "session-1", 1, longText, 0, 800),
      segment("segment-2", "session-1", 2, "나".repeat(20), 900, 1_600),
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks.map((block) => block.text)).toEqual([
      longText,
      "나".repeat(20),
    ]);
  });
});
