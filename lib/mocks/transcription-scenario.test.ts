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
      epoch: 1,
      durableThroughSeq: -1,
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

/**
 * 재부착 계약(asyncapi): 부착마다 epoch 가 오르고, connected 의 durableThroughSeq 와 ack 는 0 번부터
 * 빈칸 없이 받은 끝이다. 가장 새 3초를 먼저 보내면 앞 번호가 비는데, 그 빈칸을 ack 가 건너면 안 된다.
 */
describe("MockTranscriptionScenario 재부착 내구성", () => {
  beforeEach(() => mockDb.reset());

  const quiet = () => new Int16Array(1_600).buffer;
  function attach(sessionId: string, resendFromSeq?: number) {
    const send = vi.fn();
    const scenario = createMockTranscriptionScenario({ sessionId, send });
    scenario.open(resendFromSeq);
    const events = () => send.mock.calls.map(([event]) => event);
    const sendSeqs = async (seqs: number[]) => {
      for (const chunkSeq of seqs) {
        await scenario.receiveFrame(quiet(), {
          chunkSeq,
          captureSamples: chunkSeq * 1_600,
        });
      }
    };
    return { scenario, send, events, sendSeqs };
  }
  const range = (from: number, to: number) =>
    Array.from({ length: to - from }, (_, i) => from + i);

  it("다시 붙으면 epoch 가 오르고 받은 끝을 durableThroughSeq 로 알린다", async () => {
    const { session } = createSession();
    const first = attach(session.sessionId);
    await first.sendSeqs([0, 1, 2]);
    first.scenario.dispose();

    const second = attach(session.sessionId, 0);

    expect(first.events()[0]).toMatchObject({
      epoch: 1,
      durableThroughSeq: -1,
    });
    expect(second.events()[0]).toMatchObject({
      type: "connected",
      epoch: 2,
      durableThroughSeq: 2,
    });
  });

  it("빈칸이 있으면 ack 는 빈칸 앞에서 멈추고, 채워지면 넘어간다", async () => {
    const { session } = createSession();
    const { events, sendSeqs } = attach(session.sessionId);

    await sendSeqs([0, 1, ...range(5, 33)]);
    expect(events().filter((e) => e.type === "ack")).toEqual([
      { type: "ack", throughChunkSeq: 1 },
    ]);

    await sendSeqs([2, 3, 4, ...range(33, 60)]);
    expect(
      events()
        .filter((e) => e.type === "ack")
        .at(-1)
    ).toEqual({
      type: "ack",
      throughChunkSeq: 59,
    });
  });

  it("빈칸이 남은 채 stop 하면 끝내지 않고 다시 붙으라고 한다", async () => {
    const { session } = createSession();
    const first = attach(session.sessionId);
    await first.sendSeqs([0, 2]);

    await first.scenario.receiveFrame('{"type":"stop","finalChunkSeq":2}');

    expect(first.events().at(-1)).toEqual({
      type: "reattach",
      delayMs: 0,
      reason: "STORE_INCOMPLETE",
    });
    expect(first.events().some((e) => e.type === "completed")).toBe(false);
    expect(mockDb.getSession(session.sessionId).status).not.toBe("COMPLETED");

    first.scenario.dispose();
    const second = attach(session.sessionId, 1);
    expect(second.events()[0]).toMatchObject({ durableThroughSeq: 0 });
    await second.sendSeqs([1]);
    await second.scenario.receiveFrame('{"type":"stop","finalChunkSeq":2}');
    expect(second.events().at(-1)).toMatchObject({ type: "completed" });
  });

  it("브라우저가 이미 지운 앞 번호(resendFromSeq 앞)는 기다리지 않는다", () => {
    const { session } = createSession();

    const { events } = attach(session.sessionId, 10);

    expect(events()[0]).toMatchObject({ durableThroughSeq: 9 });
  });
});
