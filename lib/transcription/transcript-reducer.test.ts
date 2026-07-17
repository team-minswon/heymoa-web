import { describe, expect, it } from "vitest";
import {
  initialTranscriptState,
  transcriptReducer,
} from "@/lib/transcription/transcript-reducer";

describe("transcriptReducer", () => {
  it("replaces partial snapshots for the same utterance", () => {
    const first = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "첫 snapshot",
    });
    const second = transcriptReducer(first, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "누적 snapshot",
    });

    expect(second.partialByUtteranceId["0HZX2K7M9Q4AC"]).toBe("누적 snapshot");
  });

  it("removes a partial when its final arrives and marks completion", () => {
    const partial = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "안녕하세요",
    });
    const final = transcriptReducer(partial, {
      type: "final",
      segmentId: "0HZX2K7M9Q4AD",
      utteranceId: "0HZX2K7M9Q4AC",
      sequence: 1,
      text: "안녕하세요",
      startedAtMs: 0,
      endedAtMs: 1200,
    });
    const completed = transcriptReducer(final, {
      type: "completed",
      sessionId: "0HZX2K7M9Q4AB",
    });

    expect(final.partialByUtteranceId["0HZX2K7M9Q4AC"]).toBeUndefined();
    expect(final.finalSegments).toHaveLength(1);
    expect(completed.partialByUtteranceId).toEqual({});
    expect(completed.completed).toBe(true);
  });

  it("drops unfinished and late partials once the session completes", () => {
    const partial = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "완료 직전 문장",
    });
    const completed = transcriptReducer(partial, {
      type: "completed",
      sessionId: "0HZX2K7M9Q4AB",
    });

    expect(
      transcriptReducer(completed, {
        type: "partial",
        utteranceId: "0HZX2K7M9Q4AC",
        text: "늦게 도착한 문장",
      })
    ).toEqual(completed);
  });

  it("clears an unfinished partial when a recording fails", () => {
    const partial = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "저장되지 않은 문장",
    });

    expect(
      transcriptReducer(partial, { type: "clear-partials" })
        .partialByUtteranceId
    ).toEqual({});
  });

  it("resets all live state before a new session", () => {
    const previous = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "이전 세션",
    });

    expect(transcriptReducer(previous, { type: "reset" })).toEqual(
      initialTranscriptState
    );
  });
});
