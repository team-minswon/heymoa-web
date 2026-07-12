import { describe, expect, it } from "vitest";
import { parseServerEvent } from "@/lib/transcription/protocol";

describe("parseServerEvent", () => {
  it("requires active duration on status events", () => {
    expect(() =>
      parseServerEvent(
        JSON.stringify({
          type: "SESSION_STATUS",
          status: "PAUSED",
        })
      )
    ).toThrow();
  });

  it("accepts a Partial snapshot", () => {
    expect(
      parseServerEvent(
        JSON.stringify({
          type: "TRANSCRIPT_PARTIAL",
          itemId: "provider-item-1",
          text: "안녕하세요",
          startedAtMs: 1200,
        })
      )
    ).toMatchObject({
      type: "TRANSCRIPT_PARTIAL",
      text: "안녕하세요",
      startedAtMs: 1200,
    });
  });

  it("rejects a Final without a persisted segment ID", () => {
    expect(() =>
      parseServerEvent(
        JSON.stringify({
          type: "TRANSCRIPT_FINAL",
          itemId: "provider-item-1",
          segment: { text: "누락" },
        })
      )
    ).toThrow();
  });
});
