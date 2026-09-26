import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BrowserRealtimeSession,
  type RealtimeSessionDependencies,
} from "@/lib/transcription/realtime-session";
import type { ServerEvent } from "@/lib/transcription/protocol";
import type { MicrophoneState } from "@/lib/transcription/audio";
import type { AudioStore } from "@/lib/transcription/audio-store";
import { FakeAudioStore } from "@/lib/transcription/fake-audio-store";

const SESSION_ID = "0HZX2K7M9Q4AG";

type SocketOptions = Parameters<
  NonNullable<RealtimeSessionDependencies["createSocket"]>
>[0];

/**
 * 실제 `TranscriptionSocket` 의 성질을 흉내 낸다.
 * - `connect()` 는 서버의 `connected` 를 **먼저 onEvent 로 흘린 뒤** 풀린다.
 * - 열다 실패하면 reject 하고 **그 뒤에** `onClose` 도 부른다(WEBSOCKET_CONNECTION_FAILED 경로).
 * - 서버의 `error`·`completed` 를 받으면 스스로 닫고 `onClose` 는 안 부른다.
 */
function setup({ store = null }: { store?: AudioStore | null } = {}) {
  const order: string[] = [];
  let emitChunk!: (chunk: ArrayBuffer, captureSamples: number) => void;
  let emitMicrophone!: (state: MicrophoneState) => void;
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
  const server = {
    durableThroughSeq: -1,
    epoch: 1,
    refuse: false,
    gate: null as Promise<void> | null,
    /**
     * 100ms 동안 소켓이 받아 주는 조각 수. `bufferedAmount` 가 차면 거절하고 시간이 지나면 빠지는
     * 것을 흉내 낸다. null 이면 언제나 받는다.
     */
    capacity: null as number | null,
    /** 이만큼의 stop 에는 저장이 덜 끝났다며 다시 붙으라고 답한다(STORE_INCOMPLETE). */
    incompleteStops: 0,
    /** stop 에 아무 답도 안 한다. 끊긴 연결에 보낸 stop 이다. */
    silentStop: false,
    /** 붙자마자 끊긴다. */
    dropAfterConnect: false,
  };
  type MockSocket = ReturnType<typeof makeSocket>;
  const sockets: MockSocket[] = [];

  function makeSocket(options: SocketOptions) {
    let window = -1;
    let inflight = 0;
    const socket = {
      options,
      connect: vi.fn(async () => {
        order.push("socket-connect");
        if (server.gate) await server.gate;
        if (server.refuse) {
          const error = new Error("WEBSOCKET_CONNECTION_FAILED");
          queueMicrotask(() => options.onClose(1006, ""));
          throw error;
        }
        options.onEvent({
          type: "connected",
          sessionId: options.sessionId,
          epoch: server.epoch++,
          durableThroughSeq: server.durableThroughSeq,
        });
        if (server.dropAfterConnect)
          setTimeout(() => options.onClose(1006, ""), 0);
      }),
      sendAudio: vi.fn<
        (
          chunk: ArrayBuffer,
          chunkSeq: number,
          captureSamples: number
        ) => boolean
      >(() => {
        if (server.capacity === null) return true;
        const now = Math.floor(Date.now() / 100);
        if (now !== window) {
          window = now;
          inflight = 0;
        }
        if (inflight >= server.capacity) return false;
        inflight += 1;
        return true;
      }),
      // 서버는 finalChunkSeq 까지 저장한 뒤에만 completed 를 보낸다. 그 전에 ACK 가 먼저 나간다
      stop: vi.fn<(finalChunkSeq: number) => void>((finalChunkSeq) => {
        order.push("socket-stop");
        if (server.silentStop) return;
        if (server.incompleteStops > 0) {
          server.incompleteStops -= 1;
          options.onEvent({
            type: "reattach",
            delayMs: 0,
            reason: "STORE_INCOMPLETE",
          });
          return;
        }
        if (finalChunkSeq >= 0)
          options.onEvent({ type: "ack", throughChunkSeq: finalChunkSeq });
        options.onEvent({ type: "completed", sessionId: options.sessionId });
      }),
      reconcileConnected: vi.fn(),
      close: vi.fn(async () => {
        order.push("socket-close");
      }),
    };
    return socket;
  }

  const onFailure = vi.fn();
  const onEvent = vi.fn<(event: ServerEvent) => void>();
  const onReconnectChange = vi.fn();
  const onBufferChange = vi.fn();
  const onMicrophoneChange = vi.fn();
  const createSocket = vi.fn((options: SocketOptions) => {
    const socket = makeSocket(options);
    sockets.push(socket);
    return socket;
  });
  const controller = new BrowserRealtimeSession(
    {
      url: "ws://localhost/ws/transcriptions",
      onEvent,
      onLevel: vi.fn(),
      onFailure,
      onReconnectChange,
      onBufferChange,
      onMicrophoneChange,
    },
    {
      createAudio: (onChunk, _onLevel, onState) => {
        emitChunk = onChunk;
        emitMicrophone = onState;
        return audio;
      },
      createSocket,
      createStore: () => store,
    }
  );
  const current = () => sockets[sockets.length - 1];
  return {
    controller,
    audio,
    server,
    sockets,
    current,
    get socket() {
      return current();
    },
    createSocket,
    order,
    onEvent,
    onFailure,
    onReconnectChange,
    onBufferChange,
    buffer: () => onBufferChange.mock.lastCall?.[0],
    onMicrophoneChange,
    emitMicrophone: (state: MicrophoneState) => emitMicrophone(state),
    emitChunk: (
      chunk: ArrayBuffer = new ArrayBuffer(3_200),
      captureSamples = 0
    ) => emitChunk(chunk, captureSamples),
    emitEvent: (event: ServerEvent) => current().options.onEvent(event),
    activity: () => current().options.onActivity?.(),
    closeTransport: (code: number, reason = "") =>
      current().options.onClose(code, reason),
    sentSeqs: (socket: MockSocket) =>
      socket.sendAudio.mock.calls.map((call) => call[1]),
    /** 소켓이 받아 준 것만. 거절된 시도는 뺀다. */
    acceptedSeqs: (socket: MockSocket) =>
      socket.sendAudio.mock.calls
        .filter((_, i) => socket.sendAudio.mock.results[i].value === true)
        .map((call) => call[1]),
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("BrowserRealtimeSession", () => {
  it("owns permission, STOMP connection, and microphone startup order", async () => {
    const harness = setup();

    await harness.controller.requestPermission();
    await harness.controller.connect(SESSION_ID);

    expect(harness.order).toEqual([
      "permission",
      "socket-connect",
      "audio-start",
    ]);
  });

  it("flushes audio before stop and closes after the terminal event", async () => {
    const harness = setup();
    await harness.controller.requestPermission();
    await harness.controller.connect(SESSION_ID);

    await harness.controller.stop();

    expect(harness.order.slice(-3)).toEqual([
      "audio-stop",
      "socket-stop",
      "socket-close",
    ]);
  });

  it("does not turn a completed terminal close into a failure", async () => {
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.socket.stop.mockImplementationOnce(() => {
      harness.emitEvent({ type: "completed", sessionId: SESSION_ID });
      harness.closeTransport(1000, "completed");
    });

    await harness.controller.stop();

    expect(harness.onFailure).not.toHaveBeenCalled();
  });

  it("recovers when a clean completed close arrives before its terminal event", async () => {
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.socket.stop.mockImplementationOnce(() => {
      harness.closeTransport(1000, "completed");
    });

    await harness.controller.stop();

    expect(harness.onFailure).not.toHaveBeenCalled();
    expect(harness.onEvent).toHaveBeenCalledWith({
      type: "completed",
      sessionId: SESSION_ID,
    });
  });

  it("deduplicates concurrent stop requests", async () => {
    const harness = setup();
    await harness.controller.connect(SESSION_ID);

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
    expect(harness.createSocket).not.toHaveBeenCalled();
    expect(harness.audio.start).not.toHaveBeenCalled();
  });

  it("recloses a socket whose connection settles after stop and never starts audio", async () => {
    const harness = setup();
    const connection = deferred();
    harness.server.gate = connection.promise;
    const connecting = harness.controller.connect(SESSION_ID);

    await harness.controller.stop();
    connection.resolve();

    await expect(connecting).rejects.toThrow("REALTIME_SESSION_CLOSED");
    expect(harness.audio.start).not.toHaveBeenCalled();
  });

  it("cancels connecting immediately even when stop cannot send a terminal command yet", async () => {
    const harness = setup();
    const connection = deferred();
    harness.server.gate = connection.promise;

    const connecting = harness.controller.connect(SESSION_ID);
    const stopping = harness.controller.stop();
    connection.resolve();

    await expect(connecting).rejects.toThrow("REALTIME_SESSION_CLOSED");
    await expect(stopping).resolves.toBeUndefined();
    expect(harness.audio.start).not.toHaveBeenCalled();
  });

  it("still completes when browser audio cleanup rejects", async () => {
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
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
    await harness.controller.connect(SESSION_ID);
    harness.socket.stop.mockImplementationOnce(() => {
      throw new Error("transport closed");
    });

    await expect(harness.controller.stop()).resolves.toBeUndefined();

    expect(harness.onFailure).toHaveBeenCalledWith(
      "스크립트 종료 요청을 서버에 보내지 못했습니다."
    );
  });

  it("uses DB reconciliation to recover a missed connected event", async () => {
    const harness = setup();
    await harness.controller.connect(SESSION_ID);

    harness.controller.reconcile("ACTIVE");

    expect(harness.socket.reconcileConnected).toHaveBeenCalledOnce();
  });

  it("numbers chunks from zero and carries the capture position", async () => {
    const harness = setup();
    await harness.controller.connect(SESSION_ID);

    harness.emitChunk(new ArrayBuffer(3_200), 0);
    harness.emitChunk(new ArrayBuffer(3_200), 1_600);

    expect(
      harness.socket.sendAudio.mock.calls.map((call) => call.slice(1))
    ).toEqual([
      [0, 0],
      [1, 1_600],
    ]);
  });

  it("retries a refused chunk instead of dropping it", async () => {
    const harness = setup();
    await harness.controller.connect(SESSION_ID);

    harness.socket.sendAudio.mockReturnValue(false);
    harness.emitChunk(new ArrayBuffer(3_200), 0);
    harness.socket.sendAudio.mockReturnValue(true);
    harness.emitChunk(new ArrayBuffer(3_200), 1_600);

    expect(harness.sentSeqs(harness.socket)).toEqual([0, 0, 1]);
  });

  it("reports the last chunk number on stop", async () => {
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.emitChunk();
    harness.emitChunk();

    await harness.controller.stop();

    expect(harness.socket.stop).toHaveBeenCalledWith(1);
  });

  it("reports -1 when no chunk was ever sent", async () => {
    const harness = setup();
    await harness.controller.connect(SESSION_ID);

    await harness.controller.stop();

    expect(harness.socket.stop).toHaveBeenCalledWith(-1);
  });

  it("keeps the session alive through transient backpressure", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.socket.sendAudio.mockReturnValue(false);

    harness.emitChunk();
    vi.advanceTimersByTime(9_000);
    harness.emitChunk();
    harness.socket.sendAudio.mockReturnValue(true);
    harness.emitChunk();

    expect(harness.sockets).toHaveLength(1);
    expect(harness.socket.close).not.toHaveBeenCalled();
  });
  it("resets the congestion clock after a successful send", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);

    harness.socket.sendAudio.mockReturnValue(false);
    harness.emitChunk();
    vi.advanceTimersByTime(8_000);
    harness.activity();
    // 하나만 나가고 막혔다. 조금이라도 나갔으면 회선은 살아 있다.
    harness.socket.sendAudio.mockReturnValueOnce(true);
    harness.emitChunk();
    vi.advanceTimersByTime(8_000);
    harness.emitChunk();
    await vi.advanceTimersByTimeAsync(500);

    expect(harness.sockets).toHaveLength(1);
  });
});

describe("같은 세션에 다시 붙는다", () => {
  it("끊기면 0.5초 뒤 같은 sessionId 로 다시 연다 — 새 세션을 달라고 하지 않는다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);

    harness.closeTransport(1006);
    await vi.advanceTimersByTimeAsync(499);
    expect(harness.sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(harness.sockets).toHaveLength(2);
    expect(harness.sockets.map((s) => s.options.sessionId)).toEqual([
      SESSION_ID,
      SESSION_ID,
    ]);
    expect(harness.onFailure).not.toHaveBeenCalled();
    expect(harness.audio.start).toHaveBeenCalledOnce();
  });

  it("다시 붙으면 durableThroughSeq 다음부터 순서대로 다시 보내고, 번호는 이어 간다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    const first = harness.socket;
    for (let i = 0; i < 5; i += 1) harness.emitChunk(); // 0..4
    harness.emitEvent({ type: "ack", throughChunkSeq: 1 });

    harness.closeTransport(1006);
    harness.emitChunk(); // 5 — 소켓 없이 버퍼로
    harness.emitChunk(); // 6
    harness.server.durableThroughSeq = 2; // 서버는 2 까지 확정했다(ACK 는 1 까지만 닿았다)
    await vi.advanceTimersByTimeAsync(500);
    const second = harness.socket;
    harness.emitChunk(); // 7

    expect(harness.sentSeqs(first)).toEqual([0, 1, 2, 3, 4]);
    expect(harness.sentSeqs(second)).toEqual([3, 4, 5, 6, 7]);
    expect(second.sendAudio.mock.calls.map((call) => call[2])).toEqual([
      0, 0, 0, 0, 0,
    ]);
  });

  // 서버의 ACK 는 앞에서 이어진 끝까지만 오른다. 다른 인스턴스가 이미 ACK 했는데 행이 아직 없으면 서버 durable
  // 이 그보다 작다 — 브라우저가 이미 지운 번호를 서버가 기다리면 ACK 가 거기서 영영 멈춘다
  it("붙을 때마다 아직 들고 있는 가장 앞 번호를 알린다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    for (let i = 0; i < 5; i += 1) harness.emitChunk(); // 0..4
    harness.emitEvent({ type: "ack", throughChunkSeq: 2 });

    harness.closeTransport(1006);
    await vi.advanceTimersByTimeAsync(500);
    harness.emitEvent({ type: "ack", throughChunkSeq: 4 });
    harness.closeTransport(1006);
    // 붙자마자 다시 끊긴 두 번째라 간격이 [0.5, 1]초로 늘어난다
    await vi.advanceTimersByTimeAsync(1_000);

    expect(
      harness.sockets.map((socket) => socket.options.resendFromSeq)
    ).toEqual([0, 3, 5]);
  });

  it("stop 은 이어 온 번호의 마지막을 보낸다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.emitChunk();
    harness.closeTransport(1006);
    harness.emitChunk();
    await vi.advanceTimersByTimeAsync(500);
    harness.emitChunk();

    await harness.controller.stop();

    expect(harness.socket.stop).toHaveBeenCalledWith(2);
  });

  it("reattach 를 받으면 서버가 준 delayMs 만큼 기다렸다 다시 붙는다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    const first = harness.socket;

    harness.emitEvent({ type: "reattach", delayMs: 2_000, reason: "draining" });
    expect(first.close).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(harness.sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(harness.sockets).toHaveLength(2);
    expect(harness.onFailure).not.toHaveBeenCalled();
  });

  it("버린 옛 소켓이 늦게 닫혀도 두 번 다시 붙지 않는다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    const first = harness.socket;

    harness.emitEvent({ type: "reattach", delayMs: 0, reason: "draining" });
    first.options.onClose(1006, "");
    await vi.advanceTimersByTimeAsync(10_000);

    expect(harness.sockets).toHaveLength(2);
  });

  it("superseded 면 조용히 멈춘다 — 다시 붙지도, 실패로 알리지도 않는다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);

    harness.emitEvent({ type: "superseded", sessionId: SESSION_ID });
    harness.closeTransport(1000, "superseded");
    await vi.advanceTimersByTimeAsync(60_000);

    expect(harness.sockets).toHaveLength(1);
    expect(harness.socket.close).toHaveBeenCalled();
    expect(harness.audio.stop).toHaveBeenCalled();
    expect(harness.onFailure).not.toHaveBeenCalled();
    expect(harness.onEvent).toHaveBeenCalledWith({
      type: "superseded",
      sessionId: SESSION_ID,
    });
  });

  it("20초 동안 아무것도 안 들어오면(heartbeat 포함) 스스로 끊고 다시 붙는다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);

    await vi.advanceTimersByTimeAsync(15_000);
    harness.activity(); // heartbeat
    await vi.advanceTimersByTimeAsync(19_000);
    expect(harness.sockets).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1_000 + 1_000 + 500);
    expect(harness.sockets).toHaveLength(2);
    expect(harness.sockets[0].close).toHaveBeenCalled();
    expect(harness.onFailure).not.toHaveBeenCalled();
  });

  it("서버 이벤트도 수신으로 센다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);

    await vi.advanceTimersByTimeAsync(15_000);
    harness.emitEvent({ type: "ack", throughChunkSeq: 0 });
    await vi.advanceTimersByTimeAsync(15_000);

    expect(harness.sockets).toHaveLength(1);
  });

  it("전송 정체가 10초 이어지면 실패가 아니라 다시 붙는다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.socket.sendAudio.mockReturnValue(false);

    harness.emitChunk();
    harness.activity();
    vi.advanceTimersByTime(10_000);
    harness.activity();
    harness.emitChunk();
    await vi.advanceTimersByTimeAsync(500);

    expect(harness.onFailure).not.toHaveBeenCalled();
    expect(harness.sockets).toHaveLength(2);
    expect(harness.sentSeqs(harness.socket)).toEqual([0, 1]);
  });

  it("300초 창을 다 쓰면 그때 실패한다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.server.refuse = true;

    harness.closeTransport(1006, "gone");
    await vi.advanceTimersByTimeAsync(295_000);
    expect(harness.onFailure).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(harness.onFailure).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(harness.onFailure).toHaveBeenCalledOnce();
  });

  it("창 안에서는 지터를 두고 두드리되 간격은 5초를 넘지 않는다", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.server.refuse = true;

    harness.closeTransport(1006);
    await vi.advanceTimersByTimeAsync(60_000);

    // 0.5 + 1 + 2 + 4 + 5·n ≈ 60s → 첫 시도 포함 약 15번
    const attempts = harness.sockets.length - 1;
    expect(attempts).toBeGreaterThanOrEqual(14);
    expect(attempts).toBeLessThanOrEqual(16);
  });

  it("다시 잇는 동안과 이은 뒤를 알린다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.emitChunk(new ArrayBuffer(32_000));

    harness.closeTransport(1006);
    expect(harness.onReconnectChange).toHaveBeenLastCalledWith({
      sinceMs: Date.now(),
      pendingMs: 1_000,
    });
    await vi.advanceTimersByTimeAsync(500);

    expect(harness.onReconnectChange).toHaveBeenLastCalledWith(null);
  });

  it("마이크가 끊겼다 돌아오면 그동안 못 잡은 시간(벽시계 − 캡처 샘플)을 함께 알린다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.emitChunk(new ArrayBuffer(3_200), 0); // 0~100ms

    harness.emitMicrophone("ended");
    expect(harness.onMicrophoneChange).toHaveBeenLastCalledWith("ended", 0);
    vi.advanceTimersByTime(5_000);
    harness.emitMicrophone("live");

    expect(harness.onMicrophoneChange).toHaveBeenLastCalledWith("live", 5_000);
  });
});

describe("녹음이 끝나는 길", () => {
  it("재시도해도 같은 오류(NOT_SESSION_OWNER·SESSION_NOT_CONNECTABLE)면 실패한다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);

    harness.emitEvent({
      type: "error",
      code: "SESSION_NOT_CONNECTABLE",
      message: "이미 닫힌 세션입니다.",
    });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(harness.onFailure).toHaveBeenCalledWith("이미 닫힌 세션입니다.");
    expect(harness.sockets).toHaveLength(1);
  });

  it("재시도할 만한 오류면 같은 세션에 다시 붙는다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);

    harness.emitEvent({
      type: "error",
      code: "INTERNAL_ERROR",
      message: "잠시 문제가 있었습니다.",
    });
    await vi.advanceTimersByTimeAsync(500);

    expect(harness.onFailure).not.toHaveBeenCalled();
    expect(harness.sockets).toHaveLength(2);
  });

  it("다시 붙는 중에 받은 SESSION_NOT_CONNECTABLE 도 실패로 끝낸다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.closeTransport(1006);
    harness.server.refuse = true;
    const reject = () => {
      throw new Error("세션이 끝났습니다.");
    };
    await vi.advanceTimersByTimeAsync(400);
    harness.createSocket.mockImplementationOnce((options) => {
      const socket = {
        options,
        connect: vi.fn(async () => {
          options.onEvent({
            type: "error",
            code: "SESSION_NOT_CONNECTABLE",
            message: "세션이 끝났습니다.",
          });
          reject();
        }),
        sendAudio: vi.fn(() => true),
        stop: vi.fn(),
        reconcileConnected: vi.fn(),
        close: vi.fn(async () => undefined),
      };
      harness.sockets.push(socket as never);
      return socket;
    });
    await vi.advanceTimersByTimeAsync(60_000);

    expect(harness.onFailure).toHaveBeenCalledOnce();
    expect(harness.onFailure).toHaveBeenCalledWith("세션이 끝났습니다.");
    expect(harness.sockets).toHaveLength(2);
  });

  it("멈추지 않았는데 completed 가 오면 다시 붙지 않는다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);

    harness.emitEvent({ type: "completed", sessionId: SESSION_ID });
    await vi.advanceTimersByTimeAsync(60_000);

    expect(harness.sockets).toHaveLength(1);
    expect(harness.audio.stop).toHaveBeenCalled();
  });

  // 서버가 틀려 저장 전에 completed 를 보내도 마지막 사본은 남아야 한다
  it("completed 를 받아도 ACK 못 받은 조각은 디스크에서 지우지 않는다", async () => {
    vi.useFakeTimers();
    const store = new FakeAudioStore();
    const harness = setup({ store });
    await harness.controller.connect(SESSION_ID);
    harness.emitChunk();
    harness.emitChunk();
    await vi.advanceTimersByTimeAsync(0);
    harness.emitEvent({ type: "ack", throughChunkSeq: 0 });

    harness.emitEvent({ type: "completed", sessionId: SESSION_ID });
    await vi.advanceTimersByTimeAsync(0);
    const left = store.list();
    await vi.advanceTimersByTimeAsync(0);

    expect((await left).map((chunk) => chunk.chunkSeq)).toEqual([1]);
  });

  it("completed 때 전부 ACK 받았으면 디스크를 비운다", async () => {
    vi.useFakeTimers();
    const store = new FakeAudioStore();
    const harness = setup({ store });
    await harness.controller.connect(SESSION_ID);
    harness.emitChunk();
    harness.emitChunk();
    await vi.advanceTimersByTimeAsync(0);
    harness.emitEvent({ type: "ack", throughChunkSeq: 1 });

    harness.emitEvent({ type: "completed", sessionId: SESSION_ID });
    await vi.advanceTimersByTimeAsync(0);
    const left = store.list();
    await vi.advanceTimersByTimeAsync(0);

    expect(await left).toEqual([]);
  });

  it("저장이 덜 끝났다며 다시 붙으라고 하면 다시 붙어 이어 보낸 뒤 stop 을 다시 보낸다", async () => {
    vi.useFakeTimers();
    const store = new FakeAudioStore();
    const harness = setup({ store });
    await harness.controller.connect(SESSION_ID);
    harness.emitChunk();
    harness.emitChunk();
    harness.server.incompleteStops = 1;
    harness.server.durableThroughSeq = 0;

    void harness.controller.stop();
    await vi.advanceTimersByTimeAsync(2_000);
    const left = store.list();
    await vi.advanceTimersByTimeAsync(0);

    expect(harness.sockets).toHaveLength(2);
    expect(harness.sentSeqs(harness.sockets[1])).toEqual([1]);
    expect(harness.sockets[1].stop).toHaveBeenCalledWith(1);
    expect(harness.onFailure).not.toHaveBeenCalled();
    expect(await left).toEqual([]);
  });

  it("stop 을 보낸 뒤 끊기면 다시 붙어 stop 을 다시 보낸다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.emitChunk();
    harness.server.silentStop = true;

    void harness.controller.stop();
    await vi.advanceTimersByTimeAsync(0);
    harness.server.silentStop = false;
    harness.closeTransport(1006);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.sockets).toHaveLength(2);
    expect(harness.sockets[1].stop).toHaveBeenCalledWith(0);
    expect(harness.onFailure).not.toHaveBeenCalled();
  });

  it("붙자마자 끊기기를 되풀이하면 다시 붙는 간격이 누적해서 늘어난다", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.server.dropAfterConnect = true;

    harness.closeTransport(1006);
    await vi.advanceTimersByTimeAsync(10_000);

    // 누적 없이 0.5초마다면 스무 번이다
    expect(harness.sockets.length).toBeLessThanOrEqual(6);
    expect(harness.onFailure).not.toHaveBeenCalled();
  });

  it("다시 잇는 중에 멈추면 이은 뒤 남은 소리를 보내고 stop 한다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.emitChunk();
    harness.closeTransport(1006);
    harness.emitChunk();

    const stopping = harness.controller.stop();
    await vi.advanceTimersByTimeAsync(500);
    await stopping;

    expect(harness.sentSeqs(harness.socket)).toEqual([0, 1]);
    expect(harness.socket.stop).toHaveBeenCalledWith(1);
    expect(harness.onFailure).not.toHaveBeenCalled();
  });

  it("남이 회의를 끝내 서버가 completed 를 보내면 마이크를 끄고 정체 실패로 넘기지 않는다", async () => {
    vi.useFakeTimers();
    try {
      const harness = setup();
      await harness.controller.connect("0HZX2K7M9Q4AG");

      harness.emitEvent({ type: "completed", sessionId: "0HZX2K7M9Q4AG" });
      await vi.advanceTimersByTimeAsync(0);
      expect(harness.audio.stop).toHaveBeenCalled();

      harness.socket.sendAudio.mockReturnValue(false);
      harness.emitChunk(new ArrayBuffer(3_200), 0);
      vi.advanceTimersByTime(11_000);
      harness.emitChunk(new ArrayBuffer(3_200), 1_600);

      expect(harness.onFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

/** 1초분(32,000B) 조각. 첫 바이트에 번호를 새겨 디스크를 돌아온 본문이 제 것인지 본다. */
function second(n: number) {
  const body = new ArrayBuffer(32_000);
  new Uint8Array(body)[0] = n % 256;
  return body;
}
const range = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => from + i);

describe("버퍼 한도", () => {
  it("5분을 넘으면 IndexedDB 로 흘려 담고, 다시 붙으면 거기서 읽어 원래 본문으로 보낸다", async () => {
    vi.useFakeTimers();
    const store = new FakeAudioStore();
    const harness = setup({ store });
    await harness.controller.connect(SESSION_ID);
    harness.server.refuse = true;
    harness.closeTransport(1006);

    for (let i = 0; i < 360; i += 1) harness.emitChunk(second(i), i * 16_000);
    await vi.advanceTimersByTimeAsync(0);

    expect(harness.buffer()).toMatchObject({
      pendingMs: 360_000,
      limitMs: 3_600_000,
      persistent: true,
      paused: false,
    });
    expect(store.size).toBe(360);

    harness.server.refuse = false;
    await vi.advanceTimersByTimeAsync(10_000);
    const calls = harness.socket.sendAudio.mock.calls;

    expect(calls.map((call) => call[1])).toEqual(range(0, 360));
    expect(calls.map((call) => new Uint8Array(call[0])[0])).toEqual(
      range(0, 360).map((n) => n % 256)
    );
    expect(calls.map((call) => call[2])).toEqual(
      range(0, 360).map((n) => n * 16_000)
    );
    // 5분 넘는 앞부분은 메모리에 없어서 디스크에서 읽어 왔다
    expect(store.reads).toBeGreaterThan(0);
  });

  it("60분에 닿으면 버리지 않고 캡처를 멈추고, 밀린 것이 빠지면 저절로 다시 받는다", async () => {
    vi.useFakeTimers();
    const store = new FakeAudioStore();
    const harness = setup({ store });
    await harness.controller.connect(SESSION_ID);
    harness.server.refuse = true;
    harness.closeTransport(1006);

    for (let i = 0; i < 3_600; i += 1) harness.emitChunk(second(i), i * 16_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.buffer()).toMatchObject({
      pendingMs: 3_600_000,
      paused: false,
    });

    harness.emitChunk(second(3_600), 3_600 * 16_000);
    expect(harness.buffer()).toMatchObject({
      pendingMs: 3_600_000,
      paused: true,
    });

    harness.server.refuse = false;
    await vi.advanceTimersByTimeAsync(10_000);
    harness.emitEvent({ type: "ack", throughChunkSeq: 599 });
    harness.emitChunk(second(3_601), 3_601 * 16_000);

    expect(harness.buffer()).toMatchObject({ paused: false });
    const calls = harness.socket.sendAudio.mock.calls;
    // 번호는 멈춘 동안 비지 않고, 멈춘 구간은 캡처 위치의 건너뜀으로만 남는다
    expect(calls.map((call) => call[1])).toEqual(range(0, 3_601));
    expect(calls[3_600][2]).toBe(3_601 * 16_000);
    expect(harness.onFailure).not.toHaveBeenCalled();
    // 실제 한도(115MB)를 가짜 디스크가 복사까지 해 가며 채운다. 혼자 돌면 2초, 전체 스위트 부하에선 5초를 넘는다
  }, 20_000);

  it("다시 붙으면 실시간 조각을 먼저 보내고, 밀린 것은 남는 자리로 보낸다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.closeTransport(1006);
    for (let i = 0; i < 20; i += 1) harness.emitChunk(); // 0..19 밀림
    harness.server.capacity = 3;

    await vi.advanceTimersByTimeAsync(500); // 붙자마자 0,1,2 로 소켓이 찬다
    harness.emitChunk(); // 20
    await vi.advanceTimersByTimeAsync(100);
    harness.emitChunk(); // 21
    await vi.advanceTimersByTimeAsync(100);

    expect(harness.acceptedSeqs(harness.socket).slice(0, 9)).toEqual([
      0, 1, 2, 20, 3, 4, 21, 5, 6,
    ]);
  });

  it("다시 붙은 뒤 밀린 소리를 얼마나 올렸는지 알리고, 다 올리면 걷는다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.closeTransport(1006);
    for (let i = 0; i < 30; i += 1) harness.emitChunk();
    harness.server.capacity = 3;

    await vi.advanceTimersByTimeAsync(500);
    expect(harness.buffer().upload).toEqual({
      percent: 10,
      remainingMs: 2_700,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(harness.buffer().upload).toBeNull();
  });

  it("밀린 것이 남은 채 멈추면 다 보낸 뒤에 stop 을 보낸다", async () => {
    vi.useFakeTimers();
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.closeTransport(1006);
    for (let i = 0; i < 30; i += 1) harness.emitChunk();
    harness.server.capacity = 3;
    await vi.advanceTimersByTimeAsync(500);

    const stopping = harness.controller.stop();
    await vi.advanceTimersByTimeAsync(300);
    expect(harness.socket.stop).not.toHaveBeenCalled();
    expect(harness.buffer().upload.percent).toBeGreaterThan(0);
    expect(harness.buffer().upload.percent).toBeLessThan(100);

    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;

    expect(harness.acceptedSeqs(harness.socket)).toEqual(range(0, 30));
    expect(harness.socket.stop).toHaveBeenCalledWith(29);
    expect(harness.onFailure).not.toHaveBeenCalled();
  });

  it("IndexedDB 가 쿼터로 거절하면 메모리 5분으로 물러나 알리고, 그 한도에서 멈춘다", async () => {
    vi.useFakeTimers();
    const store = new FakeAudioStore({ quotaBytes: 60 * 32_000 });
    const harness = setup({ store });
    await harness.controller.connect(SESSION_ID);
    harness.server.refuse = true;
    harness.closeTransport(1006);

    for (let i = 0; i < 100; i += 1) harness.emitChunk(second(i), i * 16_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.buffer()).toMatchObject({
      persistent: false,
      limitMs: 300_000,
      paused: false,
    });

    for (let i = 100; i < 300; i += 1) harness.emitChunk(second(i), i * 16_000);
    expect(harness.buffer()).toMatchObject({ paused: false });
    harness.emitChunk(second(300), 300 * 16_000);
    expect(harness.buffer()).toMatchObject({ paused: true });

    harness.server.refuse = false;
    await vi.advanceTimersByTimeAsync(10_000);
    const calls = harness.socket.sendAudio.mock.calls;
    expect(calls.map((call) => call[1])).toEqual(range(0, 300));
    expect(calls.map((call) => new Uint8Array(call[0])[0])).toEqual(
      range(0, 300).map((n) => n % 256)
    );
  });

  it("IndexedDB 가 없으면(Node 실험 틀) 조용히 메모리 5분으로 돈다", async () => {
    vi.useFakeTimers();
    const harness = setup({ store: null });
    await harness.controller.connect(SESSION_ID);
    harness.server.refuse = true;
    harness.closeTransport(1006);

    for (let i = 0; i < 300; i += 1) harness.emitChunk(second(i), i * 16_000);
    expect(harness.buffer()).toMatchObject({
      persistent: false,
      limitMs: 300_000,
      paused: false,
    });
    harness.emitChunk(second(300), 300 * 16_000);

    expect(harness.buffer()).toMatchObject({ paused: true });
    expect(harness.onFailure).not.toHaveBeenCalled();
  });

  // 탭 닫기 경고가 이 값을 본다. 1초 미만이 남았다가 다 빠진 것을 안 알리면 경고가 영영 안 풀린다
  it("1초 미만이 남았다가 ACK 로 다 빠져도 0 을 알린다", async () => {
    const harness = setup();
    await harness.controller.connect(SESSION_ID);
    harness.emitChunk();
    expect(harness.buffer()).toMatchObject({ pendingMs: 100 });

    harness.emitEvent({ type: "ack", throughChunkSeq: 0 });

    expect(harness.buffer()).toMatchObject({ pendingMs: 0 });
  });

  it("다시 이을 때 알리는 저장 대기는 ACK 못 받은 소리 전부다", async () => {
    vi.useFakeTimers();
    const harness = setup({ store: new FakeAudioStore() });
    await harness.controller.connect(SESSION_ID);
    harness.emitChunk(second(0));
    harness.emitChunk(second(1));
    harness.emitEvent({ type: "ack", throughChunkSeq: 0 });

    expect(harness.buffer()).toMatchObject({ pendingMs: 1_000 });
  });
});

describe("지난 탭이 남긴 소리", () => {
  async function leftover(store: FakeAudioStore) {
    for (let seq = 5; seq < 10; seq += 1) {
      await store.put(
        {
          noteId: "0HZX2K7M9Q4AF",
          sessionId: SESSION_ID,
          chunkSeq: seq,
          captureSamples: seq * 16_000,
          bytes: 32_000,
        },
        second(seq)
      );
    }
    return store.list();
  }

  it("같은 세션에 붙어 원래 번호·위치로 올리고, 마이크 없이 stop 한다", async () => {
    const store = new FakeAudioStore();
    const chunks = await leftover(store);
    const harness = setup({ store });

    await harness.controller.resume(SESSION_ID, chunks);

    const calls = harness.socket.sendAudio.mock.calls;
    expect(harness.socket.options.sessionId).toBe(SESSION_ID);
    expect(harness.socket.options.resendFromSeq).toBe(5);
    expect(calls.map((call) => call[1])).toEqual([5, 6, 7, 8, 9]);
    expect(calls.map((call) => call[2])).toEqual(
      [5, 6, 7, 8, 9].map((n) => n * 16_000)
    );
    expect(harness.socket.stop).toHaveBeenCalledWith(9);
    expect(harness.audio.start).not.toHaveBeenCalled();
    await new Promise((done) => setTimeout(done, 0));
    expect(store.size).toBe(0);
  });

  it("디스크에서 읽지 못하면 끝없이 기다리지 않고 남겨 둔 채 실패로 알린다", async () => {
    const store = new FakeAudioStore();
    const chunks = await leftover(store);
    vi.useFakeTimers();
    store.bodies = () =>
      Promise.reject(new DOMException("읽기 실패", "UnknownError"));
    const harness = setup({ store });

    let settled = false;
    void harness.controller.resume(SESSION_ID, chunks).finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(120_000);

    expect(settled).toBe(true);
    expect(harness.onFailure).toHaveBeenCalled();
    expect(harness.socket.stop).not.toHaveBeenCalled();
    expect(store.size).toBe(5);
  });

  it("서버가 받지 않으면 지우지 않고 남겨 둔 채 실패로 알린다", async () => {
    const store = new FakeAudioStore();
    const chunks = await leftover(store);
    const harness = setup({ store });
    harness.createSocket.mockImplementationOnce((options) => {
      const socket = {
        options,
        connect: vi.fn(async () => {
          options.onEvent({
            type: "error",
            code: "SESSION_NOT_CONNECTABLE",
            message: "이미 닫힌 세션입니다.",
          });
          throw new Error("이미 닫힌 세션입니다.");
        }),
        sendAudio: vi.fn(() => true),
        stop: vi.fn(),
        reconcileConnected: vi.fn(),
        close: vi.fn(async () => undefined),
      };
      harness.sockets.push(socket as never);
      return socket;
    });

    await expect(
      harness.controller.resume(SESSION_ID, chunks)
    ).rejects.toThrow();

    expect(harness.onFailure).toHaveBeenCalledWith("이미 닫힌 세션입니다.");
    await new Promise((done) => setTimeout(done, 0));
    expect(store.size).toBe(5);
  });
});
