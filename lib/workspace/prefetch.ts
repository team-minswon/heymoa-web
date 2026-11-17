import "server-only";

import { dehydrate, type DehydratedState } from "@tanstack/react-query";

import { getServerApiRequestOptions } from "@/lib/api/server-request";
import { getGetWorkspaceBillingQueryOptions } from "@/lib/api/generated/billing/billing";
import { getGetProjectsQueryOptions } from "@/lib/api/generated/projects/projects";
import { getGetWorkspaceQueryOptions } from "@/lib/api/generated/workspaces/workspaces";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { makeQueryClient } from "@/lib/query/query-client";

export async function prefetchWorkspaceShell({
  workspaceId,
}: {
  workspaceId: string;
}): Promise<DehydratedState> {
  const queryClient = makeQueryClient();

  // Browser MSW starts after hydration and cannot fulfill Server Component
  // requests. Keep the server snapshot empty in mock mode so both sides agree.
  if (shouldEnableMocking()) {
    return dehydrate(queryClient);
  }

  const request = await getServerApiRequestOptions();
  await Promise.allSettled([
    queryClient.prefetchQuery(
      getGetWorkspaceQueryOptions(workspaceId, { request: request })
    ),
    queryClient.prefetchQuery(
      getGetProjectsQueryOptions(workspaceId, { request: request })
    ),
  ]);
  return dehydrate(queryClient);
}

/** 미리 받지 않으면 서버 렌더가 쿠키 없이 조회하다 401 로 끝나 브라우저가 처음부터 다시 그립니다. */
export async function prefetchCardEntry(
  workspaceId: string
): Promise<DehydratedState> {
  const queryClient = makeQueryClient();
  if (shouldEnableMocking()) return dehydrate(queryClient);
  const request = await getServerApiRequestOptions();
  await Promise.allSettled([
    queryClient.prefetchQuery(
      getGetWorkspaceQueryOptions(workspaceId, { request: request })
    ),
    queryClient.prefetchQuery(
      getGetWorkspaceBillingQueryOptions(workspaceId, { request: request })
    ),
  ]);
  return dehydrate(queryClient);
}
