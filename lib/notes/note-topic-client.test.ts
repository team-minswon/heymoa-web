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

const auth = vi.hoisted(() => ({
  refreshAuthOnce: vi.fn(),
  openSessionGate: vi.fn(),
}));

vi.mock("@/lib/api/fetcher", () => ({
  refreshAuthOnce: auth.refreshAuthOnce,
  AuthRefreshError: class AuthRefreshError extends Error {
    constructor(readonly expired: boolean) {
      super("AUTH_REFRESH_FAILED");
    }
  },
}));
vi.mock("@/lib/auth/session-gate", () => ({
  openSessionGate: auth.openSessionGate,
}));

const NOTE_ID = "01K0000000002";

function createClient() {
  const onEvent = vi.fn();
  const onCatchUp = vi.fn();
  const onSubscriptionRejected = vi.fn();
  const onReconnectingChange = vi.fn();
  const client = new NoteTopicClient({
    url: "ws://localhost/ws/transcriptions",
    noteId: NOTE_ID,
    onEvent,
    onCatchUp,
    onSubscriptionRejected,
    onReconnectingChange,
  });

  return {
    client,
    onEvent,
    onCatchUp,
    onSubscriptionRejected,
    onReconnectingChange,
  };
}

describe("NoteTopicClient", () => {
  beforeEach(() => {
    stomp.configs.length = 0;
    stomp.instances.length = 0;
    auth.refreshAuthOnce.mockReset().mockResolvedValue(undefined);
    auth.openSessionGate.mockReset();
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

  it("통신 실패한 소켓은 닫힘을 기다리지 않고 버린다", () => {
    createClient().client.connect();
    expect(stomp.configs[0].discardWebsocketOnCommFailure).toBe(true);
  });

  /**
   * ★ 만료 토큰(30분)이면 핸드셰이크가 매번 거절되는데 stompjs 는 조용히 무한 재시도한다.
   * 붙어 있다가 끊긴 것(배포 드레인)은 토큰 탓이 아니라 갱신하지 않는다.
   */
  describe("다음 시도 전 토큰 갱신", () => {
    type Hooks = {
      beforeConnect: () => Promise<void>;
      onConnect: () => void;
      onWebSocketClose: () => void;
    };
    const hooks = () => stomp.configs[0] as unknown as Hooks;

    it("★ 직전 시도가 못 붙었을 때만 갱신한다", async () => {
      createClient().client.connect();
      const { beforeConnect, onConnect, onWebSocketClose } = hooks();

      await beforeConnect();
      expect(auth.refreshAuthOnce).not.toHaveBeenCalled();

      onWebSocketClose();
      await beforeConnect();
      expect(auth.refreshAuthOnce).toHaveBeenCalledOnce();

      onConnect();
      onWebSocketClose();
      await beforeConnect();
      expect(auth.refreshAuthOnce).toHaveBeenCalledOnce();
    });

    it("★ 갱신이 던져도 삼키고 재연결을 계속한다", async () => {
      auth.refreshAuthOnce.mockRejectedValue(new Error("NETWORK"));
      createClient().client.connect();
      const { beforeConnect, onWebSocketClose } = hooks();

      await beforeConnect();
      onWebSocketClose();
      await expect(beforeConnect()).resolves.toBeUndefined();
      expect(auth.openSessionGate).not.toHaveBeenCalled();
    });

    it("★ 갱신이 끝나지 않아도 10초 뒤에는 연결을 이어 간다", async () => {
      auth.refreshAuthOnce.mockReturnValue(new Promise(() => undefined));
      createClient().client.connect();
      const { beforeConnect, onWebSocketClose } = hooks();

      await beforeConnect();
      onWebSocketClose();
      let settled = false;
      void beforeConnect().then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(9_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toBe(true);
    });

    it("갱신 토큰까지 죽었으면 세션 게이트를 연다", async () => {
      const { AuthRefreshError } = await import("@/lib/api/fetcher");
      auth.refreshAuthOnce.mockRejectedValue(new AuthRefreshError(true));
      createClient().client.connect();
      const { beforeConnect, onWebSocketClose } = hooks();

      await beforeConnect();
      onWebSocketClose();
      await expect(beforeConnect()).resolves.toBeUndefined();
      expect(auth.openSessionGate).toHaveBeenCalledOnce();
    });
  });

  describe("30초 넘게 못 붙으면 알린다", () => {
    it("★ 첫 연결이 30초 안에 안 붙으면 「다시 연결하는 중」이다", () => {
      const { client, onReconnectingChange } = createClient();
      client.connect();

      vi.advanceTimersByTime(29_999);
      expect(onReconnectingChange).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onReconnectingChange).toHaveBeenLastCalledWith(true);

      (stomp.configs[0].onConnect as () => void)();
      expect(onReconnectingChange).toHaveBeenLastCalledWith(false);
    });

    it("★ 붙어 있다 끊기면 끊긴 순간부터 30초를 센다 — 시도마다 다시 세지 않는다", () => {
      const { client, onReconnectingChange } = createClient();
      client.connect();
      const config = stomp.configs[0];
      (config.onConnect as () => void)();

      (config.onWebSocketClose as () => void)();
      vi.advanceTimersByTime(20_000);
      (config.onWebSocketClose as () => void)();
      vi.advanceTimersByTime(9_999);
      expect(onReconnectingChange).not.toHaveBeenCalledWith(true);
      vi.advanceTimersByTime(1);
      expect(onReconnectingChange).toHaveBeenLastCalledWith(true);
    });

    it("30초 안에 다시 붙으면 알리지 않는다", () => {
      const { client, onReconnectingChange } = createClient();
      client.connect();
      const config = stomp.configs[0];
      (config.onConnect as () => void)();
      (config.onWebSocketClose as () => void)();
      vi.advanceTimersByTime(10_000);
      (config.onConnect as () => void)();
      vi.advanceTimersByTime(60_000);
      expect(onReconnectingChange).not.toHaveBeenCalledWith(true);
    });

    it("닫으면 세던 것을 버린다", async () => {
      const { client, onReconnectingChange } = createClient();
      client.connect();
      await client.close();
      vi.advanceTimersByTime(60_000);
      expect(onReconnectingChange).not.toHaveBeenCalled();
    });
  });
});
