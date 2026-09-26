import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptionSocket } from "@/lib/transcription/socket";

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly sent: unknown[] = [];
  readonly closes: Array<{ code: number; reason: string }> = [];
  readyState = FakeWebSocket.CONNECTING;
  bufferedAmount = 0;
  binaryType = "blob";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(
    readonly url: string,
    readonly protocols?: string | string[]
  ) {
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  message(data: unknown) {
    this.onmessage?.({ data });
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close(code = 1000, reason = "") {
    this.closes.push({ code, reason });
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code, reason }));
  }
}

const sessionId = "0HZX2K7M9Q4AB";

function frameText(frame: unknown) {
  if (typeof frame === "string") return frame;
  if (frame instanceof ArrayBuffer) return new TextDecoder().decode(frame);
  if (ArrayBuffer.isView(frame)) {
    return new TextDecoder().decode(
      new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength)
    );
  }
  return "";
}

function header(frame: unknown, name: string) {
  return frameText(frame)
    .split("\n")
    .find((line) => line.startsWith(`${name}:`))
    ?.slice(name.length + 1);
}

function messageFrame(subscription: string, body: string) {
  return [
    "MESSAGE",
    `subscription:${subscription}`,
    "message-id:test-message",
    "destination:/user/queue/transcription-events",
    "content-type:application/json",
    `content-length:${new TextEncoder().encode(body).byteLength}`,
    "",
    body,
  ]
    .join("\n")
    .concat("\0");
}

async function establish(socket: TranscriptionSocket) {
  const connected = socket.connect();
  await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
  const transport = FakeWebSocket.instances[0];
  transport.open();
  await vi.waitFor(() =>
    expect(
      transport.sent.some((frame) => frameText(frame).startsWith("CONNECT"))
    ).toBe(true)
  );
  transport.message(
    "CONNECTED\nversion:1.2\nheart-beat:0,0\nsession:test-stomp-session\n\n\0"
  );
  await vi.waitFor(() =>
    expect(
      transport.sent.some((frame) => frameText(frame).startsWith("SUBSCRIBE"))
    ).toBe(true)
  );
  const subscribe = transport.sent.find((frame) =>
    frameText(frame).startsWith("SUBSCRIBE")
  );
  const subscription = header(subscribe, "id")!;
  await vi.waitFor(() =>
    expect(
      transport.sent.some(
        (frame) =>
          frameText(frame).startsWith("SEND") &&
          header(frame, "destination") ===
            `/app/transcription-sessions/${sessionId}/connect`
      )
    ).toBe(true)
  );

  return {
    connected,
    transport,
    event(event: unknown) {
      transport.message(messageFrame(subscription, JSON.stringify(event)));
    },
    malformed(body: string) {
      transport.message(messageFrame(subscription, body));
    },
  };
}

function createSocket(onClose = vi.fn(), onActivity = vi.fn()) {
  return new TranscriptionSocket({
    url: "ws://localhost/ws/transcriptions",
    sessionId,
    clientInstanceId: "tab-7f3a",
    resendFromSeq: 42,
    onEvent: vi.fn(),
    onClose,
    onActivity,
  });
}

describe("TranscriptionSocket", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("crypto", {
      randomUUID: () => "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // 망이 먹통이면 close() 를 불러도 상대가 답하지 않아 close 이벤트가 안 온다. 하트비트를 놓친
  // 순간 끊김을 알려야 재부착이 시작된다(docker 망 먹통 실험에서 소켓이 끝까지 안 닫혔다).
  // 가짜 전송도 그 성질을 흉내 낸다: close() 가 onclose 를 부르지 않는다.
  it("reports a drop when server heartbeats stop even if the dead link never finishes closing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const onClose = vi.fn();
      const socket = createSocket(onClose);
      const connected = socket.connect();
      await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
      const transport = FakeWebSocket.instances[0];
      transport.open();
      await vi.waitFor(() =>
        expect(
          transport.sent.some((f) => frameText(f).startsWith("CONNECT"))
        ).toBe(true)
      );
      transport.message(
        "CONNECTED\nversion:1.2\nheart-beat:10000,10000\nsession:s\n\n\0"
      );
      await vi.waitFor(() =>
        expect(
          transport.sent.some((f) => frameText(f).startsWith("SUBSCRIBE"))
        ).toBe(true)
      );
      const subscription = header(
        transport.sent.find((f) => frameText(f).startsWith("SUBSCRIBE")),
        "id"
      )!;
      transport.message(
        messageFrame(
          subscription,
          JSON.stringify({
            type: "connected",
            sessionId,
            epoch: 1,
            durableThroughSeq: -1,
          })
        )
      );
      await connected;
      transport.close = (code = 1000, reason = "") => {
        transport.closes.push({ code, reason });
        transport.readyState = FakeWebSocket.CLOSING;
      };

      await vi.advanceTimersByTimeAsync(35_000);

      expect(onClose).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("subscribes before starting and sends valid PCM as a binary STOMP body", async () => {
    const socket = createSocket();
    const connection = await establish(socket);

    expect(socket.sendAudio(new ArrayBuffer(2), 0, 0)).toBe(false);
    connection.event({
      type: "connected",
      sessionId,
      epoch: 1,
      durableThroughSeq: -1,
    });
    await connection.connected;

    expect(socket.sendAudio(new ArrayBuffer(1), 0, 0)).toBe(false);
    expect(socket.sendAudio(new ArrayBuffer(32_002), 0, 0)).toBe(false);
    expect(socket.sendAudio(new ArrayBuffer(2), 0, 0)).toBe(true);
    const subscribeIndex = connection.transport.sent.findIndex((frame) =>
      frameText(frame).startsWith("SUBSCRIBE")
    );
    const connectIndex = connection.transport.sent.findIndex(
      (frame) =>
        frameText(frame).startsWith("SEND") &&
        header(frame, "destination") ===
          `/app/transcription-sessions/${sessionId}/connect`
    );
    expect(subscribeIndex).toBeLessThan(connectIndex);
    expect(
      connection.transport.sent.some(
        (frame) =>
          frameText(frame).startsWith("SEND") &&
          header(frame, "destination") ===
            `/app/transcription-sessions/${sessionId}/audio`
      )
    ).toBe(true);
  });

  it("carries chunkSeq and captureSamples on every audio frame", async () => {
    const socket = createSocket();
    const connection = await establish(socket);
    connection.event({
      type: "connected",
      sessionId,
      epoch: 1,
      durableThroughSeq: -1,
    });
    await connection.connected;

    expect(socket.sendAudio(new ArrayBuffer(3_200), 12, 19_200)).toBe(true);

    const audio = connection.transport.sent
      .map(frameText)
      .find((text) => text.includes(`/${sessionId}/audio`))!;
    expect(audio).toContain("chunkSeq:12");
    expect(audio).toContain("captureSamples:19200");
  });

  it("sends the last chunk number with stop", async () => {
    const socket = createSocket();
    const connection = await establish(socket);
    connection.event({
      type: "connected",
      sessionId,
      epoch: 1,
      durableThroughSeq: -1,
    });
    await connection.connected;

    socket.stop(421);

    const stop = connection.transport.sent
      .map(frameText)
      .find((text) => text.includes(`/${sessionId}/stop`))!;
    expect(stop).toContain('"finalChunkSeq":421');
  });

  it("rejects audio when the WebSocket send buffer is backlogged", async () => {
    const socket = createSocket();
    const connection = await establish(socket);
    connection.event({
      type: "connected",
      sessionId,
      epoch: 1,
      durableThroughSeq: -1,
    });
    await connection.connected;
    connection.transport.bufferedAmount = 96_001;

    expect(socket.sendAudio(new ArrayBuffer(4_800), 0, 0)).toBe(false);
  });

  it("ignores the MSW WebSocket shim's non-draining send buffer", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MOCKING", "enabled");
    const socket = createSocket();
    const connection = await establish(socket);
    connection.event({
      type: "connected",
      sessionId,
      epoch: 1,
      durableThroughSeq: -1,
    });
    await connection.connected;
    connection.transport.bufferedAmount = 96_001;

    expect(socket.sendAudio(new ArrayBuffer(4_800), 0, 0)).toBe(true);
  });

  it("reports a malformed server event and deactivates STOMP", async () => {
    const onClose = vi.fn();
    const socket = createSocket(onClose);
    const connection = await establish(socket);
    connection.event({
      type: "connected",
      sessionId,
      epoch: 1,
      durableThroughSeq: -1,
    });
    await connection.connected;

    connection.malformed('{"type":"unknown"}');

    await vi.waitFor(() =>
      expect(onClose).toHaveBeenCalledWith(1008, "invalid server event")
    );
    expect(socket.sendAudio(new ArrayBuffer(2), 0, 0)).toBe(false);
  });

  it("preserves a server error received before the application session is ready", async () => {
    const socket = createSocket();
    const connection = await establish(socket);

    connection.event({
      type: "error",
      code: "STT_CONNECTION_FAILED",
      message: "실시간 스크립트 서버 연결에 실패했습니다.",
    });

    await expect(connection.connected).rejects.toThrow(
      "실시간 스크립트 서버 연결에 실패했습니다."
    );
  });

  // 다른 탭·기기와 이 탭을 서버가 가른다. 다시 붙을 때마다 같은 값이어야 한다.
  it("carries the tab's clientInstanceId on the STOMP CONNECT and the attach message", async () => {
    const socket = createSocket();
    const connection = await establish(socket);

    const connect = connection.transport.sent.find((frame) =>
      frameText(frame).startsWith("CONNECT")
    );
    const attach = connection.transport.sent.find(
      (frame) =>
        frameText(frame).startsWith("SEND") &&
        header(frame, "destination") ===
          `/app/transcription-sessions/${sessionId}/connect`
    );
    expect(header(connect, "clientInstanceId")).toBe("tab-7f3a");
    expect(header(attach, "clientInstanceId")).toBe("tab-7f3a");
    expect(header(attach, "resendFromSeq")).toBe("42");
  });

  // 무수신 감시는 heartbeat 까지 세야 한다. 조용한 회의에서는 이벤트가 안 온다.
  it("reports inbound heartbeats as activity", async () => {
    const onActivity = vi.fn();
    const socket = createSocket(vi.fn(), onActivity);
    const connection = await establish(socket);
    onActivity.mockClear();

    connection.transport.message("\n");

    expect(onActivity).toHaveBeenCalled();
  });
});
