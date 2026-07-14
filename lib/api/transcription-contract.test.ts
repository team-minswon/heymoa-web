import { describe, expect, it } from "vitest";
import type {
  TranscriptResponseDataSegmentsItem,
  TranscriptionSessionResponseData,
} from "@/lib/api/generated/models";

describe("transcription generated models", () => {
  it("represents one persisted final segment", () => {
    const session: TranscriptionSessionResponseData = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "STREAMING",
      readyExpiresAt: "2026-07-11T00:10:00Z",
      startedAt: "2026-07-11T00:00:00Z",
      endedAt: null,
      endReason: null,
    };
    const segment: TranscriptResponseDataSegmentsItem = {
      segmentId: "01K0000000011",
      transcriptionSessionId: session.sessionId,
      sequence: 1,
      text: "확정 문장",
      startedAtMs: 0,
      endedAtMs: 1200,
    };
    expect(segment.transcriptionSessionId).toBe(session.sessionId);
  });
});
