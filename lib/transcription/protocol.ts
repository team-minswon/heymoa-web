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
  z.strictObject({
    type: z.literal("stop"),
    finalChunkSeq: z.number().int().min(-1),
  }),
]);

const finalEventSchema = z.strictObject({
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
const partialEventSchema = z.strictObject({
  type: z.literal("partial"),
  utteranceId: tsidSchema,
  /** 업체가 확정한 토큰. 이 발화가 끝날 때까지 안 바뀐다. */
  confirmedText: z.string(),
  /** 다음 응답이 **통째로** 갈아치운다. 앞에 붙는 공백은 어절 경계라 지우지 않는다. */
  pendingText: z.string(),
});

export const serverEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("connected"), sessionId: tsidSchema }),
  partialEventSchema,
  finalEventSchema,
  // throughChunkSeq 까지 내구 쓰기가 끝났다. 누적값이라 조각마다 안 보내도 된다.
  // 소리의 내구성만 증명한다 — 그 구간의 전사가 저장됐다는 뜻이 아니다.
  z.strictObject({
    type: z.literal("ack"),
    throughChunkSeq: z.number().int().min(0),
  }),
  // 살아 있는 동안만 존재한다. 회복하면 사라지고 조회 응답에 안 남는다.
  //
  // `LOST`(조각이 안 온다)를 뺐다 — 조각을 안 보내는 당사자가 이 브라우저라 이미 알고 있고,
  // 정말 네트워크가 끊긴 경우엔 그 말이 닿지도 않는다. 끊긴 사실은 조회의 공백이 더 정확히
  // 말한다. 남은 하나는 **서버만 아는 것**이다 — 업체가 죽어 소리는 쌓이는데 글자만 멈췄다.
  z.strictObject({
    type: z.literal("capture_state"),
    state: z.enum(["LIVE", "DEGRADED"]),
  }),
  z.strictObject({ type: z.literal("completed"), sessionId: tsidSchema }),
  z.strictObject({
    type: z.literal("error"),
    code: z.enum([
      "INVALID_CLIENT_MESSAGE",
      "INVALID_AUDIO_FRAME",
      "STT_CONNECTION_FAILED",
      "STT_TRANSCRIPTION_FAILED",
      "INTERNAL_ERROR",
    ]),
    message: z.string().min(1),
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
    connected: { type: "connected", sessionId: "0HZX2K7M9Q4AB" },
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
      message: "전사 처리에 실패했습니다.",
    },
  },
} as const satisfies {
  commands: Record<string, ClientCommand>;
  events: Record<string, ServerEvent>;
};
