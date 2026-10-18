import type { Query, QueryClient } from "@tanstack/react-query";

import { isNoteListQueryKey } from "@/lib/notes/query-keys";
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

function write(
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

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 바뀐 곳만 새로 만들고 나머지는 같은 참조로 둔다 — 안 바뀌면 입력 그대로를 돌려준다. */
function mapDeep(value: unknown, visit: (node: Json) => Json): unknown {
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
