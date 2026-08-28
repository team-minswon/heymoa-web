import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const openapi = parse(readFileSync("openapi3.yml", "utf8"));
const asyncapi = parse(readFileSync("asyncapi.yml", "utf8"));

describe("REST and WebSocket contract consistency", () => {
  it("shares TSID and persisted final segment fields", () => {
    const rest = openapi.components.schemas;

    // Verify TSID pattern consistency
    const restTsidPattern =
      rest.TranscriptionSessionResponse.properties.data.properties.noteId
        .pattern;
    expect(asyncapi.components.schemas.Tsid.pattern).toBe(restTsidPattern);

    // 실시간 final 과 저장된 발화가 같은 필드를 갖는지 본다. 어긋나면 화면이 두 소스를
    // 한 목록에 섞을 때 한쪽만 있는 필드가 조용히 undefined 가 된다.
    // 손으로 speakerLabel 을 더하던 우회가 있었다. REST 계약이 그것을 required 로 안
    // 말해서였는데, 서버가 nullable + contractRequired 로 고치면서 필요 없어졌다 (APP-421).
    const restRequired = [
      ...rest.TranscriptResponse.properties.data.properties.segments.items
        .required,
    ].sort();
    const socketRequired = [
      ...asyncapi.components.messages.FinalEvent.payload.required,
    ]
      .filter((field) => !["type", "utteranceId"].includes(field))
      .sort();

    expect(socketRequired).toEqual(restRequired);
  });

  it("keeps meeting pause out of the realtime protocol", () => {
    const eventTypes = Object.values(
      asyncapi.components.messages as Record<
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
    expect(asyncapi.channels.noteTopic.servers).toEqual([
      { $ref: "#/servers/production" },
    ]);
    expect(asyncapi.channels.agentChatStream.servers).toEqual([
      { $ref: "#/servers/sseEdge" },
    ]);
  });
});

describe("chat SSE contract", () => {
  it("carries the private agent chat channel and the eight stream events", () => {
    expect(Object.keys(asyncapi.channels)).toContain("agentChatStream");
    expect(Object.keys(asyncapi.channels)).not.toContain("noteSharedChatStream");
    expect(Object.keys(asyncapi.components.messages)).toEqual(
      expect.arrayContaining([
        "MessageStart",
        "Token",
        "ToolCallStart",
        "ToolApprovalRequest",
        "ToolApprovalResolved",
        "ToolCallResult",
        "MessageEnd",
        "Error",
      ])
    );
  });
});
