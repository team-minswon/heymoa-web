import { ReconnectionTimeMode } from "@stomp/stompjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteTopicClient } from "@/lib/notes/note-topic-client";

const stomp = vi.hoisted(() => ({
  configs: [] as Array<Record<string, unknown>>,
  instances: [] as Array<{
    connected: boolean;
    activate: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("@stomp/stompjs", () => {
  class Client {
    connected = true;
    readonly activate = vi.fn();
    readonly deactivate = vi.fn().mockResolvedValue(undefined);
    readonly unsubscribe = vi.fn();
    readonly subscribe = vi.fn(() => ({ unsubscribe: this.unsubscribe }));

    constructor(config: Record<string, unknown>) {
      stomp.configs.push(config);
      stomp.instances.push(this);
    }
  }

  return {
    Client,
    ReconnectionTimeMode: {
      EXPONENTIAL: "EXPONENTIAL",
      LINEAR: "LINEAR",
    },
  };
});

const NOTE_ID = "01K0000000002";

function createClient() {
  const onEvent = vi.fn();
  const onCatchUp = vi.fn();
  const onSubscriptionRejected = vi.fn();
  const client = new NoteTopicClient({
    url: "ws://localhost/ws/transcriptions",
    noteId: NOTE_ID,
    onEvent,
    onCatchUp,
    onSubscriptionRejected,
  });

  return { client, onEvent, onCatchUp, onSubscriptionRejected };
}

describe("NoteTopicClient", () => {
  beforeEach(() => {
    stomp.configs.length = 0;
    stomp.instances.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("별도 STOMP 클라이언트로 구독을 먼저 연 뒤 REST catch-up을 요청한다", async () => {
    const { client, onCatchUp } = createClient();

    client.connect();

    expect(stomp.instances).toHaveLength(1);
    expect(stomp.instances[0].activate).toHaveBeenCalledOnce();

    const config = stomp.configs[0];
    await (config.onConnect as (frame?: unknown) => void | Promise<void>)();

    expect(stomp.instances[0].subscribe).toHaveBeenNthCalledWith(
      1,
      "/user/queue/note-subscriptions",
      expect.any(Function)
    );
    expect(stomp.instances[0].subscribe).toHaveBeenNthCalledWith(
      2,
      `/topic/notes/${NOTE_ID}`,
      expect.any(Function)
    );
    expect(
      stomp.instances[0].subscribe.mock.invocationCallOrder[1]
    ).toBeLessThan(onCatchUp.mock.invocationCallOrder[0]);
  });

  it("partial과 recording을 포함한 토픽 payload를 파싱해 직접 전달한다", async () => {
    const { client, onEvent } = createClient();
    client.connect();
    const config = stomp.configs[0];
    await (config.onConnect as (frame?: unknown) => void | Promise<void>)();
    const deliver = stomp.instances[0].subscribe.mock.calls[1][1] as (message: {
      body: string;
    }) => void;

    deliver({
      body: JSON.stringify({
        type: "transcript.partial",
        transcriptionSessionId: "01K0000000010",
        utteranceId: "01K0000000100",
        confirmedText: "결정을",
        pendingText: " 정리합니다",
      }),
    });
    deliver({
      body: JSON.stringify({
        type: "recording.started",
        transcriptionSessionId: "01K0000000010",
      }),
    });

    expect(onEvent).toHaveBeenNthCalledWith(1, {
      type: "transcript.partial",
      transcriptionSessionId: "01K0000000010",
      utteranceId: "01K0000000100",
      confirmedText: "결정을",
      pendingText: " 정리합니다",
    });
    expect(onEvent).toHaveBeenNthCalledWith(2, {
      type: "recording.started",
      transcriptionSessionId: "01K0000000010",
    });
  });

  it("지수 backoff로 재연결하고 연결될 때마다 catch-up한다", async () => {
    const { client, onCatchUp } = createClient();
    client.connect();
    const config = stomp.configs[0];
    const onConnect = config.onConnect as () => void | Promise<void>;

    expect(config.reconnectDelay).toEqual(expect.any(Number));
    expect(config.reconnectDelay).toBeGreaterThan(0);
    expect(Number(config.maxReconnectDelay)).toBeGreaterThan(
      Number(config.reconnectDelay)
    );
    expect(config.reconnectTimeMode).toBe(ReconnectionTimeMode.EXPONENTIAL);

    await onConnect();
    await onConnect();

    expect(onCatchUp).toHaveBeenCalledTimes(2);
    expect(stomp.instances[0].subscribe).toHaveBeenCalledTimes(4);
  });

  it("구독 중 60초마다 catch-up하고 연결 해제·재연결 때 타이머를 중복하지 않는다", async () => {
    const { client, onCatchUp } = createClient();
    client.connect();
    const config = stomp.configs[0];
    const onConnect = config.onConnect as () => void;

    onConnect();
    expect(onCatchUp).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(59_999);
    expect(onCatchUp).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(onCatchUp).toHaveBeenCalledTimes(2);

    stomp.instances[0].connected = false;
    (config.onWebSocketClose as () => void)();
    vi.advanceTimersByTime(120_000);
    expect(onCatchUp).toHaveBeenCalledTimes(2);

    stomp.instances[0].connected = true;
    onConnect();
    expect(onCatchUp).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(60_000);
    expect(onCatchUp).toHaveBeenCalledTimes(4);

    await client.close();
    vi.advanceTimersByTime(120_000);
    expect(onCatchUp).toHaveBeenCalledTimes(4);
  });

  it("구독 거절은 사용자 queue에서 읽고 해당 노트 토픽만 해제한 뒤 재시도할 수 있다", async () => {
    const { client, onCatchUp, onSubscriptionRejected } = createClient();
    client.connect();
    await (stomp.configs[0].onConnect as () => void)();
    const deliverFeedback = stomp.instances[0].subscribe.mock
      .calls[0][1] as (message: { body: string }) => void;

    deliverFeedback({
      body: JSON.stringify({
        type: "subscription.rejected",
        noteId: "01K0000000003",
        reason: "NOT_MEMBER",
      }),
    });
    expect(onSubscriptionRejected).not.toHaveBeenCalled();

    deliverFeedback({
      body: JSON.stringify({
        type: "subscription.rejected",
        noteId: NOTE_ID,
        reason: "TOO_MANY_SUBSCRIBERS",
      }),
    });
    expect(onSubscriptionRejected).toHaveBeenCalledWith({
      type: "subscription.rejected",
      noteId: NOTE_ID,
      reason: "TOO_MANY_SUBSCRIBERS",
    });
    expect(stomp.instances[0].unsubscribe).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(60_000);
    expect(onCatchUp).toHaveBeenCalledTimes(1);

    client.retrySubscription();
    expect(stomp.instances[0].subscribe).toHaveBeenCalledTimes(3);
    expect(onCatchUp).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(60_000);
    expect(onCatchUp).toHaveBeenCalledTimes(3);
  });

  it("close는 구독과 별도 연결을 중복 없이 정리한다", async () => {
    const { client } = createClient();
    client.connect();
    const config = stomp.configs[0];
    await (config.onConnect as () => void | Promise<void>)();

    await client.close();
    await client.close();

    expect(stomp.instances[0].unsubscribe).toHaveBeenCalledTimes(2);
    expect(stomp.instances[0].deactivate).toHaveBeenCalledOnce();
  });
});
