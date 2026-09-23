import { z } from "zod";

import {
  contextBatchAppliedSchema,
  proposalChangedSchema,
} from "@/lib/notes/proposals/contract";

const tsidSchema = z
  .string()
  .length(13)
  .regex(/^[0-9A-HJKMNP-TV-Z]{13}$/);

const typeOnly = <T extends string>(type: T) =>
  z.object({ type: z.literal(type) });

/**
 * **모르는 필드를 거부하지 않는다(`z.object`).** `proposals/contract.ts` 가 이미 같은
 * 판단을 내렸고 이 union 은 그 스키마 둘을 그대로 품는다 — 한 union 안에서 갈래마다
 * 엄격함이 다를 이유가 없다.
 *
 * 거부의 대가는 여기서 무음이다(`try{}catch{}`). 이벤트만 사라지고 안전 폴링이 버티므로
 * 눈에 안 보이고, 그래서 더 오래 산다.
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
  typeOnly("meeting.started"),
  typeOnly("meeting.ended"),
  z.object({
    type: z.literal("recording.started"),
    transcriptionSessionId: tsidSchema,
  }),
  z.object({
    type: z.literal("recording.stopped"),
    transcriptionSessionId: tsidSchema,
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
