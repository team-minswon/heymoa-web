import type { QueryFilters } from "@tanstack/react-query";

import type { UserEventHint } from "@/lib/events/protocol";

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
          head(queryKey) === `/v1/notes/${id}/analyses/latest` ||
          head(queryKey).startsWith(`/v1/notes/${id}/meeting-review`),
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
