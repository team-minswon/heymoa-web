import { z } from "zod";

import {
  contextBatchAppliedSchema,
  proposalChangedSchema,
} from "@/lib/notes/proposals/contract";

const tsidSchema = z
  .string()
  .length(13)
  .regex(/^[0-9A-HJKMNP-TV-Z]{13}$/);

const meetingLifecycle = {
  meetingStatus: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "PAUSED", "ENDED"])
    .optional(),
  meetingStartedAt: z.string().nullable().optional(),
  recordedDurationMs: z.number().int().min(0).optional(),
  activeSessionStartedAt: z.string().nullable().optional(),
};

/**
 * **모르는 필드를 거부하지 않는다(`z.object`).** `proposals/contract.ts` 가 이미 같은
 * 판단을 내렸고 이 union 은 그 스키마 둘을 그대로 품는다 — 한 union 안에서 갈래마다
 * 엄격함이 다를 이유가 없다.
 *
 * 알 수 없는 필드는 전송 계약의 전방 호환을 위해 버린다. 알려진 필드의 잘못된 값은
 * 파싱 오류로 남겨 서버와 web의 어긋남을 드러낸다.
 */
export const noteTopicEventSchema = z.discriminatedUnion("type", [
  // 토막 둘의 근거는 `lib/transcription/protocol.ts` 의 partial 주석에 있다.
  // **뷰어에게도 같은 경계를 준다** — 한쪽만 가르면 녹음하는 사람과 보는 사람이
  // 같은 발화를 다른 농도로 읽는다.
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
  // 맥락 후보. 스키마는 `proposals/contract.ts`가 정본이고 여기서 두 벌로 쓰지
  // 않는다 — REST 목·화면·이 union이 같은 것을 본다.
  proposalChangedSchema,
  contextBatchAppliedSchema,
]);

export type NoteTopicEvent = z.infer<typeof noteTopicEventSchema>;
export type NoteTopicContextEvent = Extract<
  NoteTopicEvent,
  { type: "proposal.changed" | "transcript-analysis-run.applied" }
>;
export type NoteTopicFinalSegment = Extract<
  NoteTopicEvent,
  { type: "transcript.final" }
>;

export function parseNoteTopicEvent(raw: string): NoteTopicEvent {
  return noteTopicEventSchema.parse(JSON.parse(raw));
}

/**
 * 노트 토픽 구독이 거절됐다는 통지 (APP-685).
 *
 * **거절이 무음이었다.** 서버가 SUBSCRIBE 프레임을 버리기만 해서 클라이언트는 성공한 줄
 * 알았고, 그 침묵을 메우려고 화면에 안전 폴링이 깔렸다.
 *
 * **노트 토픽이 아니라 사용자 전용 queue 로 온다** — 거절당한 구독은 서버에 등록되지
 * 않았으므로 그 destination 으로는 아무것도 못 보낸다. ERROR 프레임은 Spring 이 쓴 뒤
 * 세션을 닫아서 못 쓴다(구독 하나 거절이 그 탭의 녹음까지 끊는다).
 */
export const NOTE_SUBSCRIPTION_FEEDBACK_DESTINATION =
  "/user/queue/note-subscriptions";

export const noteSubscriptionRejectedSchema = z.object({
  type: z.literal("subscription.rejected"),
  noteId: tsidSchema,
  /**
   * 셋을 가르는 이유는 **화면이 다르게 행동해야 하기 때문**이다.
   * `NOT_MEMBER` 는 목록으로 돌려보내고, `ALREADY_SUBSCRIBED` 는 우리 쪽 버그이며,
   * `TOO_MANY_SUBSCRIBERS` 만 잠시 뒤 다시 된다.
   */
  reason: z.enum(["NOT_MEMBER", "ALREADY_SUBSCRIBED", "TOO_MANY_SUBSCRIBERS"]),
});

export type NoteSubscriptionRejected = z.infer<
  typeof noteSubscriptionRejectedSchema
>;

export function parseNoteSubscriptionRejected(
  raw: string
): NoteSubscriptionRejected {
  return noteSubscriptionRejectedSchema.parse(JSON.parse(raw));
}
