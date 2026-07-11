import { describe, expect, it } from "vitest";
import type {
  TranscriptSegmentResponse,
  TranscriptionSessionResponse,
} from "@/lib/api/generated/models";

describe("transcription generated models", () => {
  it("represents one persisted final segment", () => {
    const session: TranscriptionSessionResponse = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "STREAMING",
      language: "ko",
      startedBy: { userId: "01K0000000003", name: "테스트 유저" },
      startedAt: "2026-07-11T00:00:00Z",
      endedAt: null,
    };
    const segment: TranscriptSegmentResponse = {
      segmentId: "01K0000000011",
      sessionId: session.sessionId,
      sequence: 1,
      text: "확정 문장",
      startedAtMs: 0,
      endedAtMs: 1200,
    };
    expect(segment.sessionId).toBe(session.sessionId);
  });
});
