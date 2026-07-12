import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const openapi = parse(readFileSync("openapi3.yml", "utf8"));
const asyncapi = parse(readFileSync("asyncapi.yml", "utf8"));

describe("REST and WebSocket contract consistency", () => {
  it("shares TSID, session status, errors, and persisted segment fields", () => {
    const rest = openapi.components.schemas;
    const socket = asyncapi.components.schemas;

    expect(socket.Tsid.pattern).toBe(rest.Tsid.pattern);
    expect(socket.TranscriptionSessionStatus.enum).toEqual(
      rest.TranscriptionSessionStatus.enum
    );
    expect([...socket.AppErrorType.enum].sort()).toEqual(
      [...rest.AppErrorType.enum].sort()
    );
    expect(socket.TranscriptSegment.required).toEqual(
      rest.TranscriptSegmentResponse.required
    );
  });
});
