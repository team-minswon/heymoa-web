import { afterEach, describe, expect, it, vi } from "vitest";

import { postEventStream, type SseEvent } from "@/lib/api/sse";

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
    const fetchMock = vi.fn().mockResolvedValue(
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
      { event: "token", data: '{"t":1}' },
      { event: "message", data: "첫 줄\n둘째 줄" },
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
      vi.fn().mockResolvedValue(
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
