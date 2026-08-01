import { z } from "zod";

const tsidSchema = z
  .string()
  .length(13)
  .regex(/^[0-9A-HJKMNP-TV-Z]{13}$/);

export const clientCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("commit") }),
  z.strictObject({ type: z.literal("stop") }),
]);

const finalEventSchema = z.strictObject({
  type: z.literal("final"),
  transcriptionSessionId: tsidSchema,
  segmentId: tsidSchema,
  utteranceId: tsidSchema,
  sequence: z.number().int().min(1),
  text: z.string().min(1),
  /**
   * 제공자가 붙인 화자 라벨("1".."15"). 이름이 아니고, 화자 분리를 못 켠 구간은 null이다.
   * **세션이 다르면 같은 번호가 같은 사람이라는 보장이 없다.**
   */
  speaker: z.string().min(1).max(8).nullish(),
  startedAtMs: z.number().int().min(0),
  endedAtMs: z.number().int().min(0),
});

export const serverEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("connected"), sessionId: tsidSchema }),
  z.strictObject({
    type: z.literal("partial"),
    utteranceId: tsidSchema,
    text: z.string().min(1),
    /**
     * **잠정값이다.** 실시간 화자 분리는 맥락이 쌓이기 전까지 라벨이 뒤바뀔 수 있어
     * 같은 utteranceId 안에서도 값이 달라진다. 확정은 final의 speaker다.
     */
    speaker: z.string().min(1).max(8).nullish(),
  }),
  finalEventSchema,
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

export function parseClientCommand(raw: string): ClientCommand {
  return clientCommandSchema.parse(JSON.parse(raw));
}

export function parseServerEvent(raw: string): ServerEvent {
  return serverEventSchema.parse(JSON.parse(raw));
}

export const protocolExamples = {
  commands: {
    commit: { type: "commit" },
    stop: { type: "stop" },
  },
  events: {
    connected: { type: "connected", sessionId: "0HZX2K7M9Q4AB" },
    partial: {
      type: "partial",
      utteranceId: "0HZX2K7M9Q4AC",
      text: "현재까지 누적된 문장",
      speaker: "1",
    },
    final: {
      type: "final",
      transcriptionSessionId: "0HZX2K7M9Q4AB",
      segmentId: "0HZX2K7M9Q4AD",
      utteranceId: "0HZX2K7M9Q4AC",
      sequence: 1,
      text: "확정된 문장입니다.",
      speaker: "1",
      startedAtMs: 1200,
      endedAtMs: 4100,
    },
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
