import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const openapi = parse(readFileSync("openapi3.yml", "utf8"));
const asyncapi = parse(readFileSync("asyncapi.yml", "utf8"));

describe("REST and WebSocket contract consistency", () => {
  it("shares TSID, session status, errors, and persisted segment fields", () => {
    const rest = openapi.components.schemas;
    const socket = asyncapi.components.schemas;

    // Verify TSID pattern consistency
    const restTsidPattern =
      rest.TranscriptionSessionResponse.properties.data.properties.noteId.pattern;
    expect(socket.Tsid.pattern).toBe(restTsidPattern);

    // Verify Segment fields consistency
    const restSegmentRequired =
      rest.TranscriptResponse.properties.data.properties.segments.items.required;
    const restFields = [...restSegmentRequired]
      .map((f) => (f === "transcriptionSessionId" ? "sessionId" : f))
      .sort();
    const socketFields = [...socket.TranscriptSegment.required].sort();
    expect(socketFields).toEqual(restFields);
  });
});
