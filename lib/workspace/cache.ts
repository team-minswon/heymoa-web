import type { QueryClient } from "@tanstack/react-query";

import {
  getGetWorkspaceQueryKey,
  getGetWorkspacesQueryKey,
} from "@/lib/api/generated/workspaces/workspaces";

type WorkspaceListEnvelope = {
  data?: {
    data?: { workspaces?: { workspaceId: string }[] };
  };
};

/** `invalidateQueries` 는 stale 표시뿐이라 재조회가 실패하면 죽은 워크스페이스가 남아 먼저 목록에서 뺍니다. */
export function forgetWorkspace(queryClient: QueryClient, workspaceId: string) {
  queryClient.removeQueries({
    queryKey: getGetWorkspaceQueryKey(workspaceId),
  });

  queryClient.setQueryData(getGetWorkspacesQueryKey(), (previous: unknown) => {
    const envelope = previous as WorkspaceListEnvelope | undefined;
    const body = envelope?.data;
    const workspaces = body?.data?.workspaces;
    if (!envelope || !body?.data || !workspaces) return previous;

    return {
      ...envelope,
      data: {
        ...body,
        data: {
          ...body.data,
          workspaces: workspaces.filter(
            (workspace) => workspace.workspaceId !== workspaceId
          ),
        },
      },
    };
  });

  void queryClient.invalidateQueries({ queryKey: getGetWorkspacesQueryKey() });
}
