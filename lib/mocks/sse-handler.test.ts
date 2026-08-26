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

/**
 * 프레임을 읽는다. **`data:`는 payload 하나뿐이고 `seq`는 `id:` 줄에만 있다** —
 * **모든 프레임이 그 줄을 갖는다** — 좌표 없는 것은 이 선에 안 흐른다.
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
        seq: idLine === undefined ? null : Number(idLine.slice("id:".length).trim()),
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

/**
 * 공유 챗은 회의가 ACTIVE일 때만 열린다 — 계약의 ACTIVE는 IN_PROGRESS + 시작자 존재다.
 * 새로 만든 노트는 아직 아무도 녹음을 시작하지 않아 그 조건을 못 넘는다.
 */

/**
 * 승인 한 흐름을 **두 스트림으로** 읽는다. 1차는 `tool_approval_request`에서 스스로
 * 끝나고, 승인 API의 응답 본문이 2차다 — 이어 붙인 것이 한 턴의 전부다.
 *
 * 승인 id를 바깥에서 추측하지 않는다 — 턴마다 달라지므로 스트림이 유일한 출처다.
 */
async function streamAndDecide(
  url: string,
  message: string,
  decision: "APPROVED" | "REJECTED",
  chatPath = url.replace(/\/messages$/, "")
) {
  const first = await readEvents(await send(url, message));
  const request = first.find(
    (event) => event.event === "tool_approval_request"
  )!;
  const second = await readEvents(
    await resolve(chatPath, String(request.data.approvalId), decision)
  );
  return [...first, ...second];
}

function resolve(chatPath: string, approvalId: string, decision: string) {
  return fetch(`${chatPath}/approvals/${approvalId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}

function send(url: string, message: string) {
  return fetch(url, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
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

describe("chat SSE handlers", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
    // 목 DB는 리셋하면 같은 chatId를 다시 발급한다 — 스트림 상태도 같이 비워야 한다.
    resetChatStreamsForTests();
  });
  afterAll(() => server.close());

  /** 없는 채팅은 404이므로 스트림 테스트는 실제 세션을 만들어 쓴다. */
  function personalChatUrl() {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });
    return `http://localhost/v1/agent-chats/${chat.chatId}/messages`;
  }

  it("streams event frames with the SSE content type", async () => {
    const response = await send(personalChatUrl(), "요약해줘");

    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const events = await readEvents(response);
    const names = events.map((event) => event.event);

    // **한 턴이 지나는 길을 그대로 흘린다.** 생각 → 도구 → 답. 진행 표시가 붙었는지
    // 확인하려면 목이 그 이벤트를 실제로 내야 한다 — 예전에는 token 밖에 안 냈다.
    expect(names.filter((name) => name !== "token")).toEqual([
      // turn_started가 릴레이보다 먼저 나간다 — 사실상 이 턴의 첫 프레임이다.
      "turn_started",
      "message_start",
      "thinking_delta",
      "thinking_delta",
      "tool_call_start",
      "tool_call_result",
      "thinking_delta",
      "message_end",
    ]);
    // 「찾은 곳」 줄은 스트림이 끝날 때 이미 있어야 한다. 히스토리로 넘어간 뒤에야
    // 뜨면 답이 끝나는 순간 없던 줄이 끼어든 것처럼 보인다.
    expect((events.at(-1)!.data as { refs?: unknown[] }).refs).toHaveLength(1);
  });

  it("★ seq는 id: 줄에만 있고 data는 payload 하나뿐이다", async () => {
    const events = await readEvents(await send(personalChatUrl(), "요약해줘"));

    // 봉투를 씌우면 목만 통과하고 실서버에서는 커서가 한 번도 안 움직인다.
    for (const event of events) {
      expect(event.seq).toEqual(expect.any(Number));
      expect(event.data).not.toHaveProperty("payload");
      expect(event.data).not.toHaveProperty("seq");
    }
    // `turnId`의 출처는 `turn_started`의 payload 하나다.
    expect(events[0].event).toBe("turn_started");
    expect(events[0].data.turnId).toBeTruthy();
    expect(events.find((event) => event.event === "token")!.data.delta).toBeTruthy();
  });

  it("★ 턴을 시작할 때 seq에 구멍을 낸다", async () => {
    const url = personalChatUrl();
    const first = await readEvents(await send(url, "요약해줘"));
    const second = await readEvents(await send(url, "한 번 더 요약해줘"));

    const lastOfFirst = first.at(-1)!.seq!;
    const firstOfSecond = second[0].seq!;
    // 실제 서버가 블록으로 발급하므로 40 → 1001이 정상이다. 목이 구멍을 안 내면
    // web이 「구멍 = 유실」로 읽는 결함이 안 드러난다.
    expect(firstOfSecond).toBeGreaterThan(lastOfFirst + 1);
    // 그래도 대화 안에서는 단조 증가다 — 턴이 바뀌어도 되감기지 않는다.
    expect(second.map((event) => event.seq)).toEqual(
      [...second].map((event) => event.seq).sort((a, b) => a! - b!)
    );
  });

  it("closes without a terminal event when the stream is dropped", async () => {
    const response = await send(personalChatUrl(), "연결을 끊어줘");
    const events = await readEvents(response);

    expect(events.map((event) => event.event)).not.toContain("message_end");
    expect(events.map((event) => event.event)).not.toContain("error");
  });

  it("용량이면 error 없이 turn_failed로 굳고 재시도 가능으로 남는다", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });
    const url = `http://localhost/v1/agent-chats/${chat.chatId}`;

    const events = await readEvents(await send(`${url}/messages`, "용량"));

    expect(events.map((event) => event.event)).not.toContain("error");
    expect(events.at(-1)!.event).toBe("turn_failed");
    expect(events.at(-1)!.data.code).toBe("CAPACITY_EXCEEDED");

    const state = await (await fetch(`${url}/messages`)).json();
    // 굳혀야 다음 전송이 열린다. `retryable`은 **코드에서 파생한다** — 컬럼이 아니다.
    expect(state.data.activeTurn).toBeNull();
    expect(state.data.lastTurn).toMatchObject({
      status: "FAILED",
      failureCode: "CAPACITY_EXCEEDED",
      retryable: true,
    });
  });

  /**
   * 좀비 턴 — 턴만 서고 이벤트가 하나도 안 온다. 굳혀 주는 워치독이 없으면 화면이
   * 영원히 스피너인 그 자리를 목에서 직접 볼 수 있어야 한다.
   */
  it("좀비는 턴만 세우고 프레임을 하나도 안 낸다", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });
    const url = `http://localhost/v1/agent-chats/${chat.chatId}`;

    // 끝나지 않는 스트림이라 본문을 읽지 않는다 — 읽으면 이 테스트가 안 끝난다.
    const response = await send(`${url}/messages`, "좀비");
    const state = await (await fetch(`${url}/messages`)).json();

    expect(state.data.activeTurn.status).toBe("IN_PROGRESS");
    // 커서가 이 턴이 뗀 블록의 시작 자리 그대로다 = 프레임이 하나도 안 나갔다.
    expect(state.data.cursor % 1_000).toBe(0);
    // 계약에서 걷힌 값이다. 남아 있으면 화면이 낡은 누적본을 다시 그린다.
    expect(state.data.activeTurn).not.toHaveProperty("partialText");
    expect(state.data.activeTurn).not.toHaveProperty("startSeq");
    void response.body!.cancel();
  });

  it("범위 밖까지 넓힌 답은 그 회의록을 근거 줄에 싣는다", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });

    const events = await readEvents(
      await send(
        `http://localhost/v1/agent-chats/${chat.chatId}/messages`,
        "범위 밖인가"
      )
    );
    const refs = (
      events.at(-1)!.data as unknown as {
        refs: { id: string; title: string }[];
      }
    ).refs;

    // ★ 묻는 카드가 없으므로 **이 목록이 유일한 알림**이다. 범위 밖 회의록이 여기
    // 안 서면 사용자는 자기가 붙인 것만 봤다고 믿는다.
    expect(refs.map((ref) => ref.title)).toContain("결제 개편 킥오프");
  });



});

describe("stream is teed into history", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
    // 목 DB는 리셋하면 같은 chatId를 다시 발급한다 — 스트림 상태도 같이 비워야 한다.
    resetChatStreamsForTests();
  });
  afterAll(() => server.close());

  it("records the user message and the finished answer", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });

    await (
      await send(
        `http://localhost/v1/agent-chats/${chat.chatId}/messages`,
        "요약해줘"
      )
    ).text();

    const messages = mockDb.getAgentChatMessages(chat.chatId);
    // 조회 도구도 **생각도** 히스토리에 남는다 — 실제 서버가 그렇고, 그래야 새로고침
    // 뒤에도 「무엇을 보고 답했나」가 남는다. 생각이 안 남으면 말이 사라지고 도구
    // 뼈대만 남는다.
    expect(messages.map((message) => message.role)).toEqual([
      "USER",
      "THINKING",
      "THINKING",
      "TOOL",
      "THINKING",
      "ASSISTANT",
    ]);
    expect(messages[0].content).toBe("요약해줘");
    expect(messages[1].content).toContain("찾습니다");
  });

  // 스펙의 필수 전이 — 승인 → 도구 실행 → 히스토리 기록.
  it("records the tool run between the question and the answer", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });

    await streamAndDecide(
      `http://localhost/v1/agent-chats/${chat.chatId}/messages`,
      "Linear 이슈 만들어줘",
      "APPROVED"
    );

    // 계약은 승인 기록과 실행 기록을 나눈다 — 승인은 decision, 실행은 status를 갖는다.
    const messages = mockDb.getAgentChatMessages(chat.chatId);
    expect(messages.map((message) => message.role)).toEqual([
      "USER",
      "THINKING",
      "THINKING",
      "TOOL",
      "TOOL",
      "ASSISTANT",
    ]);
    expect(messages[3].toolEvent).toMatchObject({
      decision: "APPROVED",
      status: null,
    });
    expect(messages[4].toolEvent).toMatchObject({
      decision: null,
      status: "success",
    });
    expect(messages[4].toolEvent?.url).toContain("linear.app");
  });

  it("does not record an answer when the stream fails", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });

    await (
      await send(
        `http://localhost/v1/agent-chats/${chat.chatId}/messages`,
        "장애를 재현해줘"
      )
    ).text();

    // 부분 응답은 저장하지 않는다 (계약) — 유저 메시지만 남는다.
    expect(
      mockDb.getAgentChatMessages(chat.chatId).map((message) => message.role)
    ).toEqual(["USER"]);
  });

});

describe("agent chat guards", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
    // 목 DB는 리셋하면 같은 chatId를 다시 발급한다 — 스트림 상태도 같이 비워야 한다.
    resetChatStreamsForTests();
  });
  afterAll(() => server.close());

  // 없는 채팅에 스트림을 반쯤 열어 주면 web은 오류로 끝난 스트림을 받는다. 계약은 404다.
  it("returns 404 instead of a stream for an unknown chat", async () => {
    const response = await send(
      "http://localhost/v1/agent-chats/01K9999999999/messages",
      "요약해줘"
    );

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("AGENT_CHAT_NOT_FOUND");
  });
});

describe("write tool approval actually pauses the stream", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
    // 목 DB는 리셋하면 같은 chatId를 다시 발급한다 — 스트림 상태도 같이 비워야 한다.
    resetChatStreamsForTests();
  });
  afterAll(() => server.close());

  const WRITE_MESSAGE = "Linear 이슈 만들어줘";

  function newChat() {
    return mockDb.createAgentChat({ workspaceId: "01K0000000000" });
  }

  it("runs the tool and finishes when approved", async () => {
    const chat = newChat();

    const names = (
      await streamAndDecide(
        `http://localhost/v1/agent-chats/${chat.chatId}/messages`,
        WRITE_MESSAGE,
        "APPROVED"
      )
    ).map((event) => event.event);

    expect(names).toContain("tool_call_result");
    expect(names.at(-1)).toBe("message_end");
  });

  it("skips the tool and still ends cleanly when rejected", async () => {
    const chat = newChat();

    const events = await streamAndDecide(
      `http://localhost/v1/agent-chats/${chat.chatId}/messages`,
      WRITE_MESSAGE,
      "REJECTED"
    );

    const names = events.map((event) => event.event);
    expect(names).not.toContain("tool_call_result");
    expect(names.at(-1)).toBe("message_end");
    expect(
      events.find((event) => event.event === "tool_approval_resolved")!.data
        .decision
    ).toBe("REJECTED");
  });

  it("★ 1차는 승인 요청에서 끝나고 2차가 승인 응답이다", async () => {
    const chat = newChat();
    const url = `http://localhost/v1/agent-chats/${chat.chatId}`;

    // 1차가 스스로 닫힌다. 안 닫히면 승인 클릭이 아무 일도 안 한다.
    const first = await readEvents(await send(`${url}/messages`, WRITE_MESSAGE));
    expect(first.at(-1)!.event).toBe("tool_approval_request");

    const approvalId = String(first.at(-1)!.data.approvalId);
    const response = await resolve(url, approvalId, "APPROVED");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const second = await readEvents(response);
    expect(second[0].event).toBe("tool_approval_resolved");
    // 2차는 새 번호 블록에서 시작한다 — 실제 서버가 재개마다 블록을 뗀다.
    expect(second[0].seq!).toBeGreaterThan(first.at(-1)!.seq! + 1);
    // **`tool_call_start`가 없다** (계약). 결과는 승인 요청의 이름으로 귀속한다.
    expect(second.map((event) => event.event)).not.toContain("tool_call_start");
    expect(
      mockDb
        .getAgentChatMessages(chat.chatId)
        .flatMap((m) => (m.toolEvent ? [m.toolEvent.tool] : []))
    ).toEqual(["linear.create_issue", "linear.create_issue"]);

    // 두 번 누르면 이미 처리된 것이라 404다.
    expect((await resolve(url, approvalId, "APPROVED")).status).toBe(404);
  });

  it("★ 중지한 턴의 승인 카드는 404다", async () => {
    const chat = newChat();
    const url = `http://localhost/v1/agent-chats/${chat.chatId}`;
    const first = await readEvents(await send(`${url}/messages`, WRITE_MESSAGE));
    const request = first.at(-1)!;

    await fetch(`${url}/turns/${String(first[0].data.turnId)}/cancel`, {
      method: "POST",
    });

    // 승인은 남아 있지만 그 턴이 더 이상 승인 대기가 아니다.
    const response = await resolve(
      url,
      String(request.data.approvalId),
      "APPROVED"
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("APPROVAL_NOT_FOUND");
  });

  it("returns 404 for an approval nobody is waiting on", async () => {
    const response = await fetch(
      "http://localhost/v1/agent-chats/01K0000000030/approvals/01K9999999999/resolve",
      { method: "POST", body: JSON.stringify({ decision: "APPROVED" }) }
    );

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("APPROVAL_NOT_FOUND");
  });
});

describe("input validation matches the contract", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
    // 목 DB는 리셋하면 같은 chatId를 다시 발급한다 — 스트림 상태도 같이 비워야 한다.
    resetChatStreamsForTests();
  });
  afterAll(() => server.close());

  it("빈 메시지는 스트림을 열지 않고 400이다", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });

    const response = await send(
      `http://localhost/v1/agent-chats/${chat.chatId}/messages`,
      "   "
    );

    expect(response.status).toBe(400);
    // 히스토리에도 안 남는다 -- 물어본 것이 없는데 대화에 줄이 생기면 안 된다.
    expect(mockDb.getAgentChatMessages(chat.chatId)).toHaveLength(0);
  });
});

/**
 * ★ 이 구조의 인수 조건. 목이 「턴 = 연결」인 채로 두면 e2e가 아무것도 증명하지 않는다.
 */
describe("턴은 연결이 아니다", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
    // 목 DB는 리셋하면 같은 chatId를 다시 발급한다 — 스트림 상태도 같이 비워야 한다.
    resetChatStreamsForTests();
  });
  afterAll(() => server.close());

  it("★ POST 응답을 끊어도 턴은 계속 돌고 히스토리에 남는다", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });
    const response = await send(
      `http://localhost/v1/agent-chats/${chat.chatId}/messages`,
      "요약해줘"
    );

    // 첫 청크만 받고 끊는다 — 새로고침·탭 닫기가 하는 것과 같다.
    const reader = response.body!.getReader();
    await reader.read();
    void reader.cancel();

    await until(() =>
      mockDb
        .getAgentChatMessages(chat.chatId)
        .some((message) => message.role === "ASSISTANT")
    );
    // **도구 기록도 남는다.** tee가 「닫힐 때」면 끊긴 턴은 첫 프레임까지만 남기고 —
    // 도구도 답도 통째로 사라진다.
    expect(
      mockDb.getAgentChatMessages(chat.chatId).map((message) => message.role)
    ).toEqual(["USER", "THINKING", "THINKING", "TOOL", "THINKING", "ASSISTANT"]);
  });

  it("★ 끊긴 뒤 GET /events?after= 로 이어받고, 커서보다 큰 것만 온다", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });
    const url = `http://localhost/v1/agent-chats/${chat.chatId}`;
    const first = await readEvents(await send(`${url}/messages`, "요약해줘"));
    const middle = first[Math.floor(first.length / 2)].seq!;

    const resumed = await readEvents(
      await fetch(`${url}/events?after=${middle}`)
    );

    expect(resumed).not.toHaveLength(0);
    expect(resumed.every((event) => event.seq! > middle)).toBe(true);
    expect(resumed.at(-1)!.event).toBe("message_end");
  });
});

describe("바닥 아래에서 붙은 재접속", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
    // 목 DB는 리셋하면 같은 chatId를 다시 발급한다 — 스트림 상태도 같이 비워야 한다.
    resetChatStreamsForTests();
  });
  afterAll(() => server.close());

  it("★ 바닥 아래로 붙으면 첫 프레임이 stream_resync 이고 그 id: 가 바닥이다", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });
    const url = `http://localhost/v1/agent-chats/${chat.chatId}`;
    await readEvents(await send(`${url}/messages`, "요약해줘, 밀리게 해줘"));

    const resumed = await readEvents(await fetch(`${url}/events?after=0`));

    expect(resumed[0].event).toBe("stream_resync");
    // **번호가 있어야 뜻이 있다.** 이 값이 「여기까지는 못 준다」이고, web 커서가 여기로
    // 올라가야 이어지는 재생을 「이미 지나온 번호」로 안 버린다.
    expect(resumed[0].seq).toBeGreaterThan(0);
  });

  it("★ 바닥을 안 넘은 커서에는 아무 말도 안 한다 — 재생이 덮는다", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });
    const url = `http://localhost/v1/agent-chats/${chat.chatId}`;
    const first = await readEvents(await send(`${url}/messages`, "요약해줘"));
    const middle = first[Math.floor(first.length / 2)].seq!;

    const resumed = await readEvents(await fetch(`${url}/events?after=${middle}`));

    expect(resumed.map((event) => event.event)).not.toContain("stream_resync");
    expect(resumed.every((event) => event.seq! > middle)).toBe(true);
  });

  it("★ resync 를 보낸 뒤 스트림을 안 닫는다 — 도는 턴의 나머지가 계속 온다", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });
    const url = `http://localhost/v1/agent-chats/${chat.chatId}`;
    // 승인 대기로 턴을 붙잡아 둔 채, 로그의 앞을 버려 바닥을 올린다.
    const response = await send(
      `${url}/messages`,
      "Linear 이슈 만들어줘, 밀리게 해줘"
    );
    const { drop } = await readUntil(response, "tool_approval_request");

    const resumed = readEventsFromText(
      await (await fetch(`${url}/events?after=0`)).text()
    );

    expect(resumed[0].event).toBe("stream_resync");
    // 닫으면 여기서 끝난다. 계약은 뒤로 재생과 드레인이 이어진다고 말한다.
    expect(resumed.length).toBeGreaterThan(1);
    expect(resumed.at(-1)!.event).toBe("tool_approval_request");
    drop();
  });

  it("하트비트가 여는 순간 한 번이 아니라 계속 나온다", async () => {
    // 여는 순간 한 번뿐이면 web의 40초 유휴 타이머가 「연결이 죽었나」를 못 잰다.
    // **좀비로 잡아 둔다** — 승인 대기는 이제 스트림을 끝내므로 붙잡아 주지 못한다.
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });
    const response = await send(
      `http://localhost/v1/agent-chats/${chat.chatId}/messages`,
      "좀비"
    );
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
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
    // 목 DB는 리셋하면 같은 chatId를 다시 발급한다 — 스트림 상태도 같이 비워야 한다.
    resetChatStreamsForTests();
  });
  afterAll(() => server.close());

  it("★ 도는 중에 겹쳐 보내면 409이고 본문에 turnId가 있다", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });
    const url = `http://localhost/v1/agent-chats/${chat.chatId}/messages`;
    // 승인 대기로 첫 턴을 붙잡아 둔다.
    const { drop } = await readUntil(
      await send(url, "Linear 이슈 만들어줘"),
      "tool_approval_request"
    );

    const conflict = await send(url, "겹쳐서 보낼래");

    expect(conflict.status).toBe(409);
    const body = await conflict.json();
    expect(body.error.code).toBe("AGENT_CHAT_TURN_IN_PROGRESS");
    // 받는 쪽이 「실패」가 아니라 「이어받기」로 가려면 어느 턴인지 알아야 한다.
    expect(body.error.details[0]).toEqual({
      field: "turnId",
      message: expect.any(String),
    });
    drop();
  });

  it("★ 취소는 turn_cancelled를 흘리고 204다 — 이미 끝난 턴에도 204", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });
    const base = `http://localhost/v1/agent-chats/${chat.chatId}`;
    const { text, drop } = await readUntil(
      await send(`${base}/messages`, "Linear 이슈 만들어줘"),
      "turn_started"
    );
    const turnId = readEventsFromText(text)[0].data.turnId!;

    const cancelled = await fetch(`${base}/turns/${turnId}/cancel`, {
      method: "POST",
    });
    expect(cancelled.status).toBe(204);

    // 화면이 멈추는 신호는 204가 아니라 이 프레임이다.
    const resumed = readEventsFromText(
      await (await fetch(`${base}/events?after=0`)).text()
    );
    expect(resumed.map((event) => event.event)).toContain("turn_cancelled");

    // 멱등. 답이 막 끝나는 순간의 중지는 경합이지 오류가 아니다.
    expect((await fetch(`${base}/turns/${turnId}/cancel`, { method: "POST" })).status).toBe(204);
    drop();
  });

  it("★ GET /messages가 커서와 도는 턴을 함께 준다", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });
    const base = `http://localhost/v1/agent-chats/${chat.chatId}`;
    const { drop } = await readUntil(
      await send(`${base}/messages`, "Linear 이슈 만들어줘"),
      "tool_approval_request"
    );

    const { data } = await (await fetch(`${base}/messages`)).json();

    // `cursor`가 그대로 `?after=`가 된다. 없으면 이어받을 자리를 모른다.
    expect(data.cursor).toBeGreaterThan(0);
    expect(data.activeTurn.status).toBe("WAITING_APPROVAL");
    // 계약은 `pendingApproval`을 이 상태에서만 싣는다.
    expect(data.activeTurn.pendingApproval.approvalId).toBeTruthy();
    // 도는 턴이 곧 마지막 턴인 것이 정상이다.
    expect(data.lastTurn.turnId).toBe(data.activeTurn.turnId);
    // 진행 중 턴의 행에 `turnId`가 실려야 화면이 두 벌을 하나로 접는다.
    expect(data.messages[0].turnId).toBe(data.activeTurn.turnId);
    drop();
  });

  it("턴이 끝나면 activeTurn이 비고 lastTurn만 남는다", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });
    const base = `http://localhost/v1/agent-chats/${chat.chatId}`;
    await readEvents(await send(`${base}/messages`, "요약해줘"));

    const { data } = await (await fetch(`${base}/messages`)).json();
    expect(data.activeTurn).toBeNull();
    expect(data.lastTurn.status).toBe("COMPLETED");
  });

  it("앞 턴이 끝나면 같은 질문도 새 턴을 연다", async () => {
    // 409 는 **도는 턴**이 있을 때만이다. 끝난 뒤에는 같은 문장이어도 막지 않는다 —
    // 막으면 같은 것을 다시 물어볼 수가 없다.
    const chat = mockDb.createAgentChat({ workspaceId: "01K0000000000" });
    const url = `http://localhost/v1/agent-chats/${chat.chatId}/messages`;

    await readEvents(await send(url, "요약해줘"));
    await readEvents(await send(url, "요약해줘"));

    const roles = mockDb.getAgentChatMessages(chat.chatId).map((m) => m.role);
    expect(roles.filter((role) => role === "USER")).toHaveLength(2);
  });
});
