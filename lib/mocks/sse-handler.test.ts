import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";

import { mockDb } from "@/lib/mocks/db";
import { chatSseHandlers } from "@/lib/mocks/sse-handler";
import { restHandlers } from "@/lib/mocks/rest-handlers";

const server = setupServer(...restHandlers, ...chatSseHandlers);
const WORKSPACE_ID = "01K0000000000";

function readEvents(text: string) {
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

describe("agent chat SSE mock", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
  });
  afterAll(() => server.close());

  it("메시지를 보내면 SSE를 흐리고 완성본을 히스토리에 남긴다", async () => {
    const chat = mockDb.createAgentChat({ workspaceId: WORKSPACE_ID });
    const response = await fetch(
      `http://localhost/v1/agent-chats/${chat.chatId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ message: "지금까지를 정리해줘", noteIds: [] }),
      }
    );

    expect(response.status).toBe(200);
    const events = readEvents(await response.text());
    expect(events.some((event) => event.event === "token")).toBe(true);
    expect(events.at(-1)?.event).toBe("message_end");
    expect(
      mockDb
        .getAgentChatMessages(chat.chatId)
        .messages?.map((message) => message.role)
    ).toEqual(["USER", "ASSISTANT"]);
  });

  it("없는 대화는 SSE를 열기 전에 404로 거절한다", async () => {
    const response = await fetch(
      "http://localhost/v1/agent-chats/01K0000099999/messages",
      { method: "POST", body: JSON.stringify({ message: "안녕" }) }
    );
    expect(response.status).toBe(404);
  });
});
