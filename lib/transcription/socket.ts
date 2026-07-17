import { Client, type StompSubscription } from "@stomp/stompjs";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import {
  parseServerEvent,
  type ServerEvent,
} from "@/lib/transcription/protocol";

export type TranscriptionSocketOptions = {
  url: string;
  sessionId: string;
  onEvent: (event: ServerEvent) => void;
  onClose: (code: number, reason: string) => void;
};

const MAX_BUFFERED_BYTES = 96_000;

export class TranscriptionSocket {
  private client: Client | null = null;
  private subscription: StompSubscription | null = null;
  private connected = false;
  private closing = false;
  private reconcileConnection: (() => void) | null = null;

  constructor(private readonly options: TranscriptionSocketOptions) {}

  connect(): Promise<void> {
    if (this.client) return Promise.reject(new Error("ALREADY_CONNECTED"));
    this.closing = false;

    return new Promise((resolve, reject) => {
      let settled = false;
      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(readyTimeout);
        resolve();
      };
      const rejectOnce = (error: Error) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(readyTimeout);
        this.reconcileConnection = null;
        reject(error);
      };
      const readyTimeout = globalThis.setTimeout(() => {
        rejectOnce(new Error("STOMP_APPLICATION_READY_TIMEOUT"));
        void this.close();
      }, 10_000);
      const client = new Client({
        brokerURL: this.options.url,
        reconnectDelay: 0,
        connectionTimeout: 10_000,
        heartbeatIncoming: 10_000,
        heartbeatOutgoing: 10_000,
        debug: () => undefined,
        onConnect: () => {
          const replyId = crypto.randomUUID();
          this.subscription = client.subscribe(
            `/user/queue/transcription-sessions/${replyId}/events`,
            (message) => {
              try {
                const event = parseServerEvent(message.body);
                if (event.type === "connected" && !this.connected) {
                  this.reconcileConnection?.();
                }
                if (event.type === "error" && !this.connected) {
                  rejectOnce(new Error(event.message));
                }
                this.options.onEvent(event);
                if (event.type === "completed" || event.type === "error") {
                  void this.close();
                }
              } catch (cause) {
                const error =
                  cause instanceof Error ? cause : new Error(String(cause));
                if (!this.connected) rejectOnce(error);
                else this.options.onClose(1008, "invalid server event");
                void this.close();
              }
            }
          );
          // Spring's simple broker does not acknowledge SUBSCRIBE receipts.
          // Frame order plus preserveReceiveOrder(true) guarantees registration
          // before the following application connect message is handled.
          client.publish({
            destination: this.destination("connect"),
            headers: { "reply-id": replyId },
          });
        },
        onStompError: (frame) => {
          const reason = frame.headers.message || "STOMP_PROTOCOL_ERROR";
          if (!this.connected) rejectOnce(new Error(reason));
          else this.options.onClose(1011, reason);
          void this.close();
        },
        onWebSocketError: () => {
          if (!this.connected) {
            rejectOnce(new Error("WEBSOCKET_CONNECTION_FAILED"));
          }
        },
        onWebSocketClose: (event) => {
          const expected = this.closing;
          const hadConnected = this.connected;
          this.client = null;
          this.subscription = null;
          this.connected = false;
          this.reconcileConnection = null;
          if (!hadConnected) {
            rejectOnce(new Error(event.reason || "WEBSOCKET_CLOSED"));
          }
          if (!expected) this.options.onClose(event.code, event.reason);
        },
      });
      this.reconcileConnection = () => {
        if (!client.connected || this.connected) return;
        this.connected = true;
        resolveOnce();
      };
      this.client = client;
      void client.activate();
    });
  }

  reconcileConnected() {
    this.reconcileConnection?.();
  }

  sendAudio(chunk: ArrayBuffer): boolean {
    if (
      !this.connected ||
      chunk.byteLength < 2 ||
      chunk.byteLength > 1_048_576 ||
      chunk.byteLength % 2 !== 0
    ) {
      return false;
    }
    const client = this.client;
    const transport = client?.webSocket as WebSocket | undefined;
    if (
      !client?.connected ||
      !transport ||
      (!shouldEnableMocking() && transport.bufferedAmount > MAX_BUFFERED_BYTES)
    )
      return false;

    client.publish({
      destination: this.destination("audio"),
      binaryBody: new Uint8Array(chunk),
      headers: { "content-type": "application/octet-stream" },
    });
    return true;
  }

  commit() {
    this.sendCommand("commit");
  }

  stop() {
    this.sendCommand("stop");
  }

  private sendCommand(command: "commit" | "stop") {
    if (this.client?.connected) {
      this.client.publish({ destination: this.destination(command) });
    }
  }

  async close() {
    const client = this.client;
    if (!client) return;
    this.closing = true;
    this.client = null;
    this.connected = false;
    this.reconcileConnection = null;
    this.subscription?.unsubscribe();
    this.subscription = null;
    await client.deactivate();
  }

  private destination(action: "connect" | "audio" | "commit" | "stop") {
    return `/app/transcription-sessions/${this.options.sessionId}/${action}`;
  }
}
