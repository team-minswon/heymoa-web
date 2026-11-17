import type { QueryClient } from "@tanstack/react-query";

import {
  getGetRecordingUsageQueryKey,
  getGetWorkspaceBillingQueryKey,
} from "@/lib/api/generated/billing/billing";

export function invalidateWorkspaceBilling(
  queryClient: QueryClient,
  workspaceId: string
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: getGetWorkspaceBillingQueryKey(workspaceId),
    }),
    queryClient.invalidateQueries({
      queryKey: getGetRecordingUsageQueryKey(workspaceId),
    }),
  ]);
}
