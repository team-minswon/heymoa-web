import {
  Client,
  ReconnectionTimeMode,
  type StompSubscription,
} from "@stomp/stompjs";

import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import {
  parseNoteTopicEvent,
  type NoteTopicEvent,
} from "@/lib/notes/note-topic-protocol";

export type NoteTopicClientOptions = {
  url: string;
  noteId: string;
  onEvent: (event: NoteTopicEvent) => void;
  onCatchUp: () => void;
};

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
      onConnect: () => {
        if (this.client !== client) return;
        this.subscription?.unsubscribe();
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
        // Spring simple broker에는 SUBSCRIBE receipt가 없다. client callback을 먼저 세운 뒤
        // REST snapshot을 재검증하고, 서버 등록 사이의 남은 gap은 safety poll로 복구한다.
        this.options.onCatchUp();
      },
    });
    this.client = client;
    client.activate();
  }

  async close() {
    const client = this.client;
    if (!client) return;
    this.client = null;
    this.subscription?.unsubscribe();
    this.subscription = null;
    await client.deactivate({ force: true });
  }
}
