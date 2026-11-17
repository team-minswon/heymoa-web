import { z } from "zod";

import { tsidSchema } from "@/lib/api/tsid";

import {
  contextBatchAppliedSchema,
  proposalChangedSchema,
  wireInstantSchema,
} from "@/lib/notes/proposals/contract";

const meetingLifecycle = {
  meetingStatus: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "PAUSED", "ENDED"])
    .optional(),
  meetingStartedAt: z.string().nullable().optional(),
  recordedDurationMs: z.number().int().min(0).optional(),
  activeSessionStartedAt: z.string().nullable().optional(),
};

export const noteTopicEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("transcript.partial"),
    transcriptionSessionId: tsidSchema,
    utteranceId: tsidSchema,
    confirmedText: z.string(),
    pendingText: z.string(),
  }),
  z.object({
    type: z.literal("transcript.final"),
    transcriptionSessionId: tsidSchema,
    segmentId: tsidSchema,
    utteranceId: tsidSchema,
    sequence: z.number().int().min(1),
    text: z.string().min(1),
    startedAtMs: z.number().int().min(0),
    endedAtMs: z.number().int().min(0),
  }),
  z.object({ type: z.literal("meeting.started"), ...meetingLifecycle }),
  z.object({ type: z.literal("meeting.ended"), ...meetingLifecycle }),
  z.object({
    type: z.literal("recording.started"),
    transcriptionSessionId: tsidSchema,
    ...meetingLifecycle,
  }),
  z.object({
    type: z.literal("recording.stopped"),
    transcriptionSessionId: tsidSchema,
    ...meetingLifecycle,
  }),
  proposalChangedSchema,
  contextBatchAppliedSchema,
  z.object({
    type: z.literal("agendas.changed"),
    occurredAt: wireInstantSchema,
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

/**
 * 노트 토픽 구독 거절 통지. 거절된 구독의 destination 으로는 보낼 수 없어 사용자 queue 로 옵니다.
 * ERROR 프레임은 Spring 이 쓴 뒤 세션을 닫아(그 탭의 녹음까지 끊겨) 쓰지 않습니다.
 */
export const NOTE_SUBSCRIPTION_FEEDBACK_DESTINATION =
  "/user/queue/note-subscriptions";

export const noteSubscriptionRejectedSchema = z.object({
  type: z.literal("subscription.rejected"),
  noteId: tsidSchema,
  reason: z.enum([
    "NOT_MEMBER",
    "ALREADY_SUBSCRIBED",
    "TOO_MANY_SUBSCRIBERS",
    "UNAVAILABLE",
  ]),
});

export type NoteSubscriptionRejected = z.infer<
  typeof noteSubscriptionRejectedSchema
>;

export function parseNoteSubscriptionRejected(
  raw: string
): NoteSubscriptionRejected {
  return noteSubscriptionRejectedSchema.parse(JSON.parse(raw));
}
