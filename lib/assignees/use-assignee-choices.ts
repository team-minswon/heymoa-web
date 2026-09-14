"use client";

import { useMemo } from "react";

import { okData } from "@/lib/api/ok-data";
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";
import { useGetWorkspaceGuests } from "@/lib/api/generated/workspaces/workspaces";
import type { AssigneeChoice } from "@/lib/assignees/describe";

/**
 * 담당 칸에서 고를 수 있는 사람. **화면 하나가 한 번 부르고 칸마다 내려준다** — 칸마다 부르면
 * 같은 조회를 줄 수만큼 구독한다.
 *
 * 워크스페이스 멤버와 임시 참여자가 기본이고, 검토 화면은 이 회의의 이름 없는 화자를 [extra] 로 더한다.
 */
export function useAssigneeChoices(
  workspaceId: string | null | undefined,
  extra: readonly AssigneeChoice[] = []
) {
  const enabled = Boolean(workspaceId);
  const members = useGetWorkspaceMembers(workspaceId ?? "", { query: { enabled } });
  const guests = useGetWorkspaceGuests(workspaceId ?? "", { query: { enabled } });

  const memberRows = okData(members.data)?.members ?? null;
  const guestRows = okData(guests.data)?.guests ?? null;

  const choices = useMemo<AssigneeChoice[]>(
    () => [
      ...(memberRows ?? []).map((member) => ({
        type: "USER" as const,
        id: member.userId,
        name: member.name,
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
    /** 사람 목록을 못 읽었다. 빈 선택지와 다르다 — 화면이 다시 불러올 길을 둔다 */
    failed: members.isError || guests.isError,
    retry: () => {
      void members.refetch();
      void guests.refetch();
    },
  };
}
