import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockTranscriptionScenario } from "@/lib/mocks/transcription-scenario";
import { mockDb } from "@/lib/mocks/db";

function createSession() {
  const project = mockDb.listProjects("01K0000000000")[0];
  const note = mockDb.createNote(project.projectId, {});
  return { note, session: mockDb.createSession(note.noteId) };
}

describe("MockTranscriptionScenario", () => {
  beforeEach(() => mockDb.reset());

  it("opens, grows one utterance snapshot, and persists its committed final", async () => {
    const { note, session } = createSession();
    const send = vi.fn();
    const scenario = createMockTranscriptionScenario({
      sessionId: session.sessionId,
      send,
      config: { partialEveryMs: 40, minimumVoiceMs: 40 },
      script: ["자동 확정 문장입니다"],
    });

    scenario.open();
    expect(send).toHaveBeenCalledWith({
      type: "connected",
      sessionId: session.sessionId,
    });

    const voiced = new Int16Array(960).fill(12_000).buffer;
    await scenario.receiveFrame(voiced);
    await scenario.receiveFrame(voiced);
    const partials = send.mock.calls
      .map(([event]) => event)
      .filter((event) => event.type === "partial");
    expect(partials).toHaveLength(2);
    expect(partials[1].utteranceId).toBe(partials[0].utteranceId);
    expect(partials[1].text).toContain(partials[0].text);

    await scenario.receiveFrame('{"type":"commit"}');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "final", sequence: 1 })
    );
    expect(mockDb.listSegments(note.noteId)).toEqual([
      expect.objectContaining({ sequence: 1 }),
    ]);
  });

  it("auto-commits after fifteen seconds of buffered PCM", async () => {
    const { session } = createSession();
    const send = vi.fn();
    const scenario = createMockTranscriptionScenario({
      sessionId: session.sessionId,
      send,
      script: ["15초 자동 확정 문장"],
    });
    scenario.open();

    const fifteenSeconds = new Int16Array(24_000 * 15).fill(12_000);
    await scenario.receiveFrame(fifteenSeconds.buffer);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "final", sequence: 1 })
    );
  });

  it("drains a final before completed and normal close on stop", async () => {
    const { session } = createSession();
    const send = vi.fn();
    const requestClose = vi.fn();
    const scenario = createMockTranscriptionScenario({
      sessionId: session.sessionId,
      send,
      requestClose,
      config: { partialEveryMs: 40, minimumVoiceMs: 40 },
      script: ["중지 전 확정 문장"],
    });
    scenario.open();
    await scenario.receiveFrame(new Int16Array(960).fill(12_000).buffer);

    await scenario.receiveFrame('{"type":"stop"}');

    const types = send.mock.calls.map(([event]) => event.type);
    expect(types.slice(-2)).toEqual(["final", "completed"]);
    expect(requestClose).toHaveBeenCalledWith(1000, "completed");
  });

  it("reports invalid odd-byte audio and closes with 1008", async () => {
    const { session } = createSession();
    const send = vi.fn();
    const requestClose = vi.fn();
    const scenario = createMockTranscriptionScenario({
      sessionId: session.sessionId,
      send,
      requestClose,
    });
    scenario.open();

    await scenario.receiveFrame(new ArrayBuffer(3));

    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "error",
        code: "INVALID_AUDIO_FRAME",
      })
    );
    expect(requestClose).toHaveBeenCalledWith(1008, expect.any(String));
  });

  it("reports configured upstream failure and closes with 1011", async () => {
    const { session } = createSession();
    const send = vi.fn();
    const requestClose = vi.fn();
    const scenario = createMockTranscriptionScenario({
      sessionId: session.sessionId,
      send,
      requestClose,
      failure: {
        code: "OPENAI_TRANSCRIPTION_FAILED",
        message: "upstream failed",
      },
    });
    scenario.open();

    await scenario.receiveFrame(new Int16Array(960).fill(12_000).buffer);

    expect(send).toHaveBeenLastCalledWith({
      type: "error",
      code: "OPENAI_TRANSCRIPTION_FAILED",
      message: "upstream failed",
    });
    expect(requestClose).toHaveBeenCalledWith(1011, "upstream failed");
  });
});
