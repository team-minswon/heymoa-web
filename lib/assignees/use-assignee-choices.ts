"use client";

import { useMemo } from "react";

import { okData } from "@/lib/api/ok-data";
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";
import { useGetWorkspaceGuests } from "@/lib/api/generated/workspaces/workspaces";
import type { AssigneeChoice } from "@/lib/assignees/describe";

export function useAssigneeChoices(
  workspaceId: string | null | undefined,
  extra: readonly AssigneeChoice[] = []
) {
  const enabled = Boolean(workspaceId);
  const members = useGetWorkspaceMembers(workspaceId ?? "", { query: { enabled } });
  const guests = useGetWorkspaceGuests(workspaceId ?? "", undefined, {
    query: { enabled },
  });

  const memberRows = okData(members.data)?.members ?? null;
  const guestRows = okData(guests.data)?.guests ?? null;

  const choices = useMemo<AssigneeChoice[]>(
    () => [
      ...(memberRows ?? []).map((member) => ({
        type: "USER" as const,
        id: member.userId,
        name: member.name,
        image: member.image,
      })),
      ...(guestRows ?? []).map((guest) => ({
        type: "GUEST" as const,
        id: guest.guestId,
        name: guest.displayName,
      })),
      ...extra,
    ],
    [memberRows, guestRows, extra]
  );

  return {
    choices,
    isPending: members.isPending || guests.isPending,
    failed: members.isError || guests.isError,
    retry: () => {
      void members.refetch();
      void guests.refetch();
    },
  };
}
