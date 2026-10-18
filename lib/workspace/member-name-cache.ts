import type { QueryClient } from "@tanstack/react-query";

import {
  holdsGuestName,
  mapDeep,
  workspaceScope,
  write,
  type Json,
} from "@/lib/workspace/guest-name-cache";

/** 멤버 한 사람이 이 워크스페이스에서 보이는 모습. 응답(또는 낙관적 값)에서 온다. */
export type MemberName = {
  userId: string;
  /** 보이는 이름 — 표시 이름, 없으면 계정 이름. */
  name: string;
  /** 워크스페이스가 정한 이름. 없으면 null. */
  displayName: string | null;
  accountName: string;
};

/**
 * 멤버 표시 이름 변경 (APP-1206)을 **이미 받아 둔 캐시에 직접 쓴다.** 재조회도 전체 무효화도 하지 않는다.
 * 임시 참여자(`writeGuestName`)와 같은 자리를 고치되, 사람을 `guestId` 가 아니라 `userId` 로 짚는다.
 *
 * - 멤버 목록 — 항목의 `name`·`displayName`·`accountName`
 * - 회의의 참여자·회의 시작자(회의 상세·참여자 목록·노트 목록) — `userId` 가 같은 항목의 `name`
 * - 할 일·회의 검토 항목의 담당 — `{ type: "USER", id, name }`
 * - 전사의 화자 — `assignedName`. 참여 기록 id 로 이어 붙인다(임시 참여자와 같다)
 *
 * **같은 사람이 다른 워크스페이스에서는 다른 이름이다.** 회의·할 일 조회의 키에는 워크스페이스가 없어서, 캐시에 든
 * 회의 상세·프로젝트 목록·노트 목록으로 「이 워크스페이스의 회의·프로젝트」를 먼저 모으고 그 조회만 고친다.
 * 어디 것인지 모르는 조회는 건드리지 않는다 — 틀린 이름을 쓰는 것보다 다음 조회까지 옛 이름이 남는 편이 낫다.
 */
export function writeMemberName(
  queryClient: QueryClient,
  workspaceId: string,
  member: MemberName
) {
  // 소속은 캐시 전체로 판별한다 — 이름 사본이 없는 조회(프로젝트 목록)도 「이 워크스페이스의 프로젝트」를 알려 준다.
  const inWorkspace = workspaceScope(
    queryClient.getQueryCache().getAll(),
    workspaceId
  );
  const queries = queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => holdsMemberName(query.queryKey) });
  const targets = queries.filter((query) => inWorkspace(query.queryKey));

  const participantIds = new Set<string>();
  for (const query of targets) {
    write(queryClient, query, (data) =>
      renameMemberOwned(data, member, participantIds)
    );
  }
  if (participantIds.size === 0) return;
  for (const query of targets) {
    write(queryClient, query, (data) =>
      mapDeep(data, (node) =>
        typeof node.assignedParticipantId === "string" &&
        participantIds.has(node.assignedParticipantId) &&
        typeof node.assignedName === "string" &&
        node.assignedName !== member.name
          ? { ...node, assignedName: member.name }
          : node
      )
    );
  }
}

/** 이 워크스페이스 멤버 목록 캐시에서 그 사람의 지금 모습을 읽는다. 없으면 undefined. */
export function cachedMemberName(
  queryClient: QueryClient,
  workspaceId: string,
  userId: string
): MemberName | undefined {
  const data = queryClient.getQueryData([
    `/v1/workspaces/${workspaceId}/members`,
  ]) as { data?: { data?: { members?: Json[] } } } | undefined;
  const item = data?.data?.data?.members?.find((row) => row.userId === userId);
  if (!item || typeof item.name !== "string") return undefined;
  return {
    userId,
    name: item.name,
    displayName: typeof item.displayName === "string" ? item.displayName : null,
    accountName:
      typeof item.accountName === "string" ? item.accountName : item.name,
  };
}

/** 멤버 이름 사본을 들 수 있는 조회. 이름 변경 전에 이 조회들의 진행 중인 요청을 끊는 데도 쓴다. */
export function holdsMemberName(queryKey: readonly unknown[]) {
  const path = queryKey[0];
  return (
    holdsGuestName(queryKey) ||
    (typeof path === "string" &&
      /^\/v1\/workspaces\/[^/]+\/members$/.test(path))
  );
}

function renameMemberOwned(
  data: unknown,
  member: MemberName,
  participantIds: Set<string>
) {
  return mapDeep(data, (node) => {
    if (node.type === "USER" && node.id === member.userId) {
      return typeof node.name === "string" && node.name !== member.name
        ? { ...node, name: member.name }
        : node;
    }
    if (node.userId !== member.userId) return node;
    if (typeof node.participantId === "string") {
      participantIds.add(node.participantId);
    }
    const patch: Json = {};
    if (typeof node.name === "string" && node.name !== member.name)
      patch.name = member.name;
    // 멤버 목록 항목(역할을 든 것)은 두 필드를 늘 쓴다 — 옛 서버의 목록에 없던 필드도 채워야 다시 열 때 고친 이름을
    // 계정 이름으로 오인하지 않는다. 참여자 같은 다른 사본에는 그 필드가 없으니 더하지 않는다.
    const listItem = "role" in node;
    if (
      (listItem || "displayName" in node) &&
      node.displayName !== member.displayName
    )
      patch.displayName = member.displayName;
    if (
      (listItem || "accountName" in node) &&
      node.accountName !== member.accountName
    )
      patch.accountName = member.accountName;
    return Object.keys(patch).length > 0 ? { ...node, ...patch } : node;
  });
}
