import { describe, expect, it } from "vitest";
import { protocolExamples } from "@/lib/transcription/protocol";

describe("AsyncAPI examples", () => {
  it("keeps Partial as a full snapshot", () => {
    expect(protocolExamples.partial.text).not.toBe("");
  });
});
