import type { QueryClient } from "@tanstack/react-query";

import { getGetWorkspaceBillingQueryKey } from "@/lib/api/generated/billing/billing";

/** 그 공간의 결제 조회만 다시 읽게 한다. 다른 공간의 키는 건드리지 않는다. */
export function invalidateWorkspaceBilling(
  queryClient: QueryClient,
  workspaceId: string
) {
  return queryClient.invalidateQueries({
    queryKey: getGetWorkspaceBillingQueryKey(workspaceId),
  });
}
