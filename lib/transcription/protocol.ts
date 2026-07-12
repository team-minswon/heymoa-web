import { z } from "zod";

const tsidSchema = z
  .string()
  .length(13)
  .regex(/^[0-9A-HJKMNP-TV-Z]{13}$/);

export const transcriptionSessionStatusSchema = z.enum([
  "CONNECTING",
  "STREAMING",
  "PAUSED",
  "FINALIZING",
  "COMPLETED",
  "INTERRUPTED",
  "FAILED",
]);

const appErrorTypeSchema = z.enum([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "WORKSPACE_NOT_FOUND",
  "NOTE_NOT_FOUND",
  "FOLDER_NOT_FOUND",
  "TRANSCRIPTION_SESSION_NOT_FOUND",
  "TRANSCRIPT_SEGMENT_NOT_FOUND",
  "FOLDER_NAME_ALREADY_EXISTS",
  "ACTIVE_TRANSCRIPTION_SESSION_EXISTS",
  "INVALID_TRANSCRIPTION_SESSION_STATE",
  "STT_PROVIDER_UNAVAILABLE",
  "INTERNAL_SERVER_ERROR",
]);

export const transcriptSegmentSchema = z.strictObject({
  segmentId: tsidSchema,
  sessionId: tsidSchema,
  sequence: z.number().int().min(1),
  text: z.string().min(1),
  startedAtMs: z.number().int().min(0),
  endedAtMs: z.number().int().min(0),
});

export const clientCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("TURN_COMMIT") }),
  z.strictObject({ type: z.literal("SESSION_PAUSE") }),
  z.strictObject({ type: z.literal("SESSION_RESUME") }),
  z.strictObject({ type: z.literal("SESSION_COMPLETE") }),
  z.strictObject({ type: z.literal("PING") }),
]);

export const serverEventSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("SESSION_READY"),
    sessionId: tsidSchema,
  }),
  z.strictObject({
    type: z.literal("SESSION_STATUS"),
    status: transcriptionSessionStatusSchema,
    recordedDurationMs: z.number().int().nonnegative(),
  }),
  z.strictObject({
    type: z.literal("TRANSCRIPT_PARTIAL"),
    itemId: z.string().min(1),
    text: z.string(),
    startedAtMs: z.number().int().nonnegative(),
  }),
  z.strictObject({
    type: z.literal("TRANSCRIPT_FINAL"),
    itemId: z.string().min(1),
    segment: transcriptSegmentSchema,
  }),
  z.strictObject({
    type: z.literal("SESSION_COMPLETED"),
    sessionId: tsidSchema,
  }),
  z.strictObject({
    type: z.literal("ERROR"),
    code: appErrorTypeSchema,
    message: z.string(),
    retryable: z.boolean(),
  }),
  z.strictObject({ type: z.literal("PONG") }),
]);

export type ClientCommand = z.infer<typeof clientCommandSchema>;
export type ServerEvent = z.infer<typeof serverEventSchema>;
export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;
export type TranscriptionSessionStatus = z.infer<
  typeof transcriptionSessionStatusSchema
>;

export function parseClientCommand(raw: string): ClientCommand {
  return clientCommandSchema.parse(JSON.parse(raw));
}

export function parseServerEvent(raw: string): ServerEvent {
  return serverEventSchema.parse(JSON.parse(raw));
}

export const protocolExamples = {
  commands: {
    commit: { type: "TURN_COMMIT" },
    pause: { type: "SESSION_PAUSE" },
    resume: { type: "SESSION_RESUME" },
    complete: { type: "SESSION_COMPLETE" },
    ping: { type: "PING" },
  },
  events: {
    ready: { type: "SESSION_READY", sessionId: "0HZX2K7M9Q4AB" },
    status: {
      type: "SESSION_STATUS",
      status: "STREAMING",
      recordedDurationMs: 0,
    },
    partial: {
      type: "TRANSCRIPT_PARTIAL",
      itemId: "provider-item-1",
      text: "현재까지 누적된 문장",
      startedAtMs: 1200,
    },
    final: {
      type: "TRANSCRIPT_FINAL",
      itemId: "provider-item-1",
      segment: {
        segmentId: "0HZX2K7M9Q4AB",
        sessionId: "0HZX2K7M9Q4AC",
        sequence: 1,
        text: "확정된 문장입니다.",
        startedAtMs: 1200,
        endedAtMs: 4100,
      },
    },
    completed: {
      type: "SESSION_COMPLETED",
      sessionId: "0HZX2K7M9Q4AB",
    },
    error: {
      type: "ERROR",
      code: "INVALID_TRANSCRIPTION_SESSION_STATE",
      message: "현재 상태에서는 요청을 처리할 수 없습니다.",
      retryable: false,
    },
    pong: { type: "PONG" },
  },
} as const satisfies {
  commands: Record<string, ClientCommand>;
  events: Record<string, ServerEvent>;
};
