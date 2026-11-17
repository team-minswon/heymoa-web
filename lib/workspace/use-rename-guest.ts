import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { errorMessageOf } from "@/lib/api/error-message";
import { useRenameWorkspaceGuest } from "@/lib/api/generated/workspaces/workspaces";
import {
  cachedGuestName,
  holdsGuestName,
  inWorkspace,
  writeGuestName,
} from "@/lib/workspace/guest-name-cache";

const renames = new Map<string, { inFlight: number; confirmed: string }>();

export function useRenameGuest({
  workspaceId,
  guestId,
  displayName,
}: {
  workspaceId: string;
  guestId: string;
  displayName: string;
}) {
  const t = useTranslations("settings.renameDialog");
  const queryClient = useQueryClient();

  function rollback() {
    if ((renames.get(guestId)?.inFlight ?? 0) > 1) return;
    writeGuestName(queryClient, {
      guestId,
      displayName: renames.get(guestId)?.confirmed ?? displayName,
    });
  }

  const mutation = useRenameWorkspaceGuest({
    mutation: {
      meta: { suppressErrorToast: true },
      scope: { id: `rename-workspace-guest:${guestId}` },
      onMutate: async (variables) => {
        const current = cachedGuestName(queryClient, guestId) ?? displayName;
        const state = renames.get(guestId) ?? {
          inFlight: 0,
          confirmed: current,
        };
        if (state.inFlight === 0) state.confirmed = current;
        state.inFlight += 1;
        renames.set(guestId, state);
        await queryClient.cancelQueries({
          predicate: inWorkspace(queryClient, workspaceId, holdsGuestName),
        });
        writeGuestName(queryClient, {
          guestId,
          displayName: variables.data?.displayName.trim() ?? displayName,
        });
      },
      onSuccess: async (response) => {
        if (response.status !== 200 || !response.data.success) {
          rollback();
          return;
        }
        const state = renames.get(guestId);
        if (state) state.confirmed = response.data.data.displayName;
        if ((renames.get(guestId)?.inFlight ?? 0) > 1) return;
        await queryClient.cancelQueries({
          predicate: inWorkspace(queryClient, workspaceId, holdsGuestName),
        });
        writeGuestName(queryClient, {
          guestId,
          displayName: response.data.data.displayName,
        });
      },
      onError: () => rollback(),
      onSettled: () => {
        const state = renames.get(guestId);
        if (!state) return;
        state.inFlight -= 1;
        if (state.inFlight <= 0) renames.delete(guestId);
      },
    },
  });

  return {
    isPending: mutation.isPending,
    rename: async (nextName: string): Promise<string | null> => {
      try {
        const response = await mutation.mutateAsync({
          workspaceId,
          guestId,
          data: { displayName: nextName.trim() },
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
