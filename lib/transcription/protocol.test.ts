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
    // 이 필드가 있는 동안 web 이 세션 경계로 타임라인을 이어 붙였다. 계약에서 뺐으니
    // 그 코드가 되살아날 수 없어야 한다.
    //
    // **던지는 것으로는 그것을 못 지킨다.** 스키마가 관대해지면서 판정이 「거절」에서
    // 「버림」으로 바뀌었다 — 서버가 실어 보내도 파싱을 지난 값에는 없다. 금지의 근거는
    // 같고, 대가가 다르다: 거절했다면 이 소켓은 녹음 중에 닫혔다.
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

describe("배포 창을 견딘다 — 서버가 먼저 필드를 실어도", () => {
  // 이 소켓의 파싱 실패는 `onClose(1008)` + `close()` 로 이어져 **녹음 중인 세션이 끊긴다**.
  // 노트 토픽 쪽의 무음 삼킴과 대가가 다르다.
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

  // 나가는 쪽은 web 이 producer 다. 넓힐 이유가 없고, 넓히면 우리 버그가 조용해진다.
  it("보내는 명령은 여전히 엄격하다", () => {
    expect(() =>
      parseClientCommand('{"type":"stop","finalChunkSeq":1,"extra":true}')
    ).toThrow();
  });

  // 붙는 것은 세션에 「부착」하는 것이다. 브라우저는 durableThroughSeq 다음부터 다시 보낸다.
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
      parseServerEvent('{"type":"reattach","delayMs":1500,"reason":"draining"}')
    ).toEqual({ type: "reattach", delayMs: 1500, reason: "draining" });
    expect(
      parseServerEvent('{"type":"superseded","sessionId":"0HZX2K7M9Q4AB"}')
    ).toEqual({ type: "superseded", sessionId: "0HZX2K7M9Q4AB" });
  });
});
