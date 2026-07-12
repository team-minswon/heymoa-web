import { describe, expect, it } from "vitest";
import {
  parseClientCommand,
  parseServerEvent,
  protocolExamples,
} from "@/lib/transcription/protocol";

describe("AsyncAPI examples", () => {
  it("keeps Partial as a full snapshot", () => {
    expect(protocolExamples.events.partial.text).not.toBe("");
  });

  it("parses every documented command and event", () => {
    for (const command of Object.values(protocolExamples.commands)) {
      expect(parseClientCommand(JSON.stringify(command))).toEqual(command);
    }
    for (const event of Object.values(protocolExamples.events)) {
      expect(parseServerEvent(JSON.stringify(event))).toEqual(event);
    }
  });
});
