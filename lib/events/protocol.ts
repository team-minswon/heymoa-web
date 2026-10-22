import { z } from "zod";

import type { SseEvent } from "@/lib/api/sse";

/**
 * 사용자 단위 이벤트 스트림 `GET /v1/events` 의 힌트(PRO-67 I01·I02). 계약은 `openapi3.yml` 의 `/v1/events` 설명과
 * server `UserEventHint`. **힌트는 무엇이 바뀌었는지만 알리고 값을 싣지 않는다** — 받은 쪽이 REST 를 다시 읽는다.
 *
 * **모르는 이벤트 이름과 필드는 무시한다**(던지지 않는다). 롤링 배포 중 새 서버가 새 힌트를 먼저 내도 연결이 계속
 * 산다 — 노트 토픽 protocol 이 모르는 타입에서 던져 조용히 버려 온 선례를 반복하지 않는다.
 */
const ready = z.object({
  type: z.literal("ready"),
  maxAgeSec: z.number().optional(),
});
const noteChanged = z.object({
  type: z.literal("note.changed"),
  workspaceId: z.string(),
  noteId: z.string(),
  // `transcript`·`agendas`·`review` 는 이름만 예약돼 있다. 모르는 면은 걸러 내고 남은 것만 쓴다.
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

export type UserEvent = z.infer<typeof userEvent>;
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

/** 계약 대조 테스트가 읽는 이름 목록. */
export const USER_EVENT_NAMES = userEvent.options.map(
  (option) => option.shape.type.value
);

/** 하트비트·모르는 이름·깨진 본문은 `null` 이다 — 호출부는 건너뛴다. */
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
