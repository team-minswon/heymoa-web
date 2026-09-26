import { Client, type StompSubscription } from "@stomp/stompjs";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import {
  CAPTURE_CONTRACT,
  CAPTURE_TUNING,
} from "@/lib/transcription/capture-config";
import {
  parseServerEvent,
  type ServerEvent,
} from "@/lib/transcription/protocol";

/** 왜 붙나. server 가 부착 줄에 남긴다(observability.md). */
export type ReconnectReason =
  | "initial"
  | "socket_closed"
  | "no_receive"
  | "send_stalled"
  | "server_reattach"
  | "buffer_full"
  | "store_incomplete"
  | "online";

export type TranscriptionSocketOptions = {
  url: string;
  sessionId: string;
  /** 이 탭. 서버가 다른 탭·기기의 부착과 가른다. 다시 붙을 때도 같은 값이다. */
  clientInstanceId: string;
  /** 아직 들고 있는 가장 앞 조각 번호. 그 앞은 이미 지웠으니 서버가 기다리지 않는다. */
  resendFromSeq?: number;
  reconnectReason?: ReconnectReason;
  /** 끊김을 알아챈 뒤 이 부착 시도까지. 처음 붙을 때는 0. */
  disconnectedMs?: number;
  /** ACK 못 받아 들고 있는 조각 수. */
  pendingChunks?: number;
  onEvent: (event: ServerEvent) => void;
  onClose: (code: number, reason: string) => void;
  /** heartbeat 를 포함해 무엇이든 들어왔다. 이벤트만으로는 조용한 회의의 무수신을 못 가른다. */
  onActivity?: () => void;
};

/**
 * OS 소켓 버퍼가 밀렸는지만 본다. 「서버가 내구 저장했는가」는 `ResendBuffer`가 본다 —
 * 소켓을 떠난 조각도 서버가 S3에 쓰기 전에 죽으면 사라지므로 둘은 다른 질문이다.
 */
const MAX_BUFFERED_BYTES = CAPTURE_TUNING.backpressureBytes;

function stringHeaders(values: Record<string, string | number | undefined>) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)])
  );
}

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
        // 기본값이면 하트비트를 놓쳐도 close() 만 부르고, 죽은 망에서는 close 이벤트가 오지 않는다.
        discardWebsocketOnCommFailure: true,
        connectHeaders: { clientInstanceId: this.options.clientInstanceId },
        onHeartbeatReceived: () => this.options.onActivity?.(),
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
            headers: {
              "reply-id": replyId,
              clientInstanceId: this.options.clientInstanceId,
              ...stringHeaders({
                resendFromSeq: this.options.resendFromSeq,
                reconnectReason: this.options.reconnectReason,
                disconnectedMs: this.options.disconnectedMs,
                pendingChunks: this.options.pendingChunks,
              }),
            },
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

  /**
   * 헤더가 둘이다. `chunkSeq`는 몇 번째인가, `captureSamples`는 언제인가를 말한다.
   * 번호만으로는 백그라운드로 못 잡은 20초를 못 잡아낸다 — 번호는 그대로 이어진다.
   */
  sendAudio(
    chunk: ArrayBuffer,
    chunkSeq: number,
    captureSamples: number
  ): boolean {
    if (
      !this.connected ||
      chunk.byteLength < CAPTURE_CONTRACT.minFrameBytes ||
      chunk.byteLength > CAPTURE_CONTRACT.maxFrameBytes ||
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
      headers: {
        "content-type": "application/octet-stream",
        chunkSeq: String(chunkSeq),
        captureSamples: String(captureSamples),
      },
    });
    return true;
  }

  /** 조각을 하나도 못 보냈으면 `-1`이다. 서버가 그것으로 「보낸 것이 없다」를 안다. */
  stop(finalChunkSeq: number) {
    if (this.client?.connected) {
      this.client.publish({
        destination: this.destination("stop"),
        body: JSON.stringify({ type: "stop", finalChunkSeq }),
        headers: { "content-type": "application/json" },
      });
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

  private destination(action: "connect" | "audio" | "stop") {
    return `/app/transcription-sessions/${this.options.sessionId}/${action}`;
  }
}
