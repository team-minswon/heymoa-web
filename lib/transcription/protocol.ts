import { z } from "zod";

const tsidSchema = z
  .string()
  .length(13)
  .regex(/^[0-9A-HJKMNP-TV-Z]{13}$/);

/**
 * `commit`이 사라졌다 — 커밋 단위가 없어졌다. 종료는 `stop` 하나이고, 브라우저가 보낸
 * 마지막 조각 번호를 함께 싣는다. 서버가 받은 것과 대조해 봉인을 `COMPLETE`/`TRUNCATED`로 가른다.
 *
 * 총 샘플 수는 안 보낸다 — 서버가 바이트를 세면 되고, 브라우저에게 물으면 추측이 계약으로 굳는다.
 */
export const clientCommandSchema = z.discriminatedUnion("type", [
  // 나가는 쪽은 web 이 producer 라 아래 서버 이벤트와 달리 엄격하게 둔다.
  z.strictObject({
    type: z.literal("stop"),
    finalChunkSeq: z.number().int().min(-1),
  }),
]);

const finalEventSchema = z.object({
  type: z.literal("final"),
  // transcriptionSessionId 를 뺐다. 있는 동안 web 이 세션 경계로 타임라인을 이어 붙였고,
  // 브라우저는 중지한 시간도 끊긴 구간의 길이도 모른다.
  segmentId: tsidSchema,
  utteranceId: tsidSchema,
  // 범위가 세션 내 → 노트 내로 바뀐다
  sequence: z.number().int().min(1),
  text: z.string().min(1),
  // 기준이 세션 시작 → 회의 시작으로 바뀐다
  startedAtMs: z.number().int().min(0),
  endedAtMs: z.number().int().min(0),
  // PRO-32 가 채운다. 겹침이 0이면 null
  speakerLabel: z.string().min(1).nullable(),
});

/**
 * 진행 중인 발화를 **두 토막으로** 싣는다. 업체(Soniox)는 토큰마다 `is_final` 을 주는데,
 * 예전에는 서버가 그것을 이어 붙여 문자열 하나로 보냈다 — 안 바뀔 글자와 다음 응답이
 * 갈아치울 글자의 경계가 거기서 사라졌고, 화면은 이미 굳은 앞부분까지 통째로 옅게 그렸다.
 *
 * 길이를 실어 잘라 쓰지 않는다. 인덱스는 한 칸만 어긋나도 한글 음절을 가르는데,
 * 그 사고는 화면에서 조용해서 안 보인다. 두 토막은 이어 붙이면 곧 전체이므로
 * 산술이 아예 필요 없다.
 *
 * **둘 다 빌 수 있다.** 서버는 빈 것을 안 보내지만, 그것은 발행 규칙이지 형식이 아니다.
 * 여기서 `min(1)` 로 막으면 규칙이 흔들릴 때 파싱이 끊기고 소켓이 통째로 닫힌다.
 */
const partialEventSchema = z.object({
  type: z.literal("partial"),
  utteranceId: tsidSchema,
  /** 업체가 확정한 토큰. 이 발화가 끝날 때까지 안 바뀐다. */
  confirmedText: z.string(),
  /** 다음 응답이 **통째로** 갈아치운다. 앞에 붙는 공백은 어절 경계라 지우지 않는다. */
  pendingText: z.string(),
});

/**
 * **모르는 필드를 거부하지 않는다(`z.object`).** 근거는 `lib/notes/proposals/contract.ts`
 * 상단에 이미 적혀 있다 — 배포가 heymoa-ai → heymoa-server → heymoa-web 순이라 server 가
 * 필드를 하나 더 실은 뒤 web 이 아직 안 올라간 창이 **반드시** 생긴다.
 *
 * 여기서는 그 창의 대가가 특히 비싸다. 이 소켓의 파싱 실패는 `onClose(1008)` + `close()` 로
 * 이어져 **녹음 중인 세션이 끊긴다** — 노트 토픽 쪽의 무음 삼킴과 다르다.
 *
 * 드리프트는 server 의 `AsyncApiContractTest`·`AsyncApiMessageCoverageTest` 가 잡는다.
 */
export const serverEventSchema = z.discriminatedUnion("type", [
  // 세션에 붙었다(부착). 브라우저는 durableThroughSeq 다음 조각부터 버퍼에서 다시 보낸다.
  z.object({
    type: z.literal("connected"),
    sessionId: tsidSchema,
    epoch: z.number().int().min(0),
    /** 서버가 S3 와 행까지 확정한 마지막 조각. 없으면 -1. */
    durableThroughSeq: z.number().int().min(-1),
  }),
  // 이 서버가 곧 내려간다. delayMs 뒤 같은 세션에 다시 붙는다(다른 태스크로 간다).
  z.object({
    type: z.literal("reattach"),
    delayMs: z.number().int().min(0),
    reason: z.string(),
  }),
  // 같은 세션에 다른 부착(다른 탭·기기)이 이겼다. 다시 붙지 않는다.
  z.object({ type: z.literal("superseded"), sessionId: tsidSchema }),
  partialEventSchema,
  finalEventSchema,
  // throughChunkSeq 까지 내구 쓰기가 끝났다. 누적값이라 조각마다 안 보내도 된다.
  // 소리의 내구성만 증명한다 — 그 구간의 전사가 저장됐다는 뜻이 아니다.
  z.object({
    type: z.literal("ack"),
    throughChunkSeq: z.number().int().min(0),
  }),
  // 살아 있는 동안만 존재한다. 회복하면 사라지고 조회 응답에 안 남는다.
  //
  // `LOST`(조각이 안 온다)를 뺐다 — 조각을 안 보내는 당사자가 이 브라우저라 이미 알고 있고,
  // 정말 네트워크가 끊긴 경우엔 그 말이 닿지도 않는다. 끊긴 사실은 조회의 공백이 더 정확히
  // 말한다. 남은 하나는 **서버만 아는 것**이다 — 업체가 죽어 소리는 쌓이는데 글자만 멈췄다.
  z.object({
    type: z.literal("capture_state"),
    state: z.enum(["LIVE", "DEGRADED"]),
  }),
  z.object({ type: z.literal("completed"), sessionId: tsidSchema }),
  z.object({
    type: z.literal("error"),
    /**
     * **값 추가는 필드 추가와 다르다.** 위의 관대함(`z.object`)은 모르는 **필드**만 흘려
     * 보내고, `z.enum` 밖의 **값**은 그대로 거절한다 — 그리고 이 소켓의 파싱 실패는
     * `onClose(1008)` 이라 **녹음이 끊긴다.** 그래서 서버가 새 코드를 내보내기 **전에**
     * 여기가 먼저 배포돼야 한다 (APP-685/686).
     *
     * 앞의 다섯과 뒤의 둘이 갈리는 기준은 **재시도가 의미 있는가**다.
     */
    code: z.enum([
      "INVALID_CLIENT_MESSAGE",
      "INVALID_AUDIO_FRAME",
      "STT_CONNECTION_FAILED",
      "STT_TRANSCRIPTION_FAILED",
      "INTERNAL_ERROR",
      /** 이 스트림의 주인이 아니다. 재시도해도 같다. */
      "NOT_SESSION_OWNER",
      /** 없는 세션·이미 닫힘·회의 종료·중복 연결·접근 불가. 재시도해도 같다. */
      "SESSION_NOT_CONNECTABLE",
    ]),
    message: z.string().min(1),
    /**
     * 같은 code 안에서 화면이 할 말을 가를 때만 온다. 지금은 `SESSION_NOT_CONNECTABLE` 에만 붙는다.
     * 모르는 값은 없는 것으로 읽는다 — code 와 달리 이 값 하나로 녹음을 끊을 까닭이 없다.
     */
    reason: z
      .enum(["MEETING_ENDED", "SESSION_CLOSED"])
      .optional()
      .catch(undefined),
  }),
]);

export type ClientCommand = z.infer<typeof clientCommandSchema>;
export type ServerEvent = z.infer<typeof serverEventSchema>;
export type RealtimeFinalSegment = z.infer<typeof finalEventSchema>;
export type RealtimePartial = z.infer<typeof partialEventSchema>;
export type CaptureState = Extract<
  ServerEvent,
  { type: "capture_state" }
>["state"];

/** 같은 세션에 다시 붙어도 답이 같은 오류. 녹음을 끝내는 in-band 오류는 이 둘뿐이다. */
export function isTerminalError(
  event: Extract<ServerEvent, { type: "error" }>
) {
  return (
    event.code === "NOT_SESSION_OWNER" ||
    event.code === "SESSION_NOT_CONNECTABLE"
  );
}

export function parseClientCommand(raw: string): ClientCommand {
  return clientCommandSchema.parse(JSON.parse(raw));
}

export function parseServerEvent(raw: string): ServerEvent {
  return serverEventSchema.parse(JSON.parse(raw));
}

export const protocolExamples = {
  commands: {
    stop: { type: "stop", finalChunkSeq: 421 },
  },
  events: {
    connected: {
      type: "connected",
      sessionId: "0HZX2K7M9Q4AB",
      epoch: 1,
      durableThroughSeq: -1,
    },
    reattach: { type: "reattach", delayMs: 1_500, reason: "draining" },
    superseded: { type: "superseded", sessionId: "0HZX2K7M9Q4AB" },
    partial: {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      confirmedText: "현재까지 누적된",
      pendingText: " 문장",
    },
    final: {
      type: "final",
      segmentId: "0HZX2K7M9Q4AD",
      utteranceId: "0HZX2K7M9Q4AC",
      sequence: 1,
      text: "확정된 문장입니다.",
      startedAtMs: 1200,
      endedAtMs: 4100,
      speakerLabel: null,
    },
    ack: { type: "ack", throughChunkSeq: 300 },
    captureState: { type: "capture_state", state: "DEGRADED" },
    completed: {
      type: "completed",
      sessionId: "0HZX2K7M9Q4AB",
    },
    error: {
      type: "error",
      code: "STT_TRANSCRIPTION_FAILED",
      message: "스크립트 처리에 실패했습니다.",
    },
    meetingEnded: {
      type: "error",
      code: "SESSION_NOT_CONNECTABLE",
      message: "회의가 끝나 이 녹음을 더 받을 수 없습니다.",
      reason: "MEETING_ENDED",
    },
  },
} as const satisfies {
  commands: Record<string, ClientCommand>;
  events: Record<string, ServerEvent>;
};
