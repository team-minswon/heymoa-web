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

  it("delivers COMPLETED before requesting a normal close", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const close = vi.fn();
    const scenario = new MockTranscriptionScenario(
      "01K0000000010",
      send,
      close
    );
    scenario.open();
    scenario.receive({ type: "SESSION_COMPLETE" });

    expect(send).toHaveBeenLastCalledWith({
      type: "SESSION_COMPLETED",
      sessionId: "01K0000000010",
    });
    expect(close).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(close).toHaveBeenCalledWith(1000, "completed");
    vi.useRealTimers();
  });
});
