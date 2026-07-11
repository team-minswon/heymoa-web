import { describe, expect, it, vi } from "vitest";
import { MockTranscriptionScenario } from "@/lib/mocks/transcription-scenario";

describe("MockTranscriptionScenario", () => {
  it("keeps pause and resume in one session", () => {
    const send = vi.fn();
    const scenario = new MockTranscriptionScenario("01K0000000010", send);
    scenario.open();
    scenario.receive({ type: "SESSION_PAUSE" });
    scenario.receive({ type: "SESSION_RESUME" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SESSION_STATUS", status: "PAUSED" })
    );
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "SESSION_STATUS", status: "STREAMING" })
    );
  });
});
