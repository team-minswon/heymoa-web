import "server-only";

import { dehydrate, type DehydratedState } from "@tanstack/react-query";

import {
  getGetRecordingUsageQueryOptions,
  getGetWorkspaceBillingQueryOptions,
} from "@/lib/api/generated/billing/billing";
import { getServerApiRequestOptions } from "@/lib/api/server-request";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { makeQueryClient } from "@/lib/query/query-client";

/**
 * 요금제·주문서 화면의 첫 렌더에 필요한 조회를 서버에서 미리 읽는다. 이 화면들은 suspense 조회를 쓰는데, 미리 읽어 두지 않으면
 * 서버 렌더 중에 쿠키 없는 요청이 나가 401 → 갱신 실패로 서버 렌더가 깨지고 클라이언트 렌더로 떨어진다.
 * 실패한 조회는 싣지 않으니(`allSettled`) 그때는 클라이언트가 다시 읽는다. 목 모드는 `prefetchWorkspaceShell` 과 같이 비운다.
 */
export async function prefetchWorkspaceBilling(
  workspaceId: string,
  { usage }: { usage: boolean }
): Promise<DehydratedState> {
  const queryClient = makeQueryClient();
  if (shouldEnableMocking()) return dehydrate(queryClient);

  const request = await getServerApiRequestOptions();
  await Promise.allSettled([
    queryClient.prefetchQuery(
      getGetWorkspaceBillingQueryOptions(workspaceId, { request })
    ),
    usage
      ? queryClient.prefetchQuery(
          getGetRecordingUsageQueryOptions(workspaceId, { request })
        )
      : null,
  ]);
  return dehydrate(queryClient);
}
