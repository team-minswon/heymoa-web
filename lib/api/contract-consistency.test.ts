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
    expect(asyncapi.channels.noteSharedChatStream.servers).toEqual([
      { $ref: "#/servers/sseEdge" },
    ]);
  });
});

describe("chat SSE contract", () => {
  it("carries the agent chat channels and the eight stream events", () => {
    expect(Object.keys(asyncapi.channels)).toEqual(
      expect.arrayContaining(["agentChatStream", "noteSharedChatStream"])
    );
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
