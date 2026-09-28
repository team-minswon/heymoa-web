import { describe, expect, it } from "vitest";

import {
  initialNoteRealtimeState,
  noteRealtimeReducer,
  type NoteRealtimeState,
} from "@/lib/notes/note-realtime-reducer";
import type { NoteTopicFinalSegment } from "@/lib/notes/note-topic-protocol";

const final = (sequence: number, text = `발화 ${sequence}`) =>
  ({
    type: "transcript.final",
    transcriptionSessionId: "0HZX2K7M9Q4AG",
    segmentId: `0HZX2K7M9Q4S${sequence}`,
    utteranceId: `0HZX2K7M9Q4U${sequence}`,
    sequence,
    text,
    startedAtMs: sequence * 1_000,
    endedAtMs: sequence * 1_000 + 500,
  }) satisfies NoteTopicFinalSegment;

const partial = (transcriptionSessionId: string) =>
  ({
    type: "transcript.partial",
    transcriptionSessionId,
    utteranceId: "0HZX2K7M9Q4UP",
    confirmedText: "확정",
    pendingText: " 미확정",
  }) as const;

function apply(...events: Parameters<typeof noteRealtimeReducer>[1][]) {
  return events.reduce<NoteRealtimeState>(
    noteRealtimeReducer,
    noteRealtimeReducer(initialNoteRealtimeState, {
      type: "reset",
      noteId: "note",
    })
  );
}

describe("noteRealtimeReducer", () => {
  it("catch-up 은 저장본 번호 이하만 덜어 내고 아직 저장 안 된 확정 발화는 남긴다", () => {
    const state = apply(
      { type: "event", event: final(1) },
      { type: "event", event: final(2) },
      { type: "event", event: final(3) },
      { type: "event", event: partial("0HZX2K7M9Q4AG") },
      { type: "transcript-reset", persistedThrough: 2 }
    );

    expect(state.finalSegments.map((segment) => segment.sequence)).toEqual([3]);
    expect(state.partial).toBeNull();
  });

  it("저장본을 모르면 확정 발화를 하나도 덜지 않는다", () => {
    const state = apply(
      { type: "event", event: final(1) },
      { type: "transcript-reset", persistedThrough: null }
    );

    expect(state.finalSegments).toHaveLength(1);
  });

  it("같은 segmentId 의 교정본은 자리를 지켜 바꾼다", () => {
    const state = apply(
      { type: "event", event: final(1) },
      { type: "event", event: final(2) },
      { type: "event", event: final(1, "고친 문장") }
    );

    expect(state.finalSegments.map((segment) => segment.text)).toEqual([
      "고친 문장",
      "발화 2",
    ]);
  });

  it("recording.stopped 는 그 세션의 partial 만 지운다", () => {
    const stopped = {
      type: "recording.stopped",
      transcriptionSessionId: "0HZX2K7M9Q4AG",
    } as Extract<
      Parameters<typeof noteRealtimeReducer>[1],
      { type: "event" }
    >["event"];

    expect(
      apply(
        { type: "event", event: partial("0HZX2K7M9Q4AH") },
        { type: "event", event: stopped }
      ).partial
    ).not.toBeNull();
    expect(
      apply(
        { type: "event", event: partial("0HZX2K7M9Q4AG") },
        { type: "event", event: stopped }
      ).partial
    ).toBeNull();
  });
});
