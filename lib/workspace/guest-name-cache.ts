import type { Query, QueryClient } from "@tanstack/react-query";

import {
  isNoteListQueryKey,
  isWorkspaceGuestsQueryKey,
} from "@/lib/notes/query-keys";
import { isProjectTaskQueryKey } from "@/lib/tasks/task-groups";

export function writeGuestName(
  queryClient: QueryClient,
  { guestId, displayName }: { guestId: string; displayName: string }
) {
  const queries = queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => holdsGuestName(query.queryKey) });

  const participantIds = new Set<string>();
  for (const query of queries) {
    write(queryClient, query, (data) =>
      renameGuestOwned(data, guestId, displayName, participantIds)
    );
  }
  if (participantIds.size === 0) return;
  for (const query of queries) {
    write(queryClient, query, (data) =>
      renameSpeakers(data, participantIds, displayName)
    );
  }
}

export function cachedGuestName(
  queryClient: QueryClient,
  guestId: string
): string | undefined {
  let latest: { at: number; name: string } | undefined;
  for (const query of queryClient.getQueryCache().findAll({
    predicate: (candidate) => isWorkspaceGuestsQueryKey(candidate.queryKey),
  })) {
    const data = query.state.data as
      | { data?: { data?: { guests?: Json[] } } }
      | undefined;
    const found = data?.data?.data?.guests?.find(
      (row) => row.guestId === guestId
    );
    if (typeof found?.displayName !== "string") continue;
    if (!latest || query.state.dataUpdatedAt > latest.at) {
      latest = { at: query.state.dataUpdatedAt, name: found.displayName };
    }
  }
  return latest?.name;
}

function payload(query: Query): Json | undefined {
  const data = query.state.data as
    | { data?: { success?: boolean; data?: unknown } }
    | undefined;
  const inner = data?.data?.data;
  return typeof inner === "object" && inner !== null
    ? (inner as Json)
    : undefined;
}

export function workspaceScope(queries: Query[], workspaceId: string) {
  const notes = new Set<string>();
  const projects = new Set<string>();
  const own = `/v1/workspaces/${workspaceId}/`;
  for (const query of queries) {
    const path = String(query.queryKey[0]);
    const data = payload(query);
    const note = /^\/v1\/notes\/([^/]+)$/.exec(path);
    if (note && data?.workspaceId === workspaceId) {
      notes.add(note[1]);
      if (typeof data.projectId === "string") projects.add(data.projectId);
    }
    if (path.startsWith(own)) {
      for (const item of [
        ...(Array.isArray(data?.notes) ? data.notes : []),
        ...(Array.isArray(data?.projects) ? data.projects : []),
      ] as Json[]) {
        if (typeof item.noteId === "string") notes.add(item.noteId);
        if (typeof item.projectId === "string") projects.add(item.projectId);
      }
    }
  }
  for (const query of queries) {
    const project = /^\/v1\/projects\/([^/]+)\/notes$/.exec(
      String(query.queryKey[0])
    );
    if (!project || !projects.has(project[1])) continue;
    const data = payload(query);
    for (const item of (Array.isArray(data?.notes)
      ? data.notes
      : []) as Json[]) {
      if (typeof item.noteId === "string") notes.add(item.noteId);
    }
  }
  return (queryKey: readonly unknown[]) => {
    const path = String(queryKey[0]);
    if (path.startsWith(own)) return true;
    const note = /^\/v1\/notes\/([^/]+)/.exec(path);
    if (note) return notes.has(note[1]);
    const project = /^\/v1\/projects\/([^/]+)/.exec(path);
    return project !== null && projects.has(project[1]);
  };
}

export function inWorkspace(
  queryClient: QueryClient,
  workspaceId: string,
  holds: (queryKey: readonly unknown[]) => boolean
) {
  const scope = workspaceScope(
    queryClient.getQueryCache().getAll(),
    workspaceId
  );
  return (query: Query) => holds(query.queryKey) && scope(query.queryKey);
}

export function holdsGuestName(queryKey: readonly unknown[]) {
  const path = queryKey[0];
  return (
    typeof path === "string" &&
    (/^\/v1\/workspaces\/[^/]+\/guests$/.test(path) ||
      path.startsWith("/v1/notes/") ||
      isNoteListQueryKey(queryKey) ||
      isProjectTaskQueryKey(queryKey))
  );
}

export function write(
  queryClient: QueryClient,
  query: Query,
  rewrite: (data: unknown) => unknown
) {
  const next = rewrite(query.state.data);
  if (next === query.state.data) return;
  queryClient.setQueryData(query.queryKey, next, {
    updatedAt: query.state.dataUpdatedAt,
  });
}

export type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mapDeep(value: unknown, visit: (node: Json) => Json): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const mapped = mapDeep(item, visit);
      if (mapped !== item) changed = true;
      return mapped;
    });
    return changed ? next : value;
  }
  if (!isJson(value)) return value;
  let changed = false;
  const children: Json = {};
  for (const [key, child] of Object.entries(value)) {
    const mapped = mapDeep(child, visit);
    if (mapped !== child) changed = true;
    children[key] = mapped;
  }
  const base = changed ? children : value;
  return visit(base);
}

function renameGuestOwned(
  data: unknown,
  guestId: string,
  displayName: string,
  participantIds: Set<string>
) {
  return mapDeep(data, (node) => {
    if (node.type === "GUEST" && node.id === guestId) {
      return typeof node.name === "string" && node.name !== displayName
        ? { ...node, name: displayName }
        : node;
    }
    if (node.guestId !== guestId) return node;
    if (typeof node.participantId === "string") {
      participantIds.add(node.participantId);
    }
    const patch: Json = {};
    if (
      typeof node.displayName === "string" &&
      node.displayName !== displayName
    )
      patch.displayName = displayName;
    if (typeof node.name === "string" && node.name !== displayName)
      patch.name = displayName;
    return Object.keys(patch).length > 0 ? { ...node, ...patch } : node;
  });
}

function renameSpeakers(
  data: unknown,
  participantIds: Set<string>,
  displayName: string
) {
  return mapDeep(data, (node) =>
    typeof node.assignedParticipantId === "string" &&
    participantIds.has(node.assignedParticipantId) &&
    typeof node.assignedName === "string" &&
    node.assignedName !== displayName
      ? { ...node, assignedName: displayName }
      : node
  );
}
