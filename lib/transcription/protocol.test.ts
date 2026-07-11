import { describe, expect, it } from "vitest";
import { parseServerEvent } from "@/lib/transcription/protocol";

describe("parseServerEvent", () => {
  it("accepts a Partial snapshot", () => {
    expect(
      parseServerEvent(
        JSON.stringify({
          type: "TRANSCRIPT_PARTIAL",
          itemId: "provider-item-1",
          text: "안녕하세요",
        })
      )
    ).toMatchObject({
      type: "TRANSCRIPT_PARTIAL",
      text: "안녕하세요",
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
