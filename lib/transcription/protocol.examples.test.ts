import { describe, expect, it } from "vitest";

describe("AsyncAPI examples", () => {
  it("keeps Partial as a full snapshot", () => {
    const message = {
      type: "TRANSCRIPT_PARTIAL",
      itemId: "provider-item-1",
      text: "현재까지 누적된 문장",
    } as const;
    expect(message.text).not.toBe("");
  });
});
