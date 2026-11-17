import type { QueryClient } from "@tanstack/react-query";

import {
  holdsGuestName,
  mapDeep,
  workspaceScope,
  write,
  type Json,
} from "@/lib/workspace/guest-name-cache";

export type MemberName = {
  userId: string;
  name: string;
  displayName: string | null;
  accountName: string;
};

export function writeMemberName(
  queryClient: QueryClient,
  workspaceId: string,
  member: MemberName
) {
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
