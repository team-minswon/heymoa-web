import type { QueryFilters } from "@tanstack/react-query";

import type { UserEventHint } from "@/lib/events/protocol";

/**
 * 힌트 → 다시 읽을 쿼리(PRO-67 I02). **순수 함수다** — 단위 테스트가 이 표를 그대로 검증한다.
 *
 * 대상은 문자열 하나로 적는다. 같은 대상의 연속 힌트를 집합으로 합치고(숨은 탭 모으기·250~500ms 합치기) 꺼낼 때
 * `filterOf` 로 쿼리 필터를 만든다.
 *
 * | 힌트 | 다시 읽는 것 |
 * |---|---|
 * | `note.changed` `analysis` | 그 노트의 분석 흐름·최신 분석 |
 * | `note.changed` `meeting` | 그 노트 상세와 그 워크스페이스 노트 목록. **노트 소켓이 열린 노트는 건너뛴다**(STOMP 가 이미 무효화한다) |
 * | `notes.changed` | 워크스페이스 노트 목록, `projectId` 가 있으면 그 프로젝트 목록도 |
 * | `chats.changed` | 그 워크스페이스의 채팅 목록. 열린 대화의 메시지 스트림은 건드리지 않는다 |
 * | `notifications.changed` | 안 읽은 개수와 열린 모달의 첫 쪽(「새 알림 N개」). 불러온 목록은 건드리지 않는다 |
 * | `membership.changed` | 워크스페이스 목록 |
 */
export type InvalidationTarget = string;

export function targetsForHint(
  hint: UserEventHint,
  context: { isNoteSocketOpen: (noteId: string) => boolean }
): InvalidationTarget[] {
  switch (hint.type) {
    case "note.changed": {
      const targets: InvalidationTarget[] = [];
      if (hint.aspects.includes("analysis"))
        targets.push(`analysis:${hint.noteId}`);
      if (
        hint.aspects.includes("meeting") &&
        !context.isNoteSocketOpen(hint.noteId)
      )
        targets.push(`note:${hint.noteId}`, `notes:ws:${hint.workspaceId}`);
      return targets;
    }
    case "notes.changed":
      return hint.projectId
        ? [`notes:ws:${hint.workspaceId}`, `notes:project:${hint.projectId}`]
        : [`notes:ws:${hint.workspaceId}`];
    case "chats.changed":
      return [`chats:${hint.workspaceId}`];
    case "notifications.changed":
      return ["notifications"];
    case "membership.changed":
      return ["workspaces"];
  }
}

const head = (key: readonly unknown[]) =>
  typeof key[0] === "string" ? key[0] : "";

/** 이 스트림이 소유한 쿼리 — 재연결·`resync` 때 전부 다시 읽는다. */
export const OWNED_TARGET: InvalidationTarget = "owned";

const OWNED_PATTERNS = [
  /^\/v1\/notes\/[^/]+$/,
  /^\/v1\/notes\/[^/]+\/analyses\/(flow|latest)$/,
  /^\/v1\/workspaces\/[^/]+\/notes$/,
  /^\/v1\/projects\/[^/]+\/notes$/,
  /^\/v1\/workspaces\/[^/]+\/agent-chats$/,
  /^\/v1\/notifications\/unread-count$/,
  /^\/v1\/workspaces$/,
];

const isNotificationHead = (key: readonly unknown[]) =>
  head(key) === "/v1/notifications" && key.at(-1) === "head";

export function filterOf(target: InvalidationTarget): QueryFilters {
  if (target === OWNED_TARGET)
    return {
      predicate: ({ queryKey }) =>
        isNotificationHead(queryKey) ||
        OWNED_PATTERNS.some((pattern) => pattern.test(head(queryKey))),
    };
  if (target === "notifications")
    return {
      predicate: ({ queryKey }) =>
        head(queryKey) === "/v1/notifications/unread-count" ||
        isNotificationHead(queryKey),
    };
  if (target === "workspaces")
    return { queryKey: ["/v1/workspaces"], exact: true };
  const [kind, ...rest] = target.split(":");
  const id = rest.at(-1);
  switch (kind) {
    case "analysis":
      return {
        predicate: ({ queryKey }) =>
          head(queryKey) === `/v1/notes/${id}/analyses/flow` ||
          head(queryKey) === `/v1/notes/${id}/analyses/latest`,
      };
    case "note":
      return { queryKey: [`/v1/notes/${id}`] };
    case "notes":
      return {
        queryKey: [
          rest[0] === "project"
            ? `/v1/projects/${id}/notes`
            : `/v1/workspaces/${id}/notes`,
        ],
      };
    case "chats":
      return { queryKey: [`/v1/workspaces/${id}/agent-chats`] };
    default:
      return { predicate: () => false };
  }
}
