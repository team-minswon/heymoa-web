import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";


import {
  openSessionGate,
  resetSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";
import {
  getEventStream,
  postEventStream,
  type SseEvent,
} from "@/lib/api/sse";

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

describe("postEventStream", () => {
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
      postEventStream("/v1/notes/n1/chat/messages", { message: "hi" })
    );

    expect(events).toEqual([
      { event: "token", data: '{"t":1}', id: undefined },
      // 주석은 하트비트로 올라온다 — 유휴 타이머가 연결이 살아 있음을 아는 유일한 신호다.
      { event: "heartbeat", data: "{}" },
      { event: "message", data: "첫 줄\n둘째 줄", id: "7" },
    ]);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "/v1/notes/n1/chat/messages",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({ Accept: "text/event-stream" }),
        body: JSON.stringify({ message: "hi" }),
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
      postEventStream("/v1/agent-chats/c1/messages", { message: "hi" })
    );

    expect(events).toEqual([{ event: "message", data: "ok" }]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/v1/agent-chats/c1/messages",
      "/v1/auth/refresh",
      "/v1/agent-chats/c1/messages",
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
      collect(postEventStream("/v1/notes/n1/chat/messages", { message: "hi" }))
    ).rejects.toEqual(errorBody);
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

    for await (const event of postEventStream("/v1/agent-chats/c1/messages", {
      message: "hi",
    })) {
      expect(event).toEqual({ event: "message", data: "one" });
      break;
    }

    expect(cancelled).toBe(true);
  });
});

describe("postEventStream 세션 게이트", () => {
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

    const iterator = postEventStream("/v1/chat", {});
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
    const events = await collect(postEventStream("/v1/x", {}));
    expect(events).toEqual([
      { id: "42", event: "token", data: '{"delta":"안"}' },
    ]);
  });

  it("id: 는 프레임 단위로만 산다 — 다음 프레임이 물려받지 않는다", async () => {
    stub("id: 7\nevent: token\ndata: {}\n\nevent: token\ndata: {}\n\n");
    const events = await collect(postEventStream("/v1/x", {}));
    expect(events.map((e) => e.id)).toEqual(["7", undefined]);
  });

  it("재동기화 프레임도 id: 를 싣는다 — 그 번호가 바닥이다", async () => {
    stub("id: 900\nevent: stream_resync\ndata: {}\n\n");
    const [event] = await collect(postEventStream("/v1/x", {}));
    expect(event).toMatchObject({ id: "900", event: "stream_resync" });
  });

  it("하트비트 주석을 이벤트로 올리되 번호는 없다", async () => {
    stub(": heartbeat\n\nid: 7\nevent: token\ndata: {}\n\n");
    const events = await collect(postEventStream("/v1/x", {}));
    expect(events).toEqual([
      { event: "heartbeat", data: "{}" },
      { id: "7", event: "token", data: "{}" },
    ]);
  });

  it("getEventStream 은 GET 으로 열고 URL 의 after 를 그대로 쓴다", async () => {
    const fetchMock = stub("id: 5\nevent: token\ndata: {}\n\n");
    const events = await collect(getEventStream("/v1/agent-chats/c1/events?after=4"));
    expect(events).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("after=4");
    expect(init.method).toBe("GET");
    expect(init.headers.Accept).toBe("text/event-stream");
  });
});
