import { describe, expect, it } from "vitest";
import {
  parseClientCommand,
  parseServerEvent,
  protocolExamples,
} from "@/lib/transcription/protocol";

describe("AsyncAPI examples", () => {
  it("keeps Partial as a full snapshot split into two halves", () => {
    const { confirmedText, pendingText } = protocolExamples.events.partial;
    // 이어 붙이면 곧 예전의 `text` 다. 두 토막이 겹치거나 빠지면 여기서 걸린다.
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
