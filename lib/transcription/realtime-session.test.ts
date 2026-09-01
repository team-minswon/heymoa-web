import { describe, expect, it, vi } from "vitest";
import {
  BrowserRealtimeSession,
  type RealtimeSessionDependencies,
} from "@/lib/transcription/realtime-session";

function setup() {
  const order: string[] = [];
  let emitChunk!: (chunk: ArrayBuffer, captureSamples: number) => void;
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
    sendAudio: vi.fn<
      (chunk: ArrayBuffer, chunkSeq: number, captureSamples: number) => boolean
    >(() => true),
    stop: vi.fn<(finalChunkSeq: number) => void>(() => {
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
  const onEvent = vi.fn();
  const onReconnectNeeded = vi.fn<() => Promise<string | null>>(async () => {
    order.push("reopen");
    return "0HZX2K7M9Q4AH";
  });
  const controller = new BrowserRealtimeSession(
    {
      url: "ws://localhost/ws/transcriptions",
      onEvent,
      onLevel: vi.fn(),
      onFailure,
      onReconnectNeeded,
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
    onEvent,
    onFailure,
    onReconnectNeeded,
    emitChunk: (chunk: ArrayBuffer, captureSamples = 0) =>
      emitChunk(chunk, captureSamples),
    emitEvent: (event: Parameters<typeof socketOptions.onEvent>[0]) =>
      socketOptions.onEvent(event),
    closeTransport: (code: number, reason = "") =>
      socketOptions.onClose(code, reason),
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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

  it("recovers when a clean completed close arrives before its terminal event", async () => {
    const harness = setup();
    await harness.controller.connect("0HZX2K7M9Q4AG");
    harness.socket.stop.mockImplementationOnce(() => {
      harness.closeTransport(1000, "completed");
    });

    await harness.controller.stop();

    expect(harness.onFailure).not.toHaveBeenCalled();
    expect(harness.onEvent).toHaveBeenCalledWith({
      type: "completed",
      sessionId: "0HZX2K7M9Q4AG",
    });
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

  it("releases permission acquired after stop and never continues startup", async () => {
    const harness = setup();
    const permission = deferred();
    harness.audio.requestPermission.mockReturnValueOnce(permission.promise);

    const requesting = harness.controller.requestPermission();
    await harness.controller.stop();
    permission.resolve();

    await expect(requesting).rejects.toThrow("REALTIME_SESSION_CLOSED");
    expect(harness.audio.stop).toHaveBeenCalledTimes(2);
    expect(harness.socket.connect).not.toHaveBeenCalled();
    expect(harness.audio.start).not.toHaveBeenCalled();
  });

  it("recloses a socket whose connection settles after stop and never starts audio", async () => {
    const harness = setup();
    const connection = deferred();
    harness.socket.connect.mockReturnValueOnce(connection.promise);

    const connecting = harness.controller.connect("0HZX2K7M9Q4AG");
    await harness.controller.stop();
    connection.resolve();

    await expect(connecting).rejects.toThrow("REALTIME_SESSION_CLOSED");
    expect(harness.socket.close).toHaveBeenCalledTimes(2);
    expect(harness.audio.start).not.toHaveBeenCalled();
  });

  it("cancels connecting immediately even when stop cannot send a terminal command yet", async () => {
    const harness = setup();
    const connection = deferred();
    harness.socket.connect.mockReturnValueOnce(connection.promise);
    harness.socket.stop.mockImplementationOnce(() => undefined);

    const connecting = harness.controller.connect("0HZX2K7M9Q4AG");
    const stopping = harness.controller.stop();
    connection.resolve();

    await expect(connecting).rejects.toThrow("REALTIME_SESSION_CLOSED");
    await expect(stopping).resolves.toBeUndefined();
    expect(harness.audio.start).not.toHaveBeenCalled();
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

  it("keeps the session alive through transient backpressure", async () => {
    vi.useFakeTimers();
    try {
      const harness = setup();
      await harness.controller.connect("0HZX2K7M9Q4AG");
      harness.socket.sendAudio.mockReturnValue(false);

      harness.emitChunk(new ArrayBuffer(4_800));
      vi.advanceTimersByTime(9_000);
      harness.emitChunk(new ArrayBuffer(4_800));
      harness.socket.sendAudio.mockReturnValue(true);
      harness.emitChunk(new ArrayBuffer(4_800));

      expect(harness.onFailure).not.toHaveBeenCalled();
      expect(harness.socket.close).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails once when backpressure lasts beyond the congestion limit", async () => {
    vi.useFakeTimers();
    try {
      const harness = setup();
      await harness.controller.connect("0HZX2K7M9Q4AG");
      harness.socket.sendAudio.mockReturnValue(false);

      harness.emitChunk(new ArrayBuffer(4_800));
      vi.advanceTimersByTime(10_000);
      harness.emitChunk(new ArrayBuffer(4_800));
      harness.emitChunk(new ArrayBuffer(4_800));

      expect(harness.onFailure).toHaveBeenCalledOnce();
      expect(harness.onFailure).toHaveBeenCalledWith(
        expect.stringContaining("네트워크가 느려")
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("resets the congestion clock after a successful send", async () => {
    vi.useFakeTimers();
    try {
      const harness = setup();
      await harness.controller.connect("0HZX2K7M9Q4AG");

      harness.socket.sendAudio.mockReturnValue(false);
      harness.emitChunk(new ArrayBuffer(4_800));
      vi.advanceTimersByTime(8_000);
      harness.socket.sendAudio.mockReturnValue(true);
      harness.emitChunk(new ArrayBuffer(4_800));
      harness.socket.sendAudio.mockReturnValue(false);
      harness.emitChunk(new ArrayBuffer(4_800));
      vi.advanceTimersByTime(8_000);
      harness.emitChunk(new ArrayBuffer(4_800));

      expect(harness.onFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses DB reconciliation to recover a missed connected event", async () => {
    const harness = setup();
    await harness.controller.connect("0HZX2K7M9Q4AG");

    harness.controller.reconcile("ACTIVE");

    expect(harness.socket.reconcileConnected).toHaveBeenCalledOnce();
  });

  // 끊긴 세션에는 다시 못 붙는다 — 서버가 disconnect 때 세션을 INTERRUPTED 로 닫고
  // `requireConnectable` 이 READY 만 받는다(APP-531). 그래서 재연결은 **새 세션을 여는 것**이다.
  it("reopens a fresh session when the transport drops unexpectedly", async () => {
    const harness = setup();
    await harness.controller.connect("0HZX2K7M9Q4AG");
    harness.order.length = 0;

    harness.closeTransport(1006, "");
    await vi.waitFor(() => expect(harness.onReconnectNeeded).toHaveBeenCalled());

    expect(harness.onFailure).not.toHaveBeenCalled();
    expect(harness.order).toContain("reopen");
    expect(harness.order).toContain("socket-connect");
  });

  // 서버가 죽어 있으면 옛 세션이 ACTIVE 로 남아 `startSession` 이 거절당한다. 첫 거절에
  // 포기하면 **이중화가 노리는 바로 그 경우에** 재개가 안 된다.
  it("retries the reopen with backoff instead of giving up on the first rejection", async () => {
    vi.useFakeTimers();
    try {
      const harness = setup();
      harness.onReconnectNeeded
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      await harness.controller.connect("0HZX2K7M9Q4AG");
      harness.order.length = 0;

      harness.closeTransport(1006, "");
      await vi.advanceTimersByTimeAsync(4_000);

      expect(harness.onFailure).not.toHaveBeenCalled();
      expect(harness.onReconnectNeeded).toHaveBeenCalledTimes(3);
      expect(harness.order).toContain("socket-connect");
    } finally {
      vi.useRealTimers();
    }
  });

  // 서버가 오래 죽어 있으면 브라우저가 영원히 두드리면 안 된다. 다만 그 「오래」가
  // 서버 `transcription.watchdog.stale-after` 60초보다 짧으면 안 된다.
  it("fails only after the backoff outlasts the server stale-after", async () => {
    vi.useFakeTimers();
    try {
      const harness = setup();
      harness.onReconnectNeeded.mockResolvedValue(null);
      await harness.controller.connect("0HZX2K7M9Q4AG");

      harness.closeTransport(1006, "");
      await vi.advanceTimersByTimeAsync(60_000);
      expect(harness.onFailure).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(5_000);
      expect(harness.onFailure).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  // 1000 이어도 `reason` 이 "completed" 가 아니면 예기치 않은 종료다. 이제는 즉시 실패가
  // 아니라 재개를 시도하고, **다 소진했을 때** 그 이유를 그대로 들고 실패한다.
  it("surfaces the close reason when an unexpected normal close cannot reopen", async () => {
    vi.useFakeTimers();
    try {
      const harness = setup();
      harness.onReconnectNeeded.mockResolvedValue(null);
      await harness.controller.connect("0HZX2K7M9Q4AG");

      harness.closeTransport(1000);
      await vi.advanceTimersByTimeAsync(65_000);

      expect(harness.onFailure).toHaveBeenCalledWith("WebSocket closed (1000)");
    } finally {
      vi.useRealTimers();
    }
  });

  it("numbers chunks from zero and carries the capture position", async () => {
    const harness = setup();
    await harness.controller.connect("0HZX2K7M9Q4AG");

    harness.emitChunk(new ArrayBuffer(3_200), 0);
    harness.emitChunk(new ArrayBuffer(3_200), 1_600);

    expect(harness.socket.sendAudio.mock.calls.map((call) => call.slice(1))).toEqual([
      [0, 0],
      [1, 1_600],
    ]);
  });

  it("retries a refused chunk instead of dropping it", async () => {
    const harness = setup();
    await harness.controller.connect("0HZX2K7M9Q4AG");

    harness.socket.sendAudio.mockReturnValue(false);
    harness.emitChunk(new ArrayBuffer(3_200), 0);
    expect(harness.socket.sendAudio).toHaveBeenCalledOnce();

    harness.socket.sendAudio.mockReturnValue(true);
    harness.emitChunk(new ArrayBuffer(3_200), 1_600);

    // 거절됐던 0번이 1번보다 먼저 다시 나간다 — 건너뛰면 chunkSeq 에 구멍이 난다
    expect(harness.socket.sendAudio.mock.calls.map((call) => call[1])).toEqual([
      0, 0, 1,
    ]);
  });

  it("reports the last chunk number on stop", async () => {
    const harness = setup();
    await harness.controller.connect("0HZX2K7M9Q4AG");
    harness.emitChunk(new ArrayBuffer(3_200), 0);
    harness.emitChunk(new ArrayBuffer(3_200), 1_600);

    await harness.controller.stop();

    expect(harness.socket.stop).toHaveBeenCalledWith(1);
  });

  it("reports -1 when no chunk was ever sent", async () => {
    const harness = setup();
    await harness.controller.connect("0HZX2K7M9Q4AG");

    await harness.controller.stop();

    expect(harness.socket.stop).toHaveBeenCalledWith(-1);
  });

  it("fails only when nothing gets through for the congestion window", async () => {
    vi.useFakeTimers();
    try {
      const harness = setup();
      await harness.controller.connect("0HZX2K7M9Q4AG");

      harness.socket.sendAudio.mockReturnValue(false);
      harness.emitChunk(new ArrayBuffer(3_200), 0);
      vi.advanceTimersByTime(11_000);
      harness.emitChunk(new ArrayBuffer(3_200), 1_600);

      expect(harness.onFailure).toHaveBeenCalledWith(
        "네트워크가 느려 오디오 전송을 계속할 수 없습니다."
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
