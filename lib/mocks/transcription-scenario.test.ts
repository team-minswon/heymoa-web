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
    await scenario.receiveFrame(voiced, { chunkSeq: 0, captureSamples: 0 });
    await scenario.receiveFrame(voiced, { chunkSeq: 1, captureSamples: 960 });
    const partials = send.mock.calls
      .map(([event]) => event)
      .filter((event) => event.type === "partial");
    expect(partials).toHaveLength(2);
    expect(partials[1].utteranceId).toBe(partials[0].utteranceId);
    // 이어 붙인 것이 곧 화면에 나가는 문장이고, 그것은 자라기만 한다.
    const whole = (event: { confirmedText: string; pendingText: string }) =>
      `${event.confirmedText}${event.pendingText}`;
    expect(whole(partials[1])).toContain(whole(partials[0]));
    // **확정 토막도 자라기만 한다** — 굳은 글자가 뒤로 물러나면 화면이 앞뒤로 흔들린다.
    expect(partials[1].confirmedText).toContain(partials[0].confirmedText);
    expect(partials[1].pendingText).not.toBe("");

    // `commit` 명령이 사라졌다. 발화 경계는 이제 침묵이 정한다.
    const silence = new Int16Array(16_000).buffer; // 1초
    await scenario.receiveFrame(silence, {
      chunkSeq: 2,
      captureSamples: 1_920,
    });
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

    // 계약이 프레임을 32,000 byte(1초)로 묶는다. 15초는 조각 열여섯이다.
    for (let chunkSeq = 0; chunkSeq < 16; chunkSeq += 1) {
      await scenario.receiveFrame(new Int16Array(16_000).fill(12_000).buffer, {
        chunkSeq,
        captureSamples: chunkSeq * 16_000,
      });
    }

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
    await scenario.receiveFrame(new Int16Array(960).fill(12_000).buffer, {
      chunkSeq: 0,
      captureSamples: 0,
    });

    await scenario.receiveFrame('{"type":"stop","finalChunkSeq":0}');

    const types = send.mock.calls.map(([event]) => event.type);
    expect(types.slice(-2)).toEqual(["final", "completed"]);
    expect(requestClose).toHaveBeenCalledWith(1000, "completed");
    scenario.dispose();
    expect(mockDb.getSession(session.sessionId).status).toBe("COMPLETED");
  });

  it("marks an unexpectedly disconnected recording as interrupted", () => {
    const { session } = createSession();
    const scenario = createMockTranscriptionScenario({
      sessionId: session.sessionId,
      send: vi.fn(),
    });
    scenario.open();

    scenario.dispose();

    expect(mockDb.getSession(session.sessionId).status).toBe("INTERRUPTED");
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
        code: "STT_TRANSCRIPTION_FAILED",
        message: "upstream failed",
      },
    });
    scenario.open();

    await scenario.receiveFrame(new Int16Array(960).fill(12_000).buffer);

    expect(send).toHaveBeenLastCalledWith({
      type: "error",
      code: "STT_TRANSCRIPTION_FAILED",
      message: "upstream failed",
    });
    expect(requestClose).toHaveBeenCalledWith(1011, "upstream failed");
  });
});
