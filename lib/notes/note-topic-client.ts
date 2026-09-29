import {
  Client,
  ReconnectionTimeMode,
  type StompSubscription,
} from "@stomp/stompjs";

import { AuthRefreshError, refreshAuthOnce } from "@/lib/api/fetcher";
import { openSessionGate } from "@/lib/auth/session-gate";
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
  /** 30초 넘게 못 붙었다(true) · 다시 붙었다(false). */
  onReconnectingChange?: (reconnecting: boolean) => void;
};

const SAFETY_CATCH_UP_INTERVAL_MS = 60_000;
/** 녹음 쪽 알림(D-03)과 같은 창이다. 한 화면에서 두 기준을 쓰지 않는다. */
export const RECONNECT_NOTICE_MS = 30_000;
/** 토큰 갱신을 기다리는 상한. 넘으면 갱신 없이 시도한다 — 안 끝나는 갱신이 재연결을 세우면 안 된다. */
const REFRESH_BEFORE_CONNECT_TIMEOUT_MS = 10_000;

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

    // 이번 시도가 CONNECTED 까지 갔나. 못 갔으면 다음 시도 전에 토큰을 갱신한다.
    let attemptConnected = false;
    let lastAttemptFailed = false;
    const client = new Client({
      brokerURL: this.options.url,
      reconnectDelay: 500,
      maxReconnectDelay: 30_000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      connectionTimeout: 10_000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      // 끊긴 소켓의 close 핸드셰이크를 기다리지 않는다. 배포 드레인 뒤 다시 붙기가 그만큼 늦어진다.
      discardWebsocketOnCommFailure: true,
      debug: () => undefined,
      // 만료 토큰(30분)이면 핸드셰이크가 매번 거절되고 stompjs 는 조용히 무한 재시도한다.
      // 붙어 있다 끊긴 것(배포 드레인)은 토큰 탓이 아니라 갱신하지 않는다.
      // 반드시 삼킨다 — await 중에 던지면 stompjs 의 재연결 루프가 멈춘다.
      beforeConnect: async () => {
        const refresh = lastAttemptFailed;
        attemptConnected = false;
        if (!refresh) return;
        let timer: number | undefined;
        await Promise.race([
          refreshAuthOnce().catch((error: unknown) => {
            if (error instanceof AuthRefreshError && error.expired) {
              openSessionGate();
            }
          }),
          new Promise<void>((resolve) => {
            timer = window.setTimeout(
              resolve,
              REFRESH_BEFORE_CONNECT_TIMEOUT_MS
            );
          }),
        ]);
        window.clearTimeout(timer);
      },
      onWebSocketClose: () => {
        lastAttemptFailed = !attemptConnected;
        attemptConnected = false;
        if (this.client !== client) return;
        this.clearSafetyCatchUp();
        this.startReconnectNotice();
      },
      onConnect: () => {
        if (this.client !== client) return;
        attemptConnected = true;
        this.clearReconnectNotice();
        if (this.reconnecting) {
          this.reconnecting = false;
          this.options.onReconnectingChange?.(false);
        }
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
    this.startReconnectNotice();
    client.activate();
  }

  /** 못 붙은 첫 순간부터 센다. 시도마다 다시 세면 영영 안 뜬다. */
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
    this.clearReconnectNotice();
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.feedbackSubscription?.unsubscribe();
    this.feedbackSubscription = null;
    await client.deactivate({ force: true });
  }
}
