import { describe, expect, it } from "vitest";
import {
  initialTranscriptState,
  transcriptReducer,
} from "@/lib/transcription/transcript-reducer";

describe("transcriptReducer", () => {
  it("replaces Partial snapshots and removes them on Final", () => {
    const first = transcriptReducer(initialTranscriptState, {
      type: "TRANSCRIPT_PARTIAL",
      itemId: "item-1",
      text: "안녕",
      startedAtMs: 0,
    });
    const second = transcriptReducer(first, {
      type: "TRANSCRIPT_PARTIAL",
      itemId: "item-1",
      text: "안녕하세요",
      startedAtMs: 0,
    });
    const final = transcriptReducer(second, {
      type: "TRANSCRIPT_FINAL",
      itemId: "item-1",
      segment: {
        segmentId: "01K0000000011",
        sessionId: "01K0000000010",
        sequence: 1,
        text: "안녕하세요",
        startedAtMs: 0,
        endedAtMs: 1200,
      },
    });
    expect(second.partialByItemId["item-1"]).toBe("안녕하세요");
    expect(final.partialByItemId["item-1"]).toBeUndefined();
    expect(final.finalSegments).toHaveLength(1);
  });
});
