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

/**
 * **여기서 재는 것은 순서와 내용이지 시간이 아니다.** 데모 속도(생각 0.7초 · 도구 1.6초)
 * 그대로 돌리면 스트림 하나가 몇 초씩 걸려 스위트가 타임아웃으로 죽는다.
 */
beforeAll(() => setStreamSpeedForTests(200));
afterAll(() => setStreamSpeedForTests(1));

/** Redis Stream entry id 꼴. 숫자가 아니라 **문자열**이고 크기 비교하지 않는다. */
const ENTRY_ID = /^\d+-\d+$/;

/**
 * 프레임을 읽는다. **`data:`는 payload 하나뿐이고 커서는 `id:` 줄에만 있다** —
 * 모든 프레임이 그 줄을 갖는다.
 */
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

/** `POST` 가 준 `202 {turnId}`. 프레임은 이 뒤 `GET …/turns/{turnId}/events` 로 온다. */
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

/** 보내고 그 턴의 스트림을 끝까지 읽는다. */
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

/**
 * 승인 한 흐름을 **한 스트림에서 두 번** 읽는다. 첫 연결은 `tool_approval_request`에서
 * 닫히고, 승인 `202` 뒤 그 카드의 id 를 `after` 에 넣어 다시 붙으면 나머지 절반이 온다.
 *
 * 승인 id를 바깥에서 추측하지 않는다 — 턴마다 달라지므로 스트림이 유일한 출처다.
 */
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

/** 조건이 참이 될 때까지. 턴이 응답과 무관하게 도는지를 보려면 기다릴 수밖에 없다. */
async function until(predicate: () => boolean, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("조건이 시간 안에 참이 되지 않았습니다");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * 스트림을 읽다가 원하는 이벤트가 보이면 멈춘다. 턴이 그 자리에 살아 있는 동안 다른
 * 요청을 걸어 보기 위한 것이다.
 *
 * **`reader.cancel()`을 await하지 않는다.** msw/node에서는 끝이 없는 스트림의 cancel이
 * 영영 resolve하지 않는다(브라우저에서는 아니다). 여기서 재는 것은 「연결을 끊었을 때
 * 턴이 어떻게 되나」이지 cancel의 반환값이 아니다.
 */
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
    // 목 DB는 리셋하면 같은 chatId를 다시 발급한다 — 스트림 상태도 같이 비워야 한다.
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

    // **한 턴이 지나는 길을 그대로 흘린다.** 생각 → 도구 → 답. `turn_started` 는 없다 —
    // turnId 는 202 본문이 줬다.
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
    // 「찾은 곳」 줄은 스트림이 끝날 때 이미 있어야 한다.
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

    // 끝나지 않는 스트림이라 본문을 읽지 않는다 — 읽으면 이 테스트가 안 끝난다.
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
    // 토큰이 몇 개 흐를 때까지 붙어 있다가 중지한다.
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
    // 끝까지 간 답이 아니다 — 흘린 만큼만이다.
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
    // 재개는 카드 **뒤**부터다 — 카드까지 다시 보내면 화면이 승인 대기로 되돌아간다.
    expect(second.map((event) => event.event)).not.toContain("tool_approval_request");
    // **`tool_call_start`가 없다** (계약). 결과는 승인 요청의 이름으로 귀속한다.
    expect(second.map((event) => event.event)).not.toContain("tool_call_start");
    expect(
      mockDb
        .getAgentChatMessages(chatId)
        .flatMap((m) => (m.toolEvent ? [m.toolEvent.tool] : []))
    ).toEqual(["linear.create_issue", "linear.create_issue"]);

    // 두 번 누르면 이미 처리된 것이라 404다.
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

/**
 * ★ 이 구조의 인수 조건. 목이 「턴 = 연결」인 채로 두면 e2e가 아무것도 증명하지 않는다.
 */
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
    // 종료 프레임 없이 끊긴다 — 화면은 이것을 재연결 신호로 읽는다.
    expect(first.map((event) => event.event)).not.toContain("message_end");

    // 그 사이 턴은 끝나고 스트림은 TTL 로 사라졌다.
    await until(() =>
      mockDb.getAgentChatMessages(chatId).some((message) => message.role === "ASSISTANT")
    );
    const response = await events(chatId, turnId, first.at(-1)!.id!);
    expect(response.status).toBe(410);
    expect((await response.json()).error.code).toBe("AGENT_CHAT_STREAM_GONE");
  });

  it("하트비트가 여는 순간 한 번이 아니라 계속 나온다", async () => {
    // 여는 순간 한 번뿐이면 web의 40초 유휴 타이머가 「연결이 죽었나」를 못 잰다.
    // **좀비로 잡아 둔다** — 승인 대기는 스트림을 끝내므로 붙잡아 주지 못한다.
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
    // 승인 대기로 첫 턴을 붙잡아 둔다.
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

    // 화면이 멈추는 신호는 204가 아니라 이 프레임이다.
    const resumed = await readEvents(await events(chatId, turnId));
    expect(resumed.at(-1)!.event).toBe("turn_cancelled");

    // 멱등. 답이 막 끝나는 순간의 중지는 경합이지 오류가 아니다.
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
