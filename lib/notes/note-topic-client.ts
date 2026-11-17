import {
  Client,
  ReconnectionTimeMode,
  type StompSubscription,
} from "@stomp/stompjs";

import { ticketedSocketUrl } from "@/lib/api/realtime-ticket";
import {
  NOTE_SUBSCRIPTION_FEEDBACK_DESTINATION,
  parseNoteSubscriptionRejected,
  parseNoteTopicEvent,
  type NoteSubscriptionRejected,
  type NoteTopicEvent,
} from "@/lib/notes/note-topic-protocol";

export type NoteTopicClientOptions = {
  url: string;
  noteId: string;
  onEvent: (event: NoteTopicEvent) => void;
  onCatchUp: () => void;
  onSubscriptionRejected: (rejection: NoteSubscriptionRejected) => void;
  onReconnectingChange?: (reconnecting: boolean) => void;
};

const SAFETY_CATCH_UP_INTERVAL_MS = 60_000;
export const RECONNECT_NOTICE_MS = 30_000;
const TICKET_TIMEOUT_MS = 10_000;

export class NoteTopicClient {
  private client: Client | null = null;
  private subscription: StompSubscription | null = null;
  private feedbackSubscription: StompSubscription | null = null;
  private safetyCatchUpTimer: number | null = null;
  private reconnectNoticeTimer: number | null = null;
  private reconnecting = false;

  constructor(private readonly options: NoteTopicClientOptions) {}

  connect() {
    if (this.client) return;

    const client = new Client({
      brokerURL: this.options.url,
      reconnectDelay: 500,
      maxReconnectDelay: 30_000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      connectionTimeout: 10_000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      discardWebsocketOnCommFailure: true,
      debug: () => undefined,
      beforeConnect: async () => {
        client.brokerURL =
          (await ticketedSocketUrl(this.options.url, TICKET_TIMEOUT_MS)) ??
          this.options.url;
      },
      onWebSocketClose: () => {
        if (this.client !== client) return;
        this.clearSafetyCatchUp();
        this.startReconnectNotice();
      },
      onConnect: () => {
        if (this.client !== client) return;
        this.clearReconnectNotice();
        if (this.reconnecting) {
          this.reconnecting = false;
          this.options.onReconnectingChange?.(false);
        }
        this.clearSafetyCatchUp();
        this.subscription?.unsubscribe();
        this.feedbackSubscription?.unsubscribe();
        this.feedbackSubscription = client.subscribe(
          NOTE_SUBSCRIPTION_FEEDBACK_DESTINATION,
          (message) => {
            try {
              const rejection = parseNoteSubscriptionRejected(message.body);
              if (rejection.noteId !== this.options.noteId) return;
              this.subscription?.unsubscribe();
              this.subscription = null;
              this.clearSafetyCatchUp();
              this.options.onSubscriptionRejected(rejection);
            } catch {}
          }
        );
        this.subscribeNote(client);
        // Spring simple broker 에는 SUBSCRIBE receipt 가 없어 구독 등록 전후의 이벤트를 놓칠 수 있습니다.
        // 연결 중 60초마다 catch-up 을 되풀이해 영구 stale 을 막습니다.
        this.options.onCatchUp();
        this.startSafetyCatchUp();
      },
    });
    this.client = client;
    this.startReconnectNotice();
    client.activate();
  }

  private startReconnectNotice() {
    if (this.reconnectNoticeTimer !== null || this.reconnecting) return;
    this.reconnectNoticeTimer = window.setTimeout(() => {
      this.reconnectNoticeTimer = null;
      this.reconnecting = true;
      this.options.onReconnectingChange?.(true);
    }, RECONNECT_NOTICE_MS);
  }

  private clearReconnectNotice() {
    if (this.reconnectNoticeTimer !== null) {
      window.clearTimeout(this.reconnectNoticeTimer);
      this.reconnectNoticeTimer = null;
    }
  }

  retrySubscription() {
    const client = this.client;
    if (!client?.connected || this.subscription) return;
    this.subscribeNote(client);
    this.options.onCatchUp();
    this.startSafetyCatchUp();
  }

  private clearSafetyCatchUp() {
    if (this.safetyCatchUpTimer !== null) {
      window.clearInterval(this.safetyCatchUpTimer);
      this.safetyCatchUpTimer = null;
    }
  }

  private startSafetyCatchUp() {
    this.clearSafetyCatchUp();
    this.safetyCatchUpTimer = window.setInterval(() => {
      if (this.client?.connected && this.subscription) this.options.onCatchUp();
    }, SAFETY_CATCH_UP_INTERVAL_MS);
  }

  private subscribeNote(client: Client) {
    this.subscription = client.subscribe(
      `/topic/notes/${this.options.noteId}`,
      (message) => {
        try {
          this.options.onEvent(parseNoteTopicEvent(message.body));
        } catch {}
      }
    );
  }

  async close() {
    const client = this.client;
    if (!client) return;
    this.client = null;
    this.clearSafetyCatchUp();
    this.clearReconnectNotice();
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.feedbackSubscription?.unsubscribe();
    this.feedbackSubscription = null;
    await client.deactivate({ force: true });
  }
}
