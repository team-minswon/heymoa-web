import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";

import { mockDb } from "@/lib/mocks/db";
import {
  chatSseHandlers,
  setApprovalTimeoutForTests,
} from "@/lib/mocks/sse-handler";
import { restHandlers } from "@/lib/mocks/rest-handlers";

const server = setupServer(...restHandlers, ...chatSseHandlers);

function readEventsFromText(text: string) {
  return text
    .split("\n\n")
    .filter((block) => block.startsWith("event:"))
    .map((block) => {
      const [eventLine, dataLine] = block.split("\n");
      return {
        event: eventLine.slice("event:".length).trim(),
        data: JSON.parse(dataLine.slice("data:".length).trim()),
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
function activeNote() {
  const project = mockDb.listProjects("01K0000000000")[0];
  const note = mockDb.createNote(project.projectId, {});
  const session = mockDb.createSession(note.noteId);
  mockDb.updateSessionStatus(session.sessionId, "COMPLETED");
  return note;
}

/**
 * 실제 클라이언트가 하는 것과 같이 스트림을 읽다가 승인 요청이 보이면 응답한다.
 * 승인 id를 바깥에서 추측하지 않는다 — 턴마다 달라지므로 스트림이 유일한 출처다.
 */
async function streamAndDecide(
  url: string,
  message: string,
  decision: "APPROVED" | "REJECTED",
  chatPath = url.replace(/\/messages$/, "")
) {
  const response = await send(url, message);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let answered = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });

    if (!answered && text.includes("tool_approval_request")) {
      answered = true;
      const request = readEventsFromText(text).find(
        (event) => event.event === "tool_approval_request"
      )!;
      await fetch(`${chatPath}/approvals/${request.data.approvalId}`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
    }
  }
  return readEventsFromText(text);
}

function send(url: string, message: string) {
  return fetch(url, { method: "POST", body: JSON.stringify({ message }) });
}

describe("chat SSE handlers", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
  });
  afterAll(() => server.close());

  /** 없는 채팅은 404이므로 스트림 테스트는 실제 세션을 만들어 쓴다. */
  function personalChatUrl() {
    const chat = mockDb.createAgentChat({
      scope: "workspace",
      workspaceId: "01K0000000000",
    });
    return `http://localhost/v1/agent-chats/${chat.chatId}/messages`;
  }

  it("streams event frames with the SSE content type", async () => {
    const response = await send(personalChatUrl(), "요약해줘");

    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const events = await readEvents(response);
    expect(events.map((event) => event.event)).toEqual([
      "message_start",
      ...Array(events.length - 2).fill("token"),
      "message_end",
    ]);
  });

  it("emits a keepalive comment that is not an event", async () => {
    const response = await send(personalChatUrl(), "요약해줘");
    const text = await response.text();

    expect(text.startsWith(": keepalive")).toBe(true);
    // comment는 이벤트가 아니므로 프레임 파서에 잡히지 않아야 한다.
    expect(text.split("\n\n").filter((b) => b.startsWith(": "))).toHaveLength(1);
  });

  it("closes without a terminal event when the stream is dropped", async () => {
    const response = await send(personalChatUrl(), "연결을 끊어줘");
    const events = await readEvents(response);

    expect(events.map((event) => event.event)).not.toContain("message_end");
    expect(events.map((event) => event.event)).not.toContain("error");
  });

  it("returns 409 JSON instead of a stream when the meeting is not active", async () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});
    const session = mockDb.createSession(note.noteId);
    mockDb.updateSessionStatus(session.sessionId, "COMPLETED");
    mockDb.endMeeting(note.noteId);

    const response = await send(
      `http://localhost/v1/notes/${note.noteId}/chat/messages`,
      "요약해줘"
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect((await response.json()).error.code).toBe("MEETING_NOT_ACTIVE");
  });

  it("returns 409 while another member holds the input lock", async () => {
    const note = activeNote();
    mockDb.acquireSharedChatLock(note.noteId);

    const response = await send(
      `http://localhost/v1/notes/${note.noteId}/chat/messages`,
      "요약해줘"
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("CHAT_LOCKED");
  });

  it("시드된 남의 잠금도 전송을 막는다 — GET만이 아니라 POST 게이트까지", async () => {
    // 관전자 재현용 시드가 GET에서만 잠겨 보이고 POST는 통과하면 계약과 어긋난다.
    const note = activeNote();
    mockDb.seedForeignLock(note.noteId, "김민수");

    const response = await send(
      `http://localhost/v1/notes/${note.noteId}/chat/messages`,
      "요약해줘"
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("CHAT_LOCKED");
  });

  // 잠금은 스트림이 사는 동안 유지된다. 응답 객체를 받은 것만으로는 아직 끝난 게 아니다 —
  // 그 사이 들어온 요청은 CHAT_LOCKED여야 한다.
  it("holds the lock while the stream is still flowing", async () => {
    const note = activeNote();
    const url = `http://localhost/v1/notes/${note.noteId}/chat/messages`;

    const first = await send(url, "요약해줘");
    const second = await send(url, "요약해줘");

    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("CHAT_LOCKED");
    await first.text();
  });

  it("releases the lock once the stream is consumed", async () => {
    const note = activeNote();
    const url = `http://localhost/v1/notes/${note.noteId}/chat/messages`;

    await (await send(url, "요약해줘")).text();
    const second = await send(url, "요약해줘");

    expect(second.status).toBe(200);
    await second.text();
  });
});

describe("stream is teed into history", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
  });
  afterAll(() => server.close());

  it("records the user message and the finished answer", async () => {
    const chat = mockDb.createAgentChat({
      scope: "workspace",
      workspaceId: "01K0000000000",
    });

    await (
      await send(
        `http://localhost/v1/agent-chats/${chat.chatId}/messages`,
        "요약해줘"
      )
    ).text();

    const messages = mockDb.getAgentChatMessages(chat.chatId);
    expect(messages.map((message) => message.role)).toEqual([
      "USER",
      "ASSISTANT",
    ]);
    expect(messages[0].content).toBe("요약해줘");
  });

  // 스펙의 필수 전이 — 승인 → 도구 실행 → 히스토리 기록.
  it("records the tool run between the question and the answer", async () => {
    const chat = mockDb.createAgentChat({
      scope: "workspace",
      workspaceId: "01K0000000000",
    });

    await streamAndDecide(
      `http://localhost/v1/agent-chats/${chat.chatId}/messages`,
      "Linear 이슈 만들어줘",
      "APPROVED"
    );

    // 계약은 승인 기록과 실행 기록을 나눈다 — 승인은 decision, 실행은 status를 갖는다.
    const messages = mockDb.getAgentChatMessages(chat.chatId);
    expect(messages.map((message) => message.role)).toEqual([
      "USER",
      "TOOL",
      "TOOL",
      "ASSISTANT",
    ]);
    expect(messages[1].toolEvent).toMatchObject({
      decision: "APPROVED",
      status: null,
    });
    expect(messages[2].toolEvent).toMatchObject({ decision: null, status: "success" });
    expect(messages[2].toolEvent?.url).toContain("linear.app");
  });

  it("does not record an answer when the stream fails", async () => {
    const chat = mockDb.createAgentChat({
      scope: "workspace",
      workspaceId: "01K0000000000",
    });

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

  it("keeps the shared chat history readable by spectators", async () => {
    const note = activeNote();

    await (
      await send(
        `http://localhost/v1/notes/${note.noteId}/chat/messages`,
        "요약해줘"
      )
    ).text();

    const shared = mockDb.getNoteSharedChat(note.noteId);
    expect(shared.messages.map((message) => message.role)).toEqual([
      "USER",
      "ASSISTANT",
    ]);
    expect(shared.messages[0].authorName).toBe("테스트 유저");
    expect(shared.lock.locked).toBe(false);
  });
});

describe("agent chat guards", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
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
  });
  afterAll(() => server.close());

  const WRITE_MESSAGE = "Linear 이슈 만들어줘";

  // 데모 기본값(120초)을 기다릴 수 없으므로 만료 경로만 짧게 본다.
  beforeAll(() => setApprovalTimeoutForTests(1_000));
  afterAll(() => setApprovalTimeoutForTests(120_000));

  function newChat() {
    return mockDb.createAgentChat({
      scope: "workspace",
      workspaceId: "01K0000000000",
    });
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

  // 대기 상한이 지나면 REJECTED로 처리되고 스트림은 정상 종료된다 (계약).
  it("times out into a rejection when nobody answers", async () => {
    const chat = newChat();

    const events = readEventsFromText(
      await (
        await send(
          `http://localhost/v1/agent-chats/${chat.chatId}/messages`,
          WRITE_MESSAGE
        )
      ).text()
    );

    expect(
      events.find((event) => event.event === "tool_approval_resolved")!.data
        .decision
    ).toBe("REJECTED");
    expect(events.map((event) => event.event).at(-1)).toBe("message_end");
  });

  it("returns 404 for an approval nobody is waiting on", async () => {
    const response = await fetch(
      "http://localhost/v1/agent-chats/01K0000000030/approvals/01K9999999999",
      { method: "POST", body: JSON.stringify({ decision: "APPROVED" }) }
    );

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("APPROVAL_NOT_FOUND");
  });
});

describe("spectators see the approval wait by polling", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
  });
  afterAll(() => server.close());

  // 관전자는 스트림을 받지 않는다 — 승인 대기를 lock.pendingApproval 폴링으로만 본다 (계약).
  it("fills pendingApproval while the stream waits, then clears it", async () => {
    const note = activeNote();
    const streaming = send(
      `http://localhost/v1/notes/${note.noteId}/chat/messages`,
      "Linear 이슈 만들어줘"
    );

    // 스트림이 승인을 기다리는 동안 관전자가 폴링하면 대기 상태가 보인다.
    // 관전자는 스트림을 받지 않으므로 이 필드가 유일한 창구다 (계약).
    await expect
      .poll(() =>
        mockDb.getNoteSharedChat(note.noteId).lock.pendingApproval?.tool
      )
      .toBe("linear.create_issue");

    const pending = mockDb.getNoteSharedChat(note.noteId).lock.pendingApproval!;
    expect(pending.approvalId).toMatch(/^[0-9A-HJKMNP-TV-Z]{13}$/);

    await fetch(
      `http://localhost/v1/agent-chats/${note.noteId}/approvals/${pending.approvalId}`,
      { method: "POST", body: JSON.stringify({ decision: "APPROVED" }) }
    );
    await (await streaming).text();

    expect(mockDb.getNoteSharedChat(note.noteId).lock.pendingApproval).toBeNull();
  });
});

describe("input validation matches the contract", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
  });
  afterAll(() => server.close());

  it("rejects a blank shared chat message before taking the lock", async () => {
    const note = activeNote();

    const response = await send(
      `http://localhost/v1/notes/${note.noteId}/chat/messages`,
      "   "
    );

    expect(response.status).toBe(400);
    // 잠금을 잡기 전에 막아야 실패한 요청이 잠금을 남기지 않는다.
    expect(mockDb.getNoteSharedChat(note.noteId).lock.locked).toBe(false);
  });

  it("rejects an approval decision outside the contract enum", async () => {
    const note = activeNote();
    const streaming = send(
      `http://localhost/v1/notes/${note.noteId}/chat/messages`,
      "Linear 이슈 만들어줘"
    );

    await expect
      .poll(() =>
        mockDb.getNoteSharedChat(note.noteId).lock.pendingApproval?.approvalId
      )
      .toMatch(/^[0-9A-HJKMNP-TV-Z]{13}$/);
    const pending = mockDb.getNoteSharedChat(note.noteId).lock.pendingApproval!;
    const url = `http://localhost/v1/agent-chats/${note.noteId}/approvals/${pending.approvalId}`;

    // 계약 enum 밖 값은 400이다. 기본값을 APPROVED로 두면 오타가 쓰기 도구를 실행한다.
    const invalid = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ decision: "MAYBE" }),
    });
    expect(invalid.status).toBe(400);

    // 거절하면 스트림이 정상 종료된다 — 대기가 살아 있었다는 증거이기도 하다.
    expect(
      (
        await fetch(url, {
          method: "POST",
          body: JSON.stringify({ decision: "REJECTED" }),
        })
      ).status
    ).toBe(204);
    await (await streaming).text();
  });
});

describe("input validation matches the contract", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
  });
  afterAll(() => server.close());

  it("rejects a blank shared chat message before taking the lock", async () => {
    const note = activeNote();

    const response = await send(
      `http://localhost/v1/notes/${note.noteId}/chat/messages`,
      "   "
    );

    expect(response.status).toBe(400);
    // 잠금을 잡기 전에 막아야 실패한 요청이 잠금을 남기지 않는다.
    expect(mockDb.getNoteSharedChat(note.noteId).lock.locked).toBe(false);
  });

});
