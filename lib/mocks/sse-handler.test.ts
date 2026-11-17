import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";

import { mockDb } from "@/lib/mocks/db";
import {
  chatSseHandlers,
  resetChatStreamsForTests,
  setStreamSpeedForTests,
} from "@/lib/mocks/sse-handler";
import { restHandlers } from "@/lib/mocks/rest-handlers";

const server = setupServer(...restHandlers, ...chatSseHandlers);

beforeAll(() => setStreamSpeedForTests(200));
afterAll(() => setStreamSpeedForTests(1));

const ENTRY_ID = /^\d+-\d+$/;

function readEventsFromText(text: string) {
  return text
    .split("\n\n")
    .filter((block) => block.includes("event:"))
    .map((block) => {
      const lines = block.split("\n");
      const idLine = lines.find((line) => line.startsWith("id:"));
      const eventLine = lines.find((line) => line.startsWith("event:"))!;
      const dataLine = lines.find((line) => line.startsWith("data:"))!;
      return {
        event: eventLine.slice("event:".length).trim(),
        id: idLine === undefined ? null : idLine.slice("id:".length).trim(),
        data: JSON.parse(dataLine.slice("data:".length).trim()) as Record<
          string,
          string | undefined
        >,
      };
    });
}

async function readEvents(response: Response) {
  return readEventsFromText(await response.text());
}

function base(chatId: string) {
  return `http://localhost/v1/agent-chats/${chatId}`;
}

function newChat() {
  return mockDb.createAgentChat({ workspaceId: "01K0000000000" }).chatId;
}

function send(chatId: string, message: string) {
  return fetch(`${base(chatId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

async function sendAndAccept(chatId: string, message: string) {
  const response = await send(chatId, message);
  expect(response.status).toBe(202);
  const body = await response.json();
  expect(body.success).toBe(true);
  return body.data.turnId as string;
}

function events(chatId: string, turnId: string, after?: string) {
  const url = `${base(chatId)}/turns/${turnId}/events`;
  return fetch(after === undefined ? url : `${url}?after=${after}`);
}

async function sendAndRead(chatId: string, message: string) {
  const turnId = await sendAndAccept(chatId, message);
  return { turnId, events: await readEvents(await events(chatId, turnId)) };
}

function resolve(chatId: string, approvalId: string, decision: string) {
  return fetch(`${base(chatId)}/approvals/${approvalId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}

async function streamAndDecide(
  chatId: string,
  message: string,
  decision: "APPROVED" | "REJECTED"
) {
  const { turnId, events: first } = await sendAndRead(chatId, message);
  const request = first.find(
    (event) => event.event === "tool_approval_request"
  )!;
  const accepted = await resolve(chatId, String(request.data.approvalId), decision);
  expect(accepted.status).toBe(202);
  const second = await readEvents(await events(chatId, turnId, request.id!));
  return { turnId, first, second, events: [...first, ...second] };
}

async function until(predicate: () => boolean, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("조건이 시간 안에 참이 되지 않았습니다");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** `reader.cancel()` 을 await 하지 않습니다. msw/node 에서는 끝없는 스트림의 cancel 이 resolve 되지 않습니다. */
async function readUntil(response: Response, event: string) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (!text.includes(`event: ${event}`)) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return { text, drop: () => void reader.cancel() };
}

function setup() {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
    resetChatStreamsForTests();
  });
  afterAll(() => server.close());
}

describe("chat SSE handlers", () => {
  setup();

  it("POST 는 202 {turnId} 로 끝나고 프레임은 턴 스트림으로 온다", async () => {
    const chatId = newChat();
    const turnId = await sendAndAccept(chatId, "요약해줘");

    const response = await events(chatId, turnId);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const names = (await readEvents(response)).map((event) => event.event);

    expect(names.filter((name) => name !== "token")).toEqual([
      "message_start",
      "thinking_delta",
      "thinking_delta",
      "tool_call_start",
      "tool_call_result",
      "thinking_delta",
      "message_end",
    ]);
  });

  it("★ 커서는 id: 줄에만 있고 문자열이며 data 는 payload 하나뿐이다", async () => {
    const { events: frames } = await sendAndRead(newChat(), "요약해줘");

    for (const event of frames) {
      expect(event.id).toMatch(ENTRY_ID);
      expect(event.data).not.toHaveProperty("payload");
      expect(event.data).not.toHaveProperty("seq");
    }
    expect(new Set(frames.map((event) => event.id)).size).toBe(frames.length);
    expect(frames.find((event) => event.event === "token")!.data.delta).toBeTruthy();
    expect((frames.at(-1)!.data as { refs?: unknown[] }).refs).toHaveLength(1);
  });

  it("closes without a terminal event when the stream is dropped", async () => {
    const { events: frames } = await sendAndRead(newChat(), "연결을 끊어줘");

    expect(frames.map((event) => event.event)).not.toContain("message_end");
    expect(frames.map((event) => event.event)).not.toContain("error");
  });

  it("용량이면 error 없이 turn_failed로 굳고 재시도 가능으로 남는다", async () => {
    const chatId = newChat();
    const { events: frames } = await sendAndRead(chatId, "용량");

    expect(frames.map((event) => event.event)).not.toContain("error");
    expect(frames.at(-1)!.event).toBe("turn_failed");
    expect(frames.at(-1)!.data.code).toBe("CAPACITY_EXCEEDED");

    const state = await (await fetch(`${base(chatId)}/messages`)).json();
    expect(state.data.activeTurn).toBeNull();
    expect(state.data.lastTurn).toMatchObject({
      status: "FAILED",
      failureCode: "CAPACITY_EXCEEDED",
      retryable: true,
    });
  });

  it("좀비는 턴만 세우고 프레임을 하나도 안 낸다 — 스트림은 열린 채 기다린다", async () => {
    const chatId = newChat();
    const turnId = await sendAndAccept(chatId, "좀비");
    const state = await (await fetch(`${base(chatId)}/messages`)).json();

    expect(state.data.activeTurn.status).toBe("IN_PROGRESS");
    expect(state.data.cursor).toBeNull();

    const response = await events(chatId, turnId);
    expect(response.status).toBe(200);
    void response.body!.cancel();
  });

  it("범위 밖까지 넓힌 답은 그 회의록을 근거 줄에 싣는다", async () => {
    const { events: frames } = await sendAndRead(newChat(), "범위 밖인가");
    const refs = (
      frames.at(-1)!.data as unknown as { refs: { id: string; title: string }[] }
    ).refs;

    expect(refs.map((ref) => ref.title)).toContain("결제 개편 킥오프");
  });
});

describe("stream is teed into history", () => {
  setup();

  it("records the user message and the finished answer", async () => {
    const chatId = newChat();
    await sendAndRead(chatId, "요약해줘");

    const messages = mockDb.getAgentChatMessages(chatId);
    expect(messages.map((message) => message.role)).toEqual([
      "USER",
      "THINKING",
      "THINKING",
      "TOOL",
      "THINKING",
      "ASSISTANT",
    ]);
    expect(messages[0].content).toBe("요약해줘");
  });

  it("records the tool run between the question and the answer", async () => {
    const chatId = newChat();
    await streamAndDecide(chatId, "Linear 이슈 만들어줘", "APPROVED");

    const messages = mockDb.getAgentChatMessages(chatId);
    expect(messages.map((message) => message.role)).toEqual([
      "USER",
      "THINKING",
      "THINKING",
      "TOOL",
      "TOOL",
      "ASSISTANT",
    ]);
    expect(messages[3].toolEvent).toMatchObject({ decision: "APPROVED", status: null });
    expect(messages[4].toolEvent).toMatchObject({ decision: null, status: "success" });
  });

  it("does not record an answer when the stream fails", async () => {
    const chatId = newChat();
    await sendAndRead(chatId, "장애를 재현해줘");

    expect(mockDb.getAgentChatMessages(chatId).map((message) => message.role)).toEqual([
      "USER",
    ]);
  });

  it("★ 중지는 부분 답을 저장한다 — 끊긴 문장이 히스토리에 남는다", async () => {
    const chatId = newChat();
    const turnId = await sendAndAccept(chatId, "요약해줘");
    const { text, drop } = await readUntil(await events(chatId, turnId), "token");
    drop();
    const flowed = readEventsFromText(text).filter((event) => event.event === "token");
    expect(flowed.length).toBeGreaterThan(0);

    await fetch(`${base(chatId)}/turns/${turnId}/cancel`, { method: "POST" });

    const answer = mockDb
      .getAgentChatMessages(chatId)
      .find((message) => message.role === "ASSISTANT");
    expect(answer?.turnId).toBe(turnId);
    expect(answer?.content.length).toBeGreaterThan(0);
    const full = await (
      await fetch(`${base(chatId)}/messages`)
    ).json();
    expect(full.data.lastTurn.status).toBe("CANCELLED");
  });
});

describe("agent chat guards", () => {
  setup();

  it("returns 404 for an unknown chat", async () => {
    const response = await send("01K9999999999", "요약해줘");
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("AGENT_CHAT_NOT_FOUND");
  });

  it("없는 턴의 스트림은 404 다", async () => {
    const chatId = newChat();
    const response = await events(chatId, "turn-없음");
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("AGENT_CHAT_TURN_NOT_FOUND");
  });

  it("남의 대화의 턴도 404 다", async () => {
    const a = newChat();
    const b = newChat();
    const turnId = await sendAndAccept(a, "요약해줘");
    expect((await events(b, turnId)).status).toBe(404);
  });
});

describe("write tool approval actually pauses the stream", () => {
  setup();

  const WRITE_MESSAGE = "Linear 이슈 만들어줘";

  it("runs the tool and finishes when approved", async () => {
    const names = (
      await streamAndDecide(newChat(), WRITE_MESSAGE, "APPROVED")
    ).events.map((event) => event.event);

    expect(names).toContain("tool_call_result");
    expect(names.at(-1)).toBe("message_end");
  });

  it("skips the tool and still ends cleanly when rejected", async () => {
    const { events: frames } = await streamAndDecide(newChat(), WRITE_MESSAGE, "REJECTED");

    const names = frames.map((event) => event.event);
    expect(names).not.toContain("tool_call_result");
    expect(names.at(-1)).toBe("message_end");
    expect(
      frames.find((event) => event.event === "tool_approval_resolved")!.data.decision
    ).toBe("REJECTED");
  });

  it("★ 스트림은 승인 요청에서 닫히고, 202 뒤 카드의 id 를 after 로 다시 붙으면 나머지가 온다", async () => {
    const chatId = newChat();
    const { first, second } = await streamAndDecide(chatId, WRITE_MESSAGE, "APPROVED");

    expect(first.at(-1)!.event).toBe("tool_approval_request");
    expect(second[0].event).toBe("tool_approval_resolved");
    expect(second.map((event) => event.event)).not.toContain("tool_approval_request");
    expect(second.map((event) => event.event)).not.toContain("tool_call_start");
    expect(
      mockDb
        .getAgentChatMessages(chatId)
        .flatMap((m) => (m.toolEvent ? [m.toolEvent.tool] : []))
    ).toEqual(["linear.create_issue", "linear.create_issue"]);

    const approvalId = String(first.at(-1)!.data.approvalId);
    expect((await resolve(chatId, approvalId, "APPROVED")).status).toBe(404);
  });

  it("★ GET /messages 의 cursor 는 승인 카드의 id 다", async () => {
    const chatId = newChat();
    const { events: frames } = await sendAndRead(chatId, WRITE_MESSAGE);
    const request = frames.at(-1)!;

    const { data } = await (await fetch(`${base(chatId)}/messages`)).json();
    expect(data.cursor).toBe(request.id);
    expect(data.activeTurn.status).toBe("WAITING_APPROVAL");
    expect(data.activeTurn.pendingApproval.approvalId).toBe(request.data.approvalId);
    expect(data.activeTurn.pendingApproval.card).toMatchObject({
      title: "Linear 이슈 만들기",
      warning: null,
      items: null,
      body: null,
    });
    expect(data.activeTurn.pendingApproval.card.fields[0]).toEqual({
      label: "제목",
      value: "APP 버그 수정",
      before: null,
      after: null,
      added: null,
      removed: null,
      kept: null,
    });
    expect(data.lastTurn.turnId).toBe(data.activeTurn.turnId);
    expect(data.messages[0].turnId).toBe(data.activeTurn.turnId);
  });

  it("★ 중지한 턴의 승인 카드는 404다", async () => {
    const chatId = newChat();
    const { turnId, events: frames } = await sendAndRead(chatId, WRITE_MESSAGE);
    const request = frames.at(-1)!;

    await fetch(`${base(chatId)}/turns/${turnId}/cancel`, { method: "POST" });

    const response = await resolve(chatId, String(request.data.approvalId), "APPROVED");
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("APPROVAL_NOT_FOUND");
  });

  it("returns 404 for an approval nobody is waiting on", async () => {
    const response = await resolve("01K0000000030", "01K9999999999", "APPROVED");
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("APPROVAL_NOT_FOUND");
  });
});

describe("input validation matches the contract", () => {
  setup();

  it("빈 메시지는 턴을 열지 않고 400이다", async () => {
    const chatId = newChat();
    const response = await send(chatId, "   ");

    expect(response.status).toBe(400);
    expect(mockDb.getAgentChatMessages(chatId)).toHaveLength(0);
  });
});

describe("턴은 연결이 아니다", () => {
  setup();

  it("★ 스트림을 안 열어도 턴은 돌고 히스토리에 남는다", async () => {
    const chatId = newChat();
    await sendAndAccept(chatId, "요약해줘");

    await until(() =>
      mockDb
        .getAgentChatMessages(chatId)
        .some((message) => message.role === "ASSISTANT")
    );
    expect(mockDb.getAgentChatMessages(chatId).map((message) => message.role)).toEqual(
      ["USER", "THINKING", "THINKING", "TOOL", "THINKING", "ASSISTANT"]
    );
  });

  it("★ 끊긴 뒤 after 로 다시 붙으면 그 뒤만 온다 — 크기 비교가 아니라 자리다", async () => {
    const chatId = newChat();
    const { turnId, events: first } = await sendAndRead(chatId, "요약해줘");
    const middle = first[Math.floor(first.length / 2)];

    const resumed = await readEvents(await events(chatId, turnId, middle.id!));

    expect(resumed.map((event) => event.id)).toEqual(
      first.slice(first.indexOf(middle) + 1).map((event) => event.id)
    );
    expect(resumed.at(-1)!.event).toBe("message_end");
  });

  it("after 없이 붙으면 처음부터 다시 준다", async () => {
    const chatId = newChat();
    const { turnId, events: first } = await sendAndRead(chatId, "요약해줘");
    const again = await readEvents(await events(chatId, turnId));
    expect(again).toEqual(first);
  });

  it("★ 「밀리게 해줘」 — 첫 구독이 끊기고 재접속은 410 이다", async () => {
    const chatId = newChat();
    const turnId = await sendAndAccept(chatId, "요약해줘, 밀리게 해줘");
    const first = await readEvents(await events(chatId, turnId));
    expect(first.map((event) => event.event)).not.toContain("message_end");

    await until(() =>
      mockDb.getAgentChatMessages(chatId).some((message) => message.role === "ASSISTANT")
    );
    const response = await events(chatId, turnId, first.at(-1)!.id!);
    expect(response.status).toBe(410);
    expect((await response.json()).error.code).toBe("AGENT_CHAT_STREAM_GONE");
  });

  it("하트비트가 여는 순간 한 번이 아니라 계속 나온다", async () => {
    const chatId = newChat();
    const turnId = await sendAndAccept(chatId, "좀비");
    const response = await events(chatId, turnId);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (text.split(": keepalive").length - 1 < 2) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }

    expect(text.split(": keepalive").length - 1).toBeGreaterThan(1);
    void reader.cancel();
  });
});

describe("턴은 대화당 하나다", () => {
  setup();

  it("★ 도는 중에 겹쳐 보내면 409이고 본문에 turnId가 있다", async () => {
    const chatId = newChat();
    const { turnId } = await sendAndRead(chatId, "Linear 이슈 만들어줘");

    const conflict = await send(chatId, "한 번 더");

    expect(conflict.status).toBe(409);
    const body = await conflict.json();
    expect(body.error.code).toBe("AGENT_CHAT_TURN_IN_PROGRESS");
    expect(body.error.details[0]).toEqual({ field: "turnId", message: turnId });
  });

  it("★ 취소는 turn_cancelled를 흘리고 204다 — 이미 끝난 턴에도 204", async () => {
    const chatId = newChat();
    const { turnId } = await sendAndRead(chatId, "Linear 이슈 만들어줘");

    const cancelled = await fetch(`${base(chatId)}/turns/${turnId}/cancel`, {
      method: "POST",
    });
    expect(cancelled.status).toBe(204);

    const resumed = await readEvents(await events(chatId, turnId));
    expect(resumed.at(-1)!.event).toBe("turn_cancelled");

    expect(
      (await fetch(`${base(chatId)}/turns/${turnId}/cancel`, { method: "POST" })).status
    ).toBe(204);
  });

  it("턴이 끝나면 activeTurn이 비고 lastTurn만 남는다", async () => {
    const chatId = newChat();
    await sendAndRead(chatId, "요약해줘");

    const { data } = await (await fetch(`${base(chatId)}/messages`)).json();
    expect(data.activeTurn).toBeNull();
    expect(data.cursor).toBeNull();
    expect(data.lastTurn.status).toBe("COMPLETED");
  });

  it("앞 턴이 끝나면 같은 질문도 새 턴을 연다", async () => {
    const chatId = newChat();
    await sendAndRead(chatId, "요약해줘");
    await sendAndRead(chatId, "요약해줘");

    const roles = mockDb.getAgentChatMessages(chatId).map((m) => m.role);
    expect(roles.filter((role) => role === "USER")).toHaveLength(2);
  });
});
