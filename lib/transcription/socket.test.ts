import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptionSocket } from "@/lib/transcription/socket";

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readonly sent: unknown[] = [];
  readonly closes: Array<{ code: number; reason: string }> = [];
  readyState = FakeWebSocket.CONNECTING;
  binaryType = "blob";

  constructor(readonly url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  message(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close(code = 1000, reason = "") {
    this.closes.push({ code, reason });
    this.readyState = 3;
    this.dispatchEvent(new CloseEvent("close", { code, reason }));
  }
}

describe("TranscriptionSocket", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("waits for connected and sends only valid PCM frames afterward", async () => {
    const socket = new TranscriptionSocket({
      url: "ws://localhost/ws/transcription-sessions/0HZX2K7M9Q4AB",
      onEvent: vi.fn(),
      onClose: vi.fn(),
    });
    const connected = socket.connect();
    const transport = FakeWebSocket.instances[0];
    transport.open();

    socket.sendAudio(new ArrayBuffer(2));
    expect(transport.sent).toHaveLength(0);

    transport.message(
      JSON.stringify({ type: "connected", sessionId: "0HZX2K7M9Q4AB" })
    );
    await connected;

    socket.sendAudio(new ArrayBuffer(1));
    socket.sendAudio(new ArrayBuffer(1_048_578));
    socket.sendAudio(new ArrayBuffer(2));
    expect(transport.sent).toEqual([expect.any(ArrayBuffer)]);
  });

  it("serializes commit and stop and closes after completed", async () => {
    const onClose = vi.fn();
    const socket = new TranscriptionSocket({
      url: "ws://localhost/ws/transcription-sessions/0HZX2K7M9Q4AB",
      onEvent: vi.fn(),
      onClose,
    });
    const connected = socket.connect();
    const transport = FakeWebSocket.instances[0];
    transport.open();
    transport.message(
      JSON.stringify({ type: "connected", sessionId: "0HZX2K7M9Q4AB" })
    );
    await connected;

    socket.commit();
    socket.stop();
    expect(transport.sent).toContain('{"type":"commit"}');
    expect(transport.sent).toContain('{"type":"stop"}');

    transport.message(
      JSON.stringify({ type: "completed", sessionId: "0HZX2K7M9Q4AB" })
    );
    expect(onClose).toHaveBeenCalledWith(1000, "completed");
  });

  it("closes with 1008 when the server sends a malformed event", async () => {
    const socket = new TranscriptionSocket({
      url: "ws://localhost/ws/transcription-sessions/0HZX2K7M9Q4AB",
      onEvent: vi.fn(),
      onClose: vi.fn(),
    });
    const connected = socket.connect();
    const transport = FakeWebSocket.instances[0];
    transport.open();
    transport.message(
      JSON.stringify({ type: "connected", sessionId: "0HZX2K7M9Q4AB" })
    );
    await connected;

    transport.message('{"type":"unknown"}');
    expect(transport.closes).toContainEqual({
      code: 1008,
      reason: "invalid server event",
    });
  });
});
