import { z } from "zod";

const tsidSchema = z
  .string()
  .length(13)
  .regex(/^[0-9A-HJKMNP-TV-Z]{13}$/);

const typeOnly = <T extends string>(type: T) =>
  z.strictObject({ type: z.literal(type) });

export const noteTopicEventSchema = z.discriminatedUnion("type", [
  // 토막 둘의 근거는 `lib/transcription/protocol.ts` 의 partial 주석에 있다.
  // **뷰어에게도 같은 경계를 준다** — 한쪽만 가르면 녹음하는 사람과 보는 사람이
  // 같은 발화를 다른 농도로 읽는다.
  z.strictObject({
    type: z.literal("transcript.partial"),
    transcriptionSessionId: tsidSchema,
    utteranceId: tsidSchema,
    confirmedText: z.string(),
    pendingText: z.string(),
  }),
  z.strictObject({
    type: z.literal("transcript.final"),
    transcriptionSessionId: tsidSchema,
    segmentId: tsidSchema,
    utteranceId: tsidSchema,
    sequence: z.number().int().min(1),
    text: z.string().min(1),
    startedAtMs: z.number().int().min(0),
    endedAtMs: z.number().int().min(0),
  }),
  typeOnly("meeting.started"),
  typeOnly("meeting.ended"),
  z.strictObject({
    type: z.literal("recording.started"),
    transcriptionSessionId: tsidSchema,
  }),
  z.strictObject({
    type: z.literal("recording.stopped"),
    transcriptionSessionId: tsidSchema,
  }),
  z.strictObject({
    type: z.literal("chat.token"),
    delta: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal("chat.message_end"),
    messageId: z.string().min(1),
    content: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal("chat.lock"),
    chatId: tsidSchema,
    locked: z.boolean(),
    lockedByUserId: tsidSchema.nullable(),
  }),
]);

export type NoteTopicEvent = z.infer<typeof noteTopicEventSchema>;
export type NoteTopicFinalSegment = Extract<
  NoteTopicEvent,
  { type: "transcript.final" }
>;

export function parseNoteTopicEvent(raw: string): NoteTopicEvent {
  return noteTopicEventSchema.parse(JSON.parse(raw));
}
