import {
  parseServerEvent,
  type ClientCommand,
  type ServerEvent,
  type TranscriptionSessionStatus,
} from "@/lib/transcription/protocol";

export type TranscriptionSocketOptions = {
  url: string;
  onEvent: (event: ServerEvent) => void;
  onClose: (code: number, reason: string) => void;
};

export class TranscriptionSocket {
  private socket: WebSocket | null = null;
  private status: TranscriptionSessionStatus = "CONNECTING";

  constructor(private readonly options: TranscriptionSocketOptions) {}

  connect(): Promise<void> {
    if (this.socket) return Promise.reject(new Error("ALREADY_CONNECTED"));

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.options.url);
      this.socket = socket;
      socket.binaryType = "arraybuffer";
      let ready = false;

      socket.addEventListener("message", (message) => {
        if (typeof message.data !== "string") return;

        try {
          const event = parseServerEvent(message.data);
          if (event.type === "SESSION_READY" && !ready) {
            ready = true;
            resolve();
          }
          if (event.type === "SESSION_STATUS") this.status = event.status;
          this.options.onEvent(event);
          if (event.type === "SESSION_COMPLETED") {
            socket.close(1000, "completed");
          }
        } catch (error) {
          if (!ready) reject(error);
          socket.close(4409, "invalid server event");
        }
      });

      socket.addEventListener("error", () => {
        if (!ready) reject(new Error("WEBSOCKET_CONNECTION_FAILED"));
      });

      socket.addEventListener("close", (event) => {
        this.socket = null;
        if (!ready) reject(new Error(event.reason || "WEBSOCKET_CLOSED"));
        this.options.onClose(event.code, event.reason);
      });
    });
  }

  sendAudio(chunk: ArrayBuffer) {
    if (
      this.status === "STREAMING" &&
      this.socket?.readyState === WebSocket.OPEN
    ) {
      this.socket.send(chunk);
    }
  }

  sendCommand(command: ClientCommand) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(command));
    }
  }

  close() {
    this.socket?.close(1000, "client closed");
    this.socket = null;
  }
}
