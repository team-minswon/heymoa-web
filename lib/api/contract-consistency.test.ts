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
    ]
      .filter((field) => field !== "transcriptionSessionId")
      .sort();
    const socketRequired = [
      ...asyncapi.components.messages.FinalEvent.payload.required,
    ]
      .filter((field) => !["type", "utteranceId"].includes(field))
      .sort();

    expect(socketRequired).toEqual(restRequired);
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
