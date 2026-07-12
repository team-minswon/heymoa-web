import { describe, expect, it, vi } from "vitest";
import {
  createMockTranscriptionScenario,
  MockTranscriptionScenario,
} from "@/lib/mocks/transcription-scenario";
import { mockDb } from "@/lib/mocks/db";

const voicedPcm = new Int16Array(960).fill(12000).buffer;
const silentPcm = new Int16Array(960).buffer;

describe("MockTranscriptionScenario", () => {
  it("commits a growing Partial after sustained voice then silence", async () => {
    mockDb.reset();
    const note = mockDb.createNote(mockDb.workspace.workspaceId, {});
    const session = mockDb.createSession(note.noteId);
    const events: Array<{ type: string; text?: string }> = [];
    const scenario = createMockTranscriptionScenario({
      sessionId: session.sessionId,
      send: (event) => events.push(event),
      config: {
        partialEveryMs: 320,
        finalSilenceMs: 800,
        minimumVoiceMs: 120,
      },
      script: ["이번 주 목표를 확인하겠습니다."],
    });
    scenario.open();

    for (let index = 0; index < 12; index += 1) {
      await scenario.receiveFrame(voicedPcm);
    }
    expect(
      events.filter((event) => event.type === "TRANSCRIPT_PARTIAL").at(-1)?.text
    ).toContain("목표를");

    for (let index = 0; index < 20; index += 1) {
      await scenario.receiveFrame(silentPcm);
    }
    expect(
      events.filter((event) => event.type === "TRANSCRIPT_FINAL")
    ).toHaveLength(1);
    expect(mockDb.listSegments(note.noteId).items).toHaveLength(1);
  });

  it("keeps pause and resume in one session", async () => {
    const send = vi.fn();
    const scenario = new MockTranscriptionScenario("01K0000000010", send);
    scenario.open();
    await scenario.receiveFrame(voicedPcm);
    scenario.receive({ type: "SESSION_PAUSE" });
    const pausedDuration =
      mockDb.getSession("01K0000000010").recordedDurationMs;
    await scenario.receiveFrame(voicedPcm);
    expect(mockDb.getSession("01K0000000010").recordedDurationMs).toBe(
      pausedDuration
    );
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

  it("ignores duplicate complete commands while finalizing", () => {
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
    scenario.receive({ type: "SESSION_COMPLETE" });
    vi.runAllTimers();

    expect(
      send.mock.calls.filter(([event]) => event.type === "SESSION_COMPLETED")
    ).toHaveLength(1);
    expect(close).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("keeps persisted finals after a fatal provider error", async () => {
    mockDb.reset();
    const note = mockDb.createNote(mockDb.workspace.workspaceId, {});
    const session = mockDb.createSession(note.noteId);
    const send = vi.fn();
    const close = vi.fn();
    const scenario = createMockTranscriptionScenario({
      sessionId: session.sessionId,
      send,
      requestClose: close,
      config: { partialEveryMs: 40, minimumVoiceMs: 40 },
      script: ["첫 번째 결정사항입니다."],
    });
    scenario.open();
    await scenario.receiveFrame(voicedPcm);
    scenario.receive({ type: "TURN_COMMIT" });

    scenario.fail({
      code: "STT_PROVIDER_UNAVAILABLE",
      message: "음성 인식 제공자에 연결할 수 없습니다.",
    });

    expect(mockDb.listSegments(note.noteId).items).toEqual([
      expect.objectContaining({ text: "첫 번째 결정사항입니다." }),
    ]);
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "ERROR",
        code: "STT_PROVIDER_UNAVAILABLE",
        retryable: false,
      })
    );
    expect(close).toHaveBeenCalledWith(4500, expect.any(String));
  });
});
