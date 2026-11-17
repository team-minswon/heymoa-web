import { z } from "zod";

const tsidSchema = z
  .string()
  .length(13)
  .regex(/^[0-9A-HJKMNP-TV-Z]{13}$/);

const clientCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("stop"),
    finalChunkSeq: z.number().int().min(-1),
  }),
]);

const finalEventSchema = z.object({
  type: z.literal("final"),
  segmentId: tsidSchema,
  utteranceId: tsidSchema,
  sequence: z.number().int().min(1),
  text: z.string().min(1),
  startedAtMs: z.number().int().min(0),
  endedAtMs: z.number().int().min(0),
  speakerLabel: z.string().min(1).nullable(),
});

/** 업체(Soniox)는 토큰마다 `is_final` 을 줘서 안 바뀔 글자와 갈아치울 글자를 두 토막으로 싣습니다. */
const partialEventSchema = z.object({
  type: z.literal("partial"),
  utteranceId: tsidSchema,
  confirmedText: z.string(),
  pendingText: z.string(),
});

const captureStateSchema = z.enum(["LIVE", "DEGRADED"]);

const serverEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("connected"),
    sessionId: tsidSchema,
    epoch: z.number().int().min(0),
    /** 서버가 S3 와 행까지 확정한 마지막 조각. 없으면 -1. */
    durableThroughSeq: z.number().int().min(-1),
  }),
  z.object({
    type: z.literal("reattach"),
    delayMs: z.number().int().min(0),
    reason: z.string(),
    overlap: z.boolean().optional(),
  }),
  z.object({ type: z.literal("superseded"), sessionId: tsidSchema }),
  partialEventSchema,
  finalEventSchema,
  z.object({
    type: z.literal("ack"),
    throughChunkSeq: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("capture_state"),
    state: captureStateSchema,
  }),
  z.object({ type: z.literal("completed"), sessionId: tsidSchema }),
  z.object({
    type: z.literal("error"),
    code: z
      .string()
      .pipe(
        z
          .enum([
            "INVALID_CLIENT_MESSAGE",
            "INVALID_AUDIO_FRAME",
            "STT_CONNECTION_FAILED",
            "STT_TRANSCRIPTION_FAILED",
            "INTERNAL_ERROR",
            "NOT_SESSION_OWNER",
            "SESSION_NOT_CONNECTABLE",
          ])
          .catch("INTERNAL_ERROR")
      ),
    message: z.string().min(1),
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

const knownEventTypes = new Set<unknown>(
  serverEventSchema.options.map((option) => option.shape.type.value)
);

export function parseServerEvent(raw: string): ServerEvent | null {
  const data: unknown = JSON.parse(raw);
  const type = (data as { type?: unknown } | null)?.type;
  if (!knownEventTypes.has(type)) {
    console.warn(`[transcription] 모르는 서버 이벤트: ${String(type)}`);
    return null;
  }
  const state = (data as { state?: unknown }).state;
  if (
    type === "capture_state" &&
    typeof state === "string" &&
    !captureStateSchema.safeParse(state).success
  ) {
    console.warn(`[transcription] 모르는 수집 상태: ${state}`);
    return null;
  }
  return serverEventSchema.parse(data);
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
    reattach: { type: "reattach", delayMs: 1_500, reason: "SERVER_DRAINING" },
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
