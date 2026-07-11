import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptionSocket } from "@/lib/transcription/socket";

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readonly sent: unknown[] = [];
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

  it("waits for READY and forwards audio only while STREAMING", async () => {
    const onEvent = vi.fn();
    const socket = new TranscriptionSocket({
      url: "ws://localhost/stream?ticket=test",
      onEvent,
      onClose: vi.fn(),
    });
    const connected = socket.connect();
    const transport = FakeWebSocket.instances[0];
    transport.open();

    socket.sendAudio(new ArrayBuffer(2));
    expect(transport.sent).toHaveLength(0);

    transport.message(
      JSON.stringify({ type: "SESSION_READY", sessionId: "01K0000000010" })
    );
    await connected;
    transport.message(
      JSON.stringify({ type: "SESSION_STATUS", status: "STREAMING" })
    );
    socket.sendAudio(new ArrayBuffer(2));
    expect(transport.sent).toHaveLength(1);
  });

  it("serializes commands and closes after SESSION_COMPLETED", async () => {
    const onClose = vi.fn();
    const socket = new TranscriptionSocket({
      url: "ws://localhost/stream?ticket=test",
      onEvent: vi.fn(),
      onClose,
    });
    const connected = socket.connect();
    const transport = FakeWebSocket.instances[0];
    transport.open();
    transport.message(
      JSON.stringify({ type: "SESSION_READY", sessionId: "01K0000000010" })
    );
    await connected;

    socket.sendCommand({ type: "SESSION_PAUSE" });
    expect(transport.sent).toContain(JSON.stringify({ type: "SESSION_PAUSE" }));

    transport.message(
      JSON.stringify({
        type: "SESSION_COMPLETED",
        sessionId: "01K0000000010",
      })
    );
    expect(onClose).toHaveBeenCalledWith(1000, "completed");
  });
});
