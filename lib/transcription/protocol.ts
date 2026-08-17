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

export const serverEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("connected"), sessionId: tsidSchema }),
  z.strictObject({
    type: z.literal("partial"),
    utteranceId: tsidSchema,
    text: z.string().min(1),
  }),
  finalEventSchema,
  // throughChunkSeq 까지 내구 쓰기가 끝났다. 누적값이라 조각마다 안 보내도 된다.
  // 소리의 내구성만 증명한다 — 그 구간의 전사가 저장됐다는 뜻이 아니다.
  z.strictObject({
    type: z.literal("ack"),
    throughChunkSeq: z.number().int().min(0),
  }),
  // 살아 있는 동안만 존재한다. 회복하면 사라지고 조회 응답에 안 남는다.
  z.strictObject({
    type: z.literal("capture_state"),
    state: z.enum(["LIVE", "DEGRADED", "LOST"]),
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
      text: "현재까지 누적된 문장",
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
