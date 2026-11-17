import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isTerminalError,
  parseClientCommand,
  parseServerEvent,
  type ServerEvent,
} from "@/lib/transcription/protocol";

describe("AsyncAPI transcription protocol", () => {
  it("마무리 중 재연결 안내를 읽는다", () => {
    expect(
      parseServerEvent(
        '{"type":"reattach","delayMs":300,"reason":"STOP_FINALIZING"}'
      )
    ).toEqual({
      type: "reattach",
      delayMs: 300,
      reason: "STOP_FINALIZING",
    });
  });

  it("accepts stop with the last chunk number and nothing else", () => {
    expect(parseClientCommand('{"type":"stop","finalChunkSeq":421}')).toEqual({
      type: "stop",
      finalChunkSeq: 421,
    });
    expect(parseClientCommand('{"type":"stop","finalChunkSeq":-1}')).toEqual({
      type: "stop",
      finalChunkSeq: -1,
    });
    expect(() => parseClientCommand('{"type":"SESSION_PAUSE"}')).toThrow();
  });

  it("rejects the retired commit command", () => {
    expect(() => parseClientCommand('{"type":"commit"}')).toThrow();
  });

  it("requires the last chunk number on stop", () => {
    expect(() => parseClientCommand('{"type":"stop"}')).toThrow();
  });

  it("accepts a partial snapshot split into confirmed and pending halves", () => {
    expect(
      parseServerEvent(
        JSON.stringify({
          type: "partial",
          utteranceId: "0HZX2K7M9Q4AC",
          confirmedText: "안녕하세요",
          pendingText: " 오늘은",
        })
      )
    ).toMatchObject({
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      confirmedText: "안녕하세요",
      pendingText: " 오늘은",
    });
  });

  it("accepts an empty half — 서버 발행 규칙이지 형식이 아니다", () => {
    expect(
      parseServerEvent(
        JSON.stringify({
          type: "partial",
          utteranceId: "0HZX2K7M9Q4AC",
          confirmedText: "",
          pendingText: "안녕",
        })
      )
    ).toMatchObject({ confirmedText: "", pendingText: "안녕" });
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

  it("drops a final that still carries the session id", () => {
    const parsed = parseServerEvent(
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
    );

    expect(parsed).not.toHaveProperty("transcriptionSessionId");
  });

  it("모르는 error reason 은 없는 것으로 읽고 녹음을 끊지 않는다", () => {
    expect(
      parseServerEvent(
        JSON.stringify({
          type: "error",
          code: "SESSION_NOT_CONNECTABLE",
          message: "연결할 수 없는 전사 세션입니다.",
          reason: "SOMETHING_NEW",
        })
      )
    ).toEqual({
      type: "error",
      code: "SESSION_NOT_CONNECTABLE",
      message: "연결할 수 없는 전사 세션입니다.",
      reason: undefined,
    });
  });

  it("accepts the cumulative durability ack", () => {
    expect(
      parseServerEvent('{"type":"ack","throughChunkSeq":300}')
    ).toMatchObject({ type: "ack", throughChunkSeq: 300 });
  });

  it("accepts the two capture states and drops the retired one", () => {
    for (const state of ["LIVE", "DEGRADED"]) {
      expect(
        parseServerEvent(JSON.stringify({ type: "capture_state", state }))
      ).toMatchObject({ type: "capture_state", state });
    }
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(
      parseServerEvent('{"type":"capture_state","state":"LOST"}')
    ).toBeNull();
    expect(
      parseServerEvent('{"type":"capture_state","state":"UNKNOWN"}')
    ).toBeNull();
    expect(() => parseServerEvent('{"type":"capture_state"}')).toThrow();
  });
});

describe("배포 창을 견딘다 — 서버가 먼저 이벤트·값을 더해도", () => {
  afterEach(() => vi.restoreAllMocks());

  it("모르는 이벤트 종류는 버리고 경고 한 줄을 남긴다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(parseServerEvent('{"type":"speaker_hint","x":1}')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("모르는 error.code 는 재부착하는 일반 오류로 읽는다", () => {
    const parsed = parseServerEvent(
      '{"type":"error","code":"QUOTA_EXCEEDED","message":"한도를 넘었습니다."}'
    );
    expect(parsed).toEqual({
      type: "error",
      code: "INTERNAL_ERROR",
      message: "한도를 넘었습니다.",
    });
    expect(
      isTerminalError(parsed as Extract<ServerEvent, { type: "error" }>)
    ).toBe(false);
  });

  it("깨진 JSON 과 빠진 필수 필드는 여전히 던진다", () => {
    expect(() => parseServerEvent("{not json")).toThrow();
    expect(() => parseServerEvent('{"type":"error","message":"x"}')).toThrow();
  });
});

describe("배포 창을 견딘다 — 서버가 먼저 필드를 실어도", () => {
  it("모르는 필드가 붙어도 이벤트가 살아 있고 그 필드는 버려진다", () => {
    const parsed = parseServerEvent(
      JSON.stringify({
        type: "final",
        segmentId: "0HZX2K7M9Q4AD",
        utteranceId: "0HZX2K7M9Q4AC",
        sequence: 1,
        text: "확정된 문장입니다.",
        startedAtMs: 1200,
        endedAtMs: 4100,
        speakerLabel: null,
        recordedDurationMs: 90_000,
      })
    );

    expect(parsed).toMatchObject({ type: "final", sequence: 1 });
    expect(parsed).not.toHaveProperty("recordedDurationMs");
  });

  it("관대함은 모르는 필드까지다 — 아는 필드의 깨진 값은 그대로 거절한다", () => {
    expect(() =>
      parseServerEvent('{"type":"connected","sessionId":"너무짧다"}')
    ).toThrow();
  });

  it("보내는 명령은 여전히 엄격하다", () => {
    expect(() =>
      parseClientCommand('{"type":"stop","finalChunkSeq":1,"extra":true}')
    ).toThrow();
  });

  it("connected 는 에포크와 서버가 확정한 마지막 조각 번호를 싣는다", () => {
    expect(
      parseServerEvent(
        '{"type":"connected","sessionId":"0HZX2K7M9Q4AB","epoch":3,"durableThroughSeq":-1,"leaseUntil":"x"}'
      )
    ).toEqual({
      type: "connected",
      sessionId: "0HZX2K7M9Q4AB",
      epoch: 3,
      durableThroughSeq: -1,
    });
    expect(() =>
      parseServerEvent(
        '{"type":"connected","sessionId":"0HZX2K7M9Q4AB","epoch":3,"durableThroughSeq":-2}'
      )
    ).toThrow();
  });

  it("서버가 곧 내려간다는 reattach 와 다른 부착이 이겼다는 superseded 를 받는다", () => {
    expect(
      parseServerEvent(
        '{"type":"reattach","delayMs":1500,"reason":"SERVER_DRAINING"}'
      )
    ).toEqual({ type: "reattach", delayMs: 1500, reason: "SERVER_DRAINING" });
    expect(
      parseServerEvent('{"type":"superseded","sessionId":"0HZX2K7M9Q4AB"}')
    ).toEqual({ type: "superseded", sessionId: "0HZX2K7M9Q4AB" });
  });
});
