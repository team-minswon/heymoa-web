import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";


import {
  openSessionGate,
  resetSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";
import { getEventStream, type SseEvent } from "@/lib/api/sse";

const encoder = new TextEncoder();

function sseResponse(chunks: string[]) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function collect(iterable: AsyncIterable<SseEvent>) {
  const events: SseEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getEventStream", () => {
  it("chunk 경계·멀티라인 data·주석·CRLF를 처리해 이벤트를 순회한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          "event: token\nda",
          'ta: {"t":1}\n\n:keepalive\r\n',
          "id: 7\ndata: 첫 줄\ndata: 둘째 줄\r\n\r\n",
          "data: 미완성 프레임은 버린다",
        ])
      );
    vi.stubGlobal("fetch", fetchMock);

    const events = await collect(
      getEventStream("/v1/agent-chats/c1/turns/t1/events")
    );

    expect(events).toEqual([
      { event: "token", data: '{"t":1}', id: undefined },
      // 주석은 하트비트로 올라온다 — 유휴 타이머가 연결이 살아 있음을 아는 유일한 신호다.
      { event: "heartbeat", data: "{}" },
      { event: "message", data: "첫 줄\n둘째 줄", id: "7" },
    ]);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "/v1/agent-chats/c1/turns/t1/events",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        headers: expect.objectContaining({ Accept: "text/event-stream" }),
      })
    );
  });

  it("401이면 refresh 후 한 번 재시도한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(sseResponse(["data: ok\n\n"]));
    vi.stubGlobal("fetch", fetchMock);

    const events = await collect(
      getEventStream("/v1/agent-chats/c1/turns/t1/events")
    );

    expect(events).toEqual([{ event: "message", data: "ok" }]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/v1/agent-chats/c1/turns/t1/events",
      "/v1/auth/refresh",
      "/v1/agent-chats/c1/turns/t1/events",
    ]);
  });

  it("스트림이 아닌 에러 응답은 JSON body를 그대로 던진다", async () => {
    const errorBody = {
      success: false,
      data: null,
      error: { code: "CHAT_LOCKED", message: "다른 멤버가 입력 중입니다." },
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(errorBody), { status: 409 })
        )
    );

    await expect(
      collect(getEventStream("/v1/agent-chats/c1/turns/t1/events"))
    ).rejects.toEqual(errorBody);
  });

  /**
   * ★ **410 은 「턴은 끝났고 스트림은 사라졌다」다.** 훅이 재연결 대신 히스토리를 다시
   * 읽어야 하므로, 서버 문구는 남기되 코드는 한 값으로 접어 준다.
   */
  it("410 은 SSE_STREAM_GONE 코드로 던지고 서버 문구를 남긴다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            data: null,
            error: { code: "AGENT_CHAT_STREAM_GONE", message: "스트림이 사라졌습니다." },
          }),
          { status: 410 }
        )
      )
    );

    await expect(
      collect(getEventStream("/v1/agent-chats/c1/turns/t1/events"))
    ).rejects.toMatchObject({
      error: { code: "SSE_STREAM_GONE", message: "스트림이 사라졌습니다." },
    });
  });

  it("410 에 JSON 봉투가 없어도 같은 코드다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("gone", { status: 410 }))
    );

    await expect(
      collect(getEventStream("/v1/agent-chats/c1/turns/t1/events"))
    ).rejects.toMatchObject({ error: { code: "SSE_STREAM_GONE" } });
  });

  it("소비자가 중간에 끊으면 스트림을 취소한다", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("data: one\n\n"));
      },
      cancel() {
        cancelled = true;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(stream, { status: 200 }))
    );

    for await (const event of getEventStream(
      "/v1/agent-chats/c1/turns/t1/events"
    )) {
      expect(event).toEqual({ event: "message", data: "one" });
      break;
    }

    expect(cancelled).toBe(true);
  });
});

describe("getEventStream 세션 게이트", () => {
  beforeEach(() => {
    resetSessionGate();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("게이트가 열려 있으면 네트워크를 타지 않는다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    openSessionGate();

    const iterator = getEventStream("/v1/chat");
    await expect(iterator.next()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("id: 줄이 커서다", () => {
  beforeEach(() => resetSessionGate());

  function stub(...chunks: string[]) {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(chunks));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("id: 줄을 프레임에 싣는다", async () => {
    stub('id: 42\nevent: token\ndata: {"delta":"안"}\n\n');
    const events = await collect(getEventStream("/v1/x"));
    expect(events).toEqual([
      { id: "42", event: "token", data: '{"delta":"안"}' },
    ]);
  });

  it("id: 는 프레임 단위로만 산다 — 다음 프레임이 물려받지 않는다", async () => {
    stub("id: 7\nevent: token\ndata: {}\n\nevent: token\ndata: {}\n\n");
    const events = await collect(getEventStream("/v1/x"));
    expect(events.map((e) => e.id)).toEqual(["7", undefined]);
  });

  it("id: 는 문자열 그대로다 — 숫자로 바꾸지 않는다", async () => {
    stub("id: 1735689600000-0\nevent: token\ndata: {}\n\n");
    const [event] = await collect(getEventStream("/v1/x"));
    expect(event).toMatchObject({ id: "1735689600000-0", event: "token" });
  });

  it("하트비트 주석을 이벤트로 올리되 번호는 없다", async () => {
    stub(": heartbeat\n\nid: 7\nevent: token\ndata: {}\n\n");
    const events = await collect(getEventStream("/v1/x"));
    expect(events).toEqual([
      { event: "heartbeat", data: "{}" },
      { id: "7", event: "token", data: "{}" },
    ]);
  });

  it("getEventStream 은 GET 으로 열고 URL 의 after 를 그대로 쓴다", async () => {
    const fetchMock = stub("id: 5\nevent: token\ndata: {}\n\n");
    const events = await collect(
      getEventStream("/v1/agent-chats/c1/turns/t1/events?after=4-0")
    );
    expect(events).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("after=4-0");
    expect(init.method).toBe("GET");
    expect(init.headers.Accept).toBe("text/event-stream");
  });
});
