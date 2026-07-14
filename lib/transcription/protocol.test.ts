import { describe, expect, it } from "vitest";
import {
  parseClientCommand,
  parseServerEvent,
} from "@/lib/transcription/protocol";

describe("AsyncAPI transcription protocol", () => {
  it("accepts only the current lowercase client commands", () => {
    expect(parseClientCommand('{"type":"commit"}')).toEqual({
      type: "commit",
    });
    expect(parseClientCommand('{"type":"stop"}')).toEqual({ type: "stop" });
    expect(() => parseClientCommand('{"type":"SESSION_PAUSE"}')).toThrow();
  });

  it("accepts a partial snapshot keyed by utterance ID", () => {
    expect(
      parseServerEvent(
        JSON.stringify({
          type: "partial",
          utteranceId: "0HZX2K7M9Q4AC",
          text: "안녕하세요",
        })
      )
    ).toMatchObject({
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "안녕하세요",
    });
  });

  it("accepts a flat final event", () => {
    expect(
      parseServerEvent(
        JSON.stringify({
          type: "final",
          segmentId: "0HZX2K7M9Q4AD",
          utteranceId: "0HZX2K7M9Q4AC",
          sequence: 1,
          text: "확정된 문장",
          startedAtMs: 0,
          endedAtMs: 1200,
        })
      )
    ).toMatchObject({ type: "final", sequence: 1 });
  });
});
