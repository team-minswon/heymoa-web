import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { KNOWN_EVENTS } from "@/lib/chat/stream-protocol";

const openapi = parse(readFileSync("openapi3.yml", "utf8"));
const asyncapi = parse(readFileSync("asyncapi.yml", "utf8"));
const stomp = parse(readFileSync("asyncapi-stomp.yml", "utf8"));

describe("REST and WebSocket contract consistency", () => {
  it("shares TSID and persisted final segment fields", () => {
    const rest = openapi.components.schemas;

    const restTsidPattern =
      rest.TranscriptionSessionResponse.properties.data.properties.noteId
        .pattern;
    expect(stomp.components.schemas.Tsid.pattern).toBe(restTsidPattern);
    expect(asyncapi.components.schemas.Tsid.pattern).toBe(restTsidPattern);

    const restRequired = [
      ...rest.TranscriptResponse.properties.data.properties.segments.items
        .required,
    ]
      .filter((field: string) => field !== "assignedParticipantId")
      .sort();
    const socketRequired = [
      ...stomp.components.messages.FinalEvent.payload.required,
    ]
      .filter((field) => !["type", "utteranceId"].includes(field))
      .sort();

    expect(socketRequired).toEqual(restRequired);
  });

  it("keeps meeting pause out of the realtime protocol", () => {
    const eventTypes = Object.values(
      stomp.components.messages as Record<
        string,
        { payload?: { properties?: { type?: { enum?: string[] } } } }
      >
    ).flatMap(
      (message: { payload?: { properties?: { type?: { enum?: string[] } } } }) =>
        message.payload?.properties?.type?.enum ?? []
    );

    expect(eventTypes).not.toContain("meeting.paused");
    expect(eventTypes).toEqual(
      expect.arrayContaining(["recording.started", "recording.stopped"])
    );
  });

  it("binds note topics to STOMP and chat streams to the SSE edge", () => {
    expect(Object.keys(stomp.channels)).toContain("noteTopic");
    expect(Object.keys(stomp.servers)).toEqual(["production"]);
    expect(asyncapi.channels.agentChatStream.servers).toEqual([
      { $ref: "#/servers/sseEdge" },
    ]);
  });
});

describe("chat SSE contract", () => {
  it("채널이 하나다 — 공유 챗봇이 층마다 사라졌다", () => {
    expect(Object.keys(asyncapi.channels)).toEqual(
      expect.arrayContaining(["agentChatStream"])
    );
    expect(Object.keys(asyncapi.channels)).not.toContain("noteSharedChatStream");
    expect(Object.keys(asyncapi.operations)).not.toContain(
      "receiveNoteSharedChatEvents"
    );
    expect(Object.keys(asyncapi.components.messages).join(",")).not.toMatch(
      /NoteChat/
    );
    expect(Object.keys(openapi.paths)).not.toContain(
      "/v1/notes/{noteId}/chat/messages"
    );
  });

  it("asyncapi 의 이벤트와 리듀서가 아는 이벤트가 같다", () => {
    const declared = new Set(
      Object.keys(asyncapi.channels.agentChatStream.messages).map(
        (key) => asyncapi.components.messages[key].name
      )
    );
    expect(declared).toEqual(KNOWN_EVENTS);
  });

  it("커서가 id: 줄에 있고 문자열이며 data 안에는 없다", () => {
    const frame =
      openapi.paths["/v1/agent-chats/{chatId}/turns/{turnId}/events"].get
        .responses["200"].content["text/event-stream"].examples
        .subscribeAgentChatTurnEvents_Success.value;

    const lines = frame.split("\n");
    expect(lines.filter((line: string) => /^id:\d+-\d+$/.test(line)).length).toBeGreaterThan(0);
    for (const line of lines.filter((line: string) => line.startsWith("data:"))) {
      expect(line).not.toContain('"seq"');
      expect(line).not.toContain('"payload"');
    }
  });

  it("이어받기 경로가 온전하다 — cursor · ?after= · activeTurn · 202 {turnId}", () => {
    const data =
      openapi.components.schemas.AgentChatMessagesResponse.properties.data;

    expect(data.required).toContain("cursor");
    expect(data.properties.cursor).toMatchObject({ type: "string", nullable: true });
    expect(Object.keys(data.properties)).toEqual(
      expect.arrayContaining(["cursor", "activeTurn", "lastTurn"])
    );
    expect(data.properties.messages.items.properties.turnId).toBeDefined();

    expect(Object.keys(openapi.paths)).not.toContain("/v1/agent-chats/{chatId}/events");
    const events =
      openapi.paths["/v1/agent-chats/{chatId}/turns/{turnId}/events"].get;
    expect(events.operationId).toBe("subscribeAgentChatTurnEvents");
    expect(events.parameters.map((each: { name: string }) => each.name)).toEqual(
      expect.arrayContaining(["chatId", "turnId", "after"])
    );
    expect(
      events.parameters.find((each: { name: string }) => each.name === "after").schema.type
    ).toBe("string");
    expect(Object.keys(events.responses)).toEqual(
      expect.arrayContaining(["200", "404", "410", "503"])
    );

    const post = openapi.paths["/v1/agent-chats/{chatId}/messages"].post;
    expect(post.responses["200"]).toBeUndefined();
    expect(
      post.responses["202"].content["application/json"].schema.$ref
    ).toBe("#/components/schemas/AgentChatTurnStartedResponse");
    const resolve =
      openapi.paths["/v1/agent-chats/{chatId}/approvals/{approvalId}/resolve"].post;
    expect(resolve.responses["200"]).toBeUndefined();
    expect(
      resolve.responses["202"].content["application/json"].schema.$ref
    ).toBe("#/components/schemas/AgentChatTurnStartedResponse");
    expect(resolve.parameters.map((each: { name: string }) => each.name)).not.toContain(
      "after"
    );
    expect(
      openapi.components.schemas.AgentChatTurnStartedResponse.properties.data.required
    ).toEqual(["turnId"]);
    expect(
      openapi.paths["/v1/agent-chats/{chatId}/turns/{turnId}/cancel"].post
        .operationId
    ).toBe("cancelAgentChatTurn");
  });

  it("범위 턴의 payload 필드가 선언돼 있다", () => {
    expect(
      asyncapi.components.messages.MessageEnd.payload.properties.refs.items.$ref
    ).toBe("#/components/schemas/NoteRef");
    expect(
      asyncapi.components.messages.ToolCallStart.payload.properties.target
        .allOf[0].$ref
    ).toBe("#/components/schemas/ToolTarget");

    expect(
      asyncapi.components.schemas.ToolTarget.properties.kind.enum
    ).toBeUndefined();

    expect(
      openapi.paths["/v1/agent-chats/{chatId}/messages"].post.requestBody
        .content["application/json"].schema.$ref
    ).toBe("#/components/schemas/SendAgentChatMessageRequest");
    expect(
      Object.keys(
        openapi.components.schemas.SendAgentChatMessageRequest.properties
      )
    ).toEqual(expect.arrayContaining(["message", "noteIds", "projectIds"]));
  });
});
