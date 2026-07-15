import {
  parseServerEvent,
  type ClientCommand,
  type ServerEvent,
} from "@/lib/transcription/protocol";

export type TranscriptionSocketOptions = {
  url: string;
  onEvent: (event: ServerEvent) => void;
  onClose: (code: number, reason: string) => void;
};

export class TranscriptionSocket {
  private socket: WebSocket | null = null;
  private connected = false;

  constructor(private readonly options: TranscriptionSocketOptions) {}

  connect(): Promise<void> {
    if (this.socket) return Promise.reject(new Error("ALREADY_CONNECTED"));

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.options.url);
      this.socket = socket;
      socket.binaryType = "arraybuffer";

      socket.addEventListener("message", (message) => {
        if (typeof message.data !== "string") return;

        try {
          const event = parseServerEvent(message.data);
          if (event.type === "connected" && !this.connected) {
            this.connected = true;
            resolve();
          }
          if (event.type === "error" && !this.connected) {
            reject(new Error(event.message));
          }
          this.options.onEvent(event);
          if (event.type === "completed") {
            socket.close(1000, "completed");
          }
        } catch (error) {
          if (!this.connected) reject(error);
          socket.close(1008, "invalid server event");
        }
      });

      socket.addEventListener("error", () => {
        if (!this.connected) reject(new Error("WEBSOCKET_CONNECTION_FAILED"));
      });

      socket.addEventListener("close", (event) => {
        const hadConnected = this.connected;
        this.socket = null;
        this.connected = false;
        if (!hadConnected) reject(new Error(event.reason || "WEBSOCKET_CLOSED"));
        this.options.onClose(event.code, event.reason);
      });
    });
  }

  sendAudio(chunk: ArrayBuffer) {
    if (
      !this.connected ||
      chunk.byteLength < 2 ||
      chunk.byteLength > 1_048_576 ||
      chunk.byteLength % 2 !== 0
    ) {
      return;
    }
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(chunk);
    }
  }

  commit() {
    this.sendCommand({ type: "commit" });
  }

  stop() {
    this.sendCommand({ type: "stop" });
  }

  private sendCommand(command: ClientCommand) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(command));
    }
  }

  close() {
    this.socket?.close(1000, "client closed");
    this.socket = null;
    this.connected = false;
  }
}
