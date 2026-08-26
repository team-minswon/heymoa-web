import { ReconnectionTimeMode } from "@stomp/stompjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NoteTopicClient } from "@/lib/notes/note-topic-client";

const stomp = vi.hoisted(() => ({
  configs: [] as Array<Record<string, unknown>>,
  instances: [] as Array<{
    activate: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("@stomp/stompjs", () => {
  class Client {
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
  const client = new NoteTopicClient({
    url: "ws://localhost/ws/transcriptions",
    noteId: NOTE_ID,
    onEvent,
    onCatchUp,
  });

  return { client, onEvent, onCatchUp };
}

describe("NoteTopicClient", () => {
  beforeEach(() => {
    stomp.configs.length = 0;
    stomp.instances.length = 0;
  });

  it("별도 STOMP 클라이언트로 구독을 먼저 연 뒤 REST catch-up을 요청한다", async () => {
    const { client, onCatchUp } = createClient();

    client.connect();

    expect(stomp.instances).toHaveLength(1);
    expect(stomp.instances[0].activate).toHaveBeenCalledOnce();

    const config = stomp.configs[0];
    await (config.onConnect as (frame?: unknown) => void | Promise<void>)();

    expect(stomp.instances[0].subscribe).toHaveBeenCalledWith(
      `/topic/notes/${NOTE_ID}`,
      expect.any(Function)
    );
    expect(
      stomp.instances[0].subscribe.mock.invocationCallOrder[0]
    ).toBeLessThan(onCatchUp.mock.invocationCallOrder[0]);
  });

  it("partial과 recording을 포함한 토픽 payload를 파싱해 직접 전달한다", async () => {
    const { client, onEvent } = createClient();
    client.connect();
    const config = stomp.configs[0];
    await (config.onConnect as (frame?: unknown) => void | Promise<void>)();
    const deliver = stomp.instances[0].subscribe.mock.calls[0][1] as (message: {
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
    expect(stomp.instances[0].subscribe).toHaveBeenCalledTimes(2);
  });

  it("close는 구독과 별도 연결을 중복 없이 정리한다", async () => {
    const { client } = createClient();
    client.connect();
    const config = stomp.configs[0];
    await (config.onConnect as () => void | Promise<void>)();

    await client.close();
    await client.close();

    expect(stomp.instances[0].unsubscribe).toHaveBeenCalledOnce();
    expect(stomp.instances[0].deactivate).toHaveBeenCalledOnce();
  });
});
