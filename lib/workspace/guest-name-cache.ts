import type { Query, QueryClient } from "@tanstack/react-query";

import {
  isNoteListQueryKey,
  isWorkspaceGuestsQueryKey,
} from "@/lib/notes/query-keys";
import { isProjectTaskQueryKey } from "@/lib/tasks/task-groups";

/**
 * 임시 참여자 이름 변경 (APP-1194)을 **이미 받아 둔 캐시에 직접 쓴다.** 재조회도 전체 무효화도 하지 않는다.
 *
 * 이름을 사본으로 들고 있는 조회는 넷이다. 모두 `guestId` 로 같은 사람을 짚는다.
 *
 * - 임시 참여자 목록(쪽 수·`limit` 이 다른 키 여럿) — 항목의 `displayName`
 * - 회의의 참여자(회의 상세·참여자 목록·노트 목록) — 항목의 `name`
 * - 할 일·회의 검토 항목의 담당 — `{ type: "GUEST", id, name }`
 * - 전사의 화자 — `assignedName`. 화자는 `guestId` 가 아니라 **참여 기록 id**(`assignedParticipantId`)로 사람을 가리키므로,
 *   위에서 `guestId` 와 함께 본 `participantId` 로 이어 붙인다
 *
 * 값이 안 바뀐 쿼리는 건드리지 않고, 바뀐 쿼리도 **받아 온 시각은 그대로 둔다** — 쓰기가 신선도를 새로 찍으면
 * 아직 안 받은 다른 필드까지 방금 받은 것처럼 보인다.
 */
export function writeGuestName(
  queryClient: QueryClient,
  { guestId, displayName }: { guestId: string; displayName: string }
) {
  const queries = queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => holdsGuestName(query.queryKey) });

  // 화자는 참여 기록 id 로만 사람을 가리킨다. 이름 사본에서 먼저 그 id 를 모은 뒤에 화자를 고친다.
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

/**
 * 임시 참여자 목록 캐시에서 그 사람의 지금 이름을 읽는다. 쪽 수가 다른 목록 캐시가 여럿이면 **가장 늦게 받은** 것을 믿는다.
 * 없으면 undefined.
 */
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

/**
 * 캐시에 든 조회 중 **이 워크스페이스 것**을 가르는 판정. 회의·할 일 조회의 키에는 워크스페이스가 없어서, 회의 상세·
 * 프로젝트 목록·노트 목록으로 이 워크스페이스의 회의·프로젝트를 먼저 모은다. 어디 것인지 모르는 조회는 아니라고 본다.
 * 이름 쓰기와 진행 중 조회 끊기가 둘 다 이 판정을 지나야 다른 워크스페이스를 건드리지 않는다.
 */
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
  // 프로젝트 단위 노트 목록은 그 프로젝트가 이 워크스페이스 것일 때만 믿는다.
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

/** [workspaceId] 의 조회 중 [holds] 가 고른 것을 고르는 술어 — 진행 중 조회를 끊을 때 다른 워크스페이스를 건드리지 않게. */
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

/** 이 이름을 사본으로 들 수 있는 조회인가. 이름 변경 전에 이 조회들의 진행 중인 요청을 끊는 데도 쓴다. */
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

/** 바뀐 곳만 새로 만들고 나머지는 같은 참조로 둔다 — 안 바뀌면 입력 그대로를 돌려준다. */
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
    // 담당은 `guestId` 가 아니라 `{ type, id, name }` 으로 사람을 가리킨다.
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
