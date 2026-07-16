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
  ].join("\n").concat("\0");
}

async function establish(socket: TranscriptionSocket) {
  const connected = socket.connect();
  await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
  const transport = FakeWebSocket.instances[0];
  transport.open();
  await vi.waitFor(() =>
    expect(transport.sent.some((frame) => frameText(frame).startsWith("CONNECT"))).toBe(true)
  );
  transport.message(
    "CONNECTED\nversion:1.2\nheart-beat:0,0\nsession:test-stomp-session\n\n\0"
  );
  await vi.waitFor(() =>
    expect(transport.sent.some((frame) => frameText(frame).startsWith("SUBSCRIBE"))).toBe(true)
  );
  const subscribe = transport.sent.find((frame) => frameText(frame).startsWith("SUBSCRIBE"));
  const subscription = header(subscribe, "id")!;
  transport.message(
    `RECEIPT\nreceipt-id:${header(subscribe, "receipt")}\n\n\0`
  );
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

function createSocket(onClose = vi.fn()) {
  return new TranscriptionSocket({
    url: "ws://localhost/ws/transcriptions",
    sessionId,
    onEvent: vi.fn(),
    onClose,
  });
}

describe("TranscriptionSocket", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("crypto", { randomUUID: () => "550e8400-e29b-41d4-a716-446655440000" });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("subscribes before starting and sends valid PCM as a binary STOMP body", async () => {
    const socket = createSocket();
    const connection = await establish(socket);

    expect(socket.sendAudio(new ArrayBuffer(2))).toBe(false);
    connection.event({ type: "connected", sessionId });
    await connection.connected;

    expect(socket.sendAudio(new ArrayBuffer(1))).toBe(false);
    expect(socket.sendAudio(new ArrayBuffer(1_048_578))).toBe(false);
    expect(socket.sendAudio(new ArrayBuffer(2))).toBe(true);
    expect(
      connection.transport.sent.some(
        (frame) =>
          frameText(frame).startsWith("SEND") &&
          header(frame, "destination") ===
            `/app/transcription-sessions/${sessionId}/audio`
      )
    ).toBe(true);
  });

  it("uses separate STOMP destinations for commit and stop", async () => {
    const socket = createSocket();
    const connection = await establish(socket);
    connection.event({ type: "connected", sessionId });
    await connection.connected;

    socket.commit();
    socket.stop();

    const destinations = connection.transport.sent.map((frame) =>
      header(frame, "destination")
    );
    expect(destinations).toContain(
      `/app/transcription-sessions/${sessionId}/commit`
    );
    expect(destinations).toContain(
      `/app/transcription-sessions/${sessionId}/stop`
    );
  });

  it("rejects audio when the WebSocket send buffer is backlogged", async () => {
    const socket = createSocket();
    const connection = await establish(socket);
    connection.event({ type: "connected", sessionId });
    await connection.connected;
    connection.transport.bufferedAmount = 96_001;

    expect(socket.sendAudio(new ArrayBuffer(4_800))).toBe(false);
  });

  it("reports a malformed server event and deactivates STOMP", async () => {
    const onClose = vi.fn();
    const socket = createSocket(onClose);
    const connection = await establish(socket);
    connection.event({ type: "connected", sessionId });
    await connection.connected;

    connection.malformed('{"type":"unknown"}');

    await vi.waitFor(() =>
      expect(onClose).toHaveBeenCalledWith(1008, "invalid server event")
    );
    expect(socket.sendAudio(new ArrayBuffer(2))).toBe(false);
  });

  it("preserves a server error received before the application session is ready", async () => {
    const socket = createSocket();
    const connection = await establish(socket);

    connection.event({
      type: "error",
      code: "STT_CONNECTION_FAILED",
      message: "실시간 전사 서버 연결에 실패했습니다.",
    });

    await expect(connection.connected).rejects.toThrow(
      "실시간 전사 서버 연결에 실패했습니다."
    );
  });
});
