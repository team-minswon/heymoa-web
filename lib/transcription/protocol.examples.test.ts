import { describe, expect, it } from "vitest";
import {
  parseClientCommand,
  parseServerEvent,
  protocolExamples,
} from "@/lib/transcription/protocol";

describe("AsyncAPI examples", () => {
  it("keeps Partial as a full snapshot split into two halves", () => {
    const { confirmedText, pendingText } = protocolExamples.events.partial;
    expect(`${confirmedText}${pendingText}`).toBe("현재까지 누적된 문장");
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
