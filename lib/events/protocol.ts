import { z } from "zod";

import type { SseEvent } from "@/lib/api/sse";

// 모르는 이벤트 이름과 필드는 무시합니다(던지지 않습니다). 롤링 배포 중 새 서버가 새 힌트를 먼저 내도 연결이 삽니다.
const ready = z.object({
  type: z.literal("ready"),
  maxAgeSec: z.number().optional(),
});
const noteChanged = z.object({
  type: z.literal("note.changed"),
  workspaceId: z.string(),
  noteId: z.string(),
  aspects: z.array(z.string()),
});
const notesChanged = z.object({
  type: z.literal("notes.changed"),
  workspaceId: z.string(),
  projectId: z.string().optional(),
});
const chatsChanged = z.object({
  type: z.literal("chats.changed"),
  workspaceId: z.string(),
});
const notificationsChanged = z.object({
  type: z.literal("notifications.changed"),
});
const membershipChanged = z.object({
  type: z.literal("membership.changed"),
  workspaceId: z.string(),
});
const resync = z.object({ type: z.literal("resync") });
const degraded = z.object({ type: z.literal("degraded") });

const userEvent = z.discriminatedUnion("type", [
  ready,
  noteChanged,
  notesChanged,
  chatsChanged,
  notificationsChanged,
  membershipChanged,
  resync,
  degraded,
]);

type UserEvent = z.infer<typeof userEvent>;
export type UserEventHint = Extract<
  UserEvent,
  {
    type:
      | "note.changed"
      | "notes.changed"
      | "chats.changed"
      | "notifications.changed"
      | "membership.changed";
  }
>;

export const USER_EVENT_NAMES = userEvent.options.map(
  (option) => option.shape.type.value
);

/** 하트비트·모르는 이름·깨진 본문은 `null` 입니다. 호출부는 건너뜁니다. */
export function parseUserEvent(event: SseEvent): UserEvent | null {
  if (event.event === "heartbeat") return null;
  let data: unknown;
  try {
    data = JSON.parse(event.data);
  } catch {
    return null;
  }
  const parsed = userEvent.safeParse({
    ...(typeof data === "object" && data !== null ? data : {}),
    type: event.event,
  });
  return parsed.success ? parsed.data : null;
}
