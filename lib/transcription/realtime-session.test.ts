import { describe, expect, it, vi } from "vitest";
import {
  BrowserRealtimeSession,
  type RealtimeSessionDependencies,
} from "@/lib/transcription/realtime-session";

function setup() {
  const order: string[] = [];
  let emitChunk!: (chunk: ArrayBuffer) => void;
  let socketOptions!: Parameters<
    NonNullable<RealtimeSessionDependencies["createSocket"]>
  >[0];
  const audio = {
    requestPermission: vi.fn(async () => {
      order.push("permission");
    }),
    start: vi.fn(async () => {
      order.push("audio-start");
    }),
    stop: vi.fn(async () => {
      order.push("audio-stop");
    }),
  };
  const socket = {
    connect: vi.fn(async () => {
      order.push("socket-connect");
    }),
    sendAudio: vi.fn(() => true),
    commit: vi.fn(),
    stop: vi.fn(() => {
      order.push("socket-stop");
      socketOptions.onEvent({
        type: "completed",
        sessionId: "0HZX2K7M9Q4AG",
      });
    }),
    reconcileConnected: vi.fn(),
    close: vi.fn(async () => {
      order.push("socket-close");
    }),
  };
  const onFailure = vi.fn();
  const controller = new BrowserRealtimeSession(
    {
      url: "ws://localhost/ws/transcriptions",
      onEvent: vi.fn(),
      onLevel: vi.fn(),
      onFailure,
    },
    {
      createAudio: (onChunk) => {
        emitChunk = onChunk;
        return audio;
      },
      createSocket: (options) => {
        socketOptions = options;
        return socket;
      },
    }
  );
  return {
    controller,
    audio,
    socket,
    order,
    onFailure,
    emitChunk: (chunk: ArrayBuffer) => emitChunk(chunk),
    emitEvent: (event: Parameters<typeof socketOptions.onEvent>[0]) =>
      socketOptions.onEvent(event),
    closeTransport: (code: number, reason = "") =>
      socketOptions.onClose(code, reason),
  };
}

describe("BrowserRealtimeSession", () => {
  it("owns permission, STOMP connection, and microphone startup order", async () => {
    const harness = setup();

    await harness.controller.requestPermission();
    await harness.controller.connect("0HZX2K7M9Q4AG");

    expect(harness.order).toEqual([
      "permission",
      "socket-connect",
      "audio-start",
    ]);
  });

  it("flushes audio before stop and closes after the terminal event", async () => {
    const harness = setup();
    await harness.controller.requestPermission();
    await harness.controller.connect("0HZX2K7M9Q4AG");

    await harness.controller.stop();

    expect(harness.order.slice(-3)).toEqual([
      "audio-stop",
      "socket-stop",
      "socket-close",
    ]);
  });

  it("does not turn a completed terminal close into a failure", async () => {
    const harness = setup();
    await harness.controller.connect("0HZX2K7M9Q4AG");
    harness.socket.stop.mockImplementationOnce(() => {
      harness.emitEvent({
        type: "completed",
        sessionId: "0HZX2K7M9Q4AG",
      });
      harness.closeTransport(1000, "completed");
    });

    await harness.controller.stop();

    expect(harness.onFailure).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent stop requests", async () => {
    const harness = setup();
    await harness.controller.connect("0HZX2K7M9Q4AG");

    const first = harness.controller.stop();
    const second = harness.controller.stop();

    expect(first).toBe(second);
    await first;
    expect(harness.audio.stop).toHaveBeenCalledOnce();
    expect(harness.socket.stop).toHaveBeenCalledOnce();
  });

  it("still completes when browser audio cleanup rejects", async () => {
    const harness = setup();
    await harness.controller.connect("0HZX2K7M9Q4AG");
    harness.audio.stop.mockRejectedValueOnce(
      new DOMException("AudioContext is already closed", "InvalidStateError")
    );

    await expect(harness.controller.stop()).resolves.toBeUndefined();

    expect(harness.socket.stop).toHaveBeenCalledOnce();
    expect(harness.socket.close).toHaveBeenCalledOnce();
    expect(harness.onFailure).not.toHaveBeenCalled();
  });

  it("reports a failed server stop without rejecting the UI action", async () => {
    const harness = setup();
    await harness.controller.connect("0HZX2K7M9Q4AG");
    harness.socket.stop.mockImplementationOnce(() => {
      throw new Error("transport closed");
    });

    await expect(harness.controller.stop()).resolves.toBeUndefined();

    expect(harness.onFailure).toHaveBeenCalledWith(
      "전사 종료 요청을 서버에 보내지 못했습니다."
    );
  });

  it("turns socket backpressure into one terminal failure", async () => {
    const harness = setup();
    await harness.controller.connect("0HZX2K7M9Q4AG");
    harness.socket.sendAudio.mockReturnValue(false);

    harness.emitChunk(new ArrayBuffer(4_800));
    harness.emitChunk(new ArrayBuffer(4_800));

    expect(harness.onFailure).toHaveBeenCalledOnce();
    expect(harness.onFailure).toHaveBeenCalledWith(
      expect.stringContaining("네트워크가 느려")
    );
  });

  it("uses DB reconciliation to recover a missed connected event", async () => {
    const harness = setup();
    await harness.controller.connect("0HZX2K7M9Q4AG");

    harness.controller.reconcile("ACTIVE");

    expect(harness.socket.reconcileConnected).toHaveBeenCalledOnce();
  });

  it("treats an unexpected normal WebSocket close as a failure", async () => {
    const harness = setup();
    await harness.controller.connect("0HZX2K7M9Q4AG");

    harness.closeTransport(1000);

    expect(harness.onFailure).toHaveBeenCalledWith("WebSocket closed (1000)");
  });
});
