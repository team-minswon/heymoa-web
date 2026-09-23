import {
  Client,
  ReconnectionTimeMode,
  type StompSubscription,
} from "@stomp/stompjs";

import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
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
};

const SAFETY_CATCH_UP_INTERVAL_MS = 60_000;

export function getNoteTopicWebSocketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const baseUrl = shouldEnableMocking()
    ? `${protocol}//${window.location.host}`
    : apiBaseUrl
      ? apiBaseUrl.replace(/^http/, "ws").replace(/\/$/, "")
      : `${protocol}//${window.location.host}`;
  return `${baseUrl}/ws/transcriptions`;
}

export class NoteTopicClient {
  private client: Client | null = null;
  private subscription: StompSubscription | null = null;
  private feedbackSubscription: StompSubscription | null = null;
  private safetyCatchUpTimer: number | null = null;

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
      debug: () => undefined,
      onWebSocketClose: () => {
        if (this.client === client) this.clearSafetyCatchUp();
      },
      onConnect: () => {
        if (this.client !== client) return;
        this.clearSafetyCatchUp();
        this.subscription?.unsubscribe();
        this.feedbackSubscription?.unsubscribe();
        // 거절된 노트 토픽은 이벤트를 받을 수 없다. 사용자 queue를 먼저 연다.
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
            } catch {
              // 알 수 없는 피드백 한 건이 이후 정상 프레임을 끊지 않게 한다.
            }
          }
        );
        this.subscribeNote(client);
        // Spring simple broker에는 SUBSCRIBE receipt가 없다. 즉시 snapshot만 읽으면
        // 구독 등록 전에 끝난 REST 요청과 등록 사이의 이벤트를 놓칠 수 있다.
        // 연결 중 60초마다 같은 catch-up을 반복해 영구 stale을 막는다.
        this.options.onCatchUp();
        this.startSafetyCatchUp();
      },
    });
    this.client = client;
    client.activate();
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
        } catch {
          // 서버 계약 밖 프레임 하나가 이후의 정상 이벤트까지 끊지 않게 한다.
        }
      }
    );
  }

  async close() {
    const client = this.client;
    if (!client) return;
    this.client = null;
    this.clearSafetyCatchUp();
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.feedbackSubscription?.unsubscribe();
    this.feedbackSubscription = null;
    await client.deactivate({ force: true });
  }
}
