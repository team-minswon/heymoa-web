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

/**
 * 더 이상 접근할 수 없는 워크스페이스를 캐시에서 걷어낸다 — 내가 나갔거나 추방당했을 때 쓴다.
 *
 * **무효화만으로는 부족하다.** `invalidateQueries`는 stale 표시일 뿐이라 재조회가 끝날
 * 때까지, 그리고 재조회가 실패하면 영영, 목록에 죽은 워크스페이스가 남는다. 사이드바와 홈의
 * 「대시보드로 이동」이 그걸 그대로 그리고(목록을 staleTime 5분으로 쓴다) 누르면 방금 쫓겨난
 * 곳으로 다시 들어간다. 그래서 **먼저 목록에서 빼고** 재검증한다.
 */
export function forgetWorkspace(queryClient: QueryClient, workspaceId: string) {
  queryClient.removeQueries({
    queryKey: getGetWorkspaceQueryKey(workspaceId),
  });

  queryClient.setQueryData(getGetWorkspacesQueryKey(), (previous: unknown) => {
    const envelope = previous as WorkspaceListEnvelope | undefined;
    const body = envelope?.data;
    const workspaces = body?.data?.workspaces;
    // 캐시가 없거나 실패 봉투면 손대지 않는다 — 곧 이어지는 무효화가 다시 받아온다.
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
