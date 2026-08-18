import { describe, expect, it } from "vitest";
import {
  parseClientCommand,
  parseServerEvent,
} from "@/lib/transcription/protocol";

describe("AsyncAPI transcription protocol", () => {
  it("accepts stop with the last chunk number and nothing else", () => {
    expect(parseClientCommand('{"type":"stop","finalChunkSeq":421}')).toEqual({
      type: "stop",
      finalChunkSeq: 421,
    });
    // 조각을 하나도 못 보낸 세션
    expect(parseClientCommand('{"type":"stop","finalChunkSeq":-1}')).toEqual({
      type: "stop",
      finalChunkSeq: -1,
    });
    expect(() => parseClientCommand('{"type":"SESSION_PAUSE"}')).toThrow();
  });

  it("rejects the retired commit command", () => {
    // 커밋 단위가 없어졌다. 남아 있으면 서버가 안 받는 것을 브라우저가 계속 보낸다.
    expect(() => parseClientCommand('{"type":"commit"}')).toThrow();
  });

  it("requires the last chunk number on stop", () => {
    expect(() => parseClientCommand('{"type":"stop"}')).toThrow();
  });

  it("accepts a partial snapshot keyed by utterance ID", () => {
    expect(
      parseServerEvent(
        JSON.stringify({
          type: "partial",
          utteranceId: "0HZX2K7M9Q4AC",
          text: "안녕하세요",
        })
      )
    ).toMatchObject({
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "안녕하세요",
    });
  });

  it("accepts a flat final event carrying a nullable speaker label", () => {
    expect(
      parseServerEvent(
        JSON.stringify({
          type: "final",
          segmentId: "0HZX2K7M9Q4AD",
          utteranceId: "0HZX2K7M9Q4AC",
          sequence: 1,
          text: "확정된 문장",
          startedAtMs: 0,
          endedAtMs: 1200,
          speakerLabel: null,
        })
      )
    ).toMatchObject({ type: "final", sequence: 1, speakerLabel: null });
  });

  it("rejects a final that still carries the session id", () => {
    // 이 필드가 있는 동안 web 이 세션 경계로 타임라인을 이어 붙였다. 계약에서 빼야
    // 그 코드가 되살아날 수 없다.
    expect(() =>
      parseServerEvent(
        JSON.stringify({
          type: "final",
          transcriptionSessionId: "0HZX2K7M9Q4AB",
          segmentId: "0HZX2K7M9Q4AD",
          utteranceId: "0HZX2K7M9Q4AC",
          sequence: 1,
          text: "확정된 문장",
          startedAtMs: 0,
          endedAtMs: 1200,
          speakerLabel: null,
        })
      )
    ).toThrow();
  });

  it("accepts the cumulative durability ack", () => {
    expect(
      parseServerEvent('{"type":"ack","throughChunkSeq":300}')
    ).toMatchObject({ type: "ack", throughChunkSeq: 300 });
  });

  it("accepts the two capture states and rejects the retired one", () => {
    for (const state of ["LIVE", "DEGRADED"]) {
      expect(
        parseServerEvent(JSON.stringify({ type: "capture_state", state }))
      ).toMatchObject({ type: "capture_state", state });
    }
    // LOST 를 뺐다. 조각을 안 보내는 당사자가 이 브라우저라 이미 알고 있고, 정말 네트워크가
    // 끊겼으면 그 말이 닿지도 않는다 — 끊긴 사실은 조회의 공백이 더 정확히 말한다.
    expect(() =>
      parseServerEvent('{"type":"capture_state","state":"LOST"}')
    ).toThrow();
    expect(() =>
      parseServerEvent('{"type":"capture_state","state":"UNKNOWN"}')
    ).toThrow();
  });
});
