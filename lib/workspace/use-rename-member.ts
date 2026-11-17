import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { errorMessageOf } from "@/lib/api/error-message";
import { useRenameWorkspaceMember } from "@/lib/api/generated/workspace-members/workspace-members";
import { inWorkspace } from "@/lib/workspace/guest-name-cache";
import {
  cachedMemberName,
  holdsMemberName,
  writeMemberName,
  type MemberName,
} from "@/lib/workspace/member-name-cache";

const renames = new Map<string, { inFlight: number; confirmed: MemberName }>();

export function useRenameMember({
  workspaceId,
  member,
}: {
  workspaceId: string;
  member: MemberName;
}) {
  const t = useTranslations("settings.renameDialog");
  const queryClient = useQueryClient();
  const key = `${workspaceId}:${member.userId}`;

  function rollback() {
    if ((renames.get(key)?.inFlight ?? 0) > 1) return;
    writeMemberName(
      queryClient,
      workspaceId,
      renames.get(key)?.confirmed ?? member
    );
  }

  const mutation = useRenameWorkspaceMember({
    mutation: {
      meta: { suppressErrorToast: true },
      scope: { id: `rename-workspace-member:${key}` },
      onMutate: async (variables) => {
        const current =
          cachedMemberName(queryClient, workspaceId, member.userId) ?? member;
        const state = renames.get(key) ?? { inFlight: 0, confirmed: current };
        if (state.inFlight === 0) state.confirmed = current;
        state.inFlight += 1;
        renames.set(key, state);
        await queryClient.cancelQueries({
          predicate: inWorkspace(queryClient, workspaceId, holdsMemberName),
        });
        const next = variables.data?.displayName?.trim() || null;
        writeMemberName(queryClient, workspaceId, {
          ...current,
          name: next ?? current.accountName,
          displayName: next,
        });
      },
      onSuccess: async (response) => {
        if (response.status !== 200 || !response.data.success) {
          rollback();
          return;
        }
        const saved = response.data.data;
        const confirmed: MemberName = {
          userId: saved.userId,
          name: saved.name,
          displayName: saved.displayName ?? null,
          accountName: saved.accountName ?? saved.name,
        };
        const state = renames.get(key);
        if (state) state.confirmed = confirmed;
        if ((state?.inFlight ?? 0) > 1) return;
        await queryClient.cancelQueries({
          predicate: inWorkspace(queryClient, workspaceId, holdsMemberName),
        });
        writeMemberName(queryClient, workspaceId, confirmed);
      },
      onError: () => rollback(),
      onSettled: () => {
        const state = renames.get(key);
        if (!state) return;
        state.inFlight -= 1;
        if (state.inFlight <= 0) renames.delete(key);
      },
    },
  });

  return {
    isPending: mutation.isPending,
    rename: async (nextName: string): Promise<string | null> => {
      const trimmed = nextName.trim();
      try {
        const response = await mutation.mutateAsync({
          workspaceId,
          userId: member.userId,
          data: { displayName: trimmed.length > 0 ? trimmed : null },
        });
        return response.status === 200 && response.data.success
          ? null
          : t("failed");
      } catch (error) {
        return errorMessageOf(error, t("failed"));
      }
    },
  };
}

export function memberNameOf(item: {
  userId: string;
  name: string;
  displayName?: string | null;
  accountName?: string | null;
}): MemberName {
  return {
    userId: item.userId,
    name: item.name,
    displayName: item.displayName ?? null,
    accountName: item.accountName ?? item.name,
  };
}
