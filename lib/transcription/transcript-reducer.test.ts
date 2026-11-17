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
      confirmedText: "첫",
      pendingText: " snapshot",
    });
    const second = transcriptReducer(first, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      confirmedText: "누적",
      pendingText: " snapshot",
    });

    expect(second.partial).toEqual({
      utteranceId: "0HZX2K7M9Q4AC",
      confirmedText: "누적",
      pendingText: " snapshot",
    });
  });

  it("removes a partial when its final arrives and marks completion", () => {
    const partial = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      confirmedText: "안녕하세요",
      pendingText: "",
    });
    const final = transcriptReducer(partial, {
      type: "final",
      segmentId: "0HZX2K7M9Q4AD",
      utteranceId: "0HZX2K7M9Q4AC",
      sequence: 1,
      text: "안녕하세요",
      startedAtMs: 0,
      endedAtMs: 1200,
      speakerLabel: null,
    });
    const completed = transcriptReducer(final, {
      type: "completed",
      sessionId: "0HZX2K7M9Q4AB",
    });

    expect(final.partial).toBeNull();
    expect(final.finalSegments).toHaveLength(1);
    expect(completed.partial).toBeNull();
    expect(completed.completed).toBe(true);
  });

  it("drops unfinished and late partials once the session completes", () => {
    const partial = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      confirmedText: "완료 직전",
      pendingText: " 문장",
    });
    const completed = transcriptReducer(partial, {
      type: "completed",
      sessionId: "0HZX2K7M9Q4AB",
    });

    expect(
      transcriptReducer(completed, {
        type: "partial",
        utteranceId: "0HZX2K7M9Q4AC",
        confirmedText: "늦게 도착한",
        pendingText: " 문장",
      })
    ).toEqual(completed);
  });

  it("clears an unfinished partial when a recording fails", () => {
    const partial = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      confirmedText: "저장되지 않은",
      pendingText: " 문장",
    });

    expect(
      transcriptReducer(partial, { type: "clear-partials" }).partial
    ).toBeNull();
  });

  it("replaces the previous utterance when a new utteranceId arrives", () => {
    const first = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      confirmedText: "안녕하세요",
      pendingText: " 오늘은",
    });
    const next = transcriptReducer(first, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AE",
      confirmedText: "다음",
      pendingText: " 안건은",
    });

    expect(next.partial).toEqual({
      utteranceId: "0HZX2K7M9Q4AE",
      confirmedText: "다음",
      pendingText: " 안건은",
    });
  });

  it("id가 더 이른 final이 와도 현재 partial을 비운다", () => {
    const live = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AE",
      confirmedText: "다음",
      pendingText: " 안건은",
    });

    const final = transcriptReducer(live, {
      type: "final",
      segmentId: "0HZX2K7M9Q4AD",
      utteranceId: "0HZX2K7M9Q4AC",
      sequence: 1,
      text: "안녕하세요 오늘은",
      startedAtMs: 0,
      endedAtMs: 1200,
      speakerLabel: null,
    });

    expect(final.partial).toBeNull();
    expect(final.finalSegments).toHaveLength(1);
  });

  it("더 나중 발화의 final이 오면 앞선 고아 partial도 지운다", () => {
    const orphan = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      confirmedText: "확정되지 못한",
      pendingText: " 문장",
    });

    const laterFinal = transcriptReducer(orphan, {
      type: "final",
      segmentId: "0HZX2K7M9Q4AD",
      utteranceId: "0HZX2K7M9Q4AE",
      sequence: 1,
      text: "다음 발화의 확정",
      startedAtMs: 0,
      endedAtMs: 1200,
      speakerLabel: null,
    });

    expect(laterFinal.partial).toBeNull();
  });

  it("resets all live state before a new session", () => {
    const previous = transcriptReducer(initialTranscriptState, {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      confirmedText: "이전",
      pendingText: " 세션",
    });

    expect(transcriptReducer(previous, { type: "reset" })).toEqual(
      initialTranscriptState
    );
  });
});
