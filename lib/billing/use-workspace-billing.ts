import { useTranslations } from "next-intl";

import { useGetWorkspaceBillingSuspense } from "@/lib/api/generated/billing/billing";
import type { WorkspaceBillingResponseData } from "@/lib/api/generated/models";
import { okData } from "@/lib/api/ok-data";
import { refundPending } from "@/lib/billing/payment-status";

export function billingInProgress(billing: WorkspaceBillingResponseData) {
  return (
    billing.allowedActions.includes("REFRESH_STATUS") ||
    billing.latestAttemptStatus === "PENDING" ||
    billing.latestAttemptStatus === "PROCESSING" ||
    billing.latestAttemptStatus === "UNKNOWN"
  );
}

export function billingNeedsRereading(billing: WorkspaceBillingResponseData) {
  return (
    billingInProgress(billing) ||
    refundPending(billing.detail?.refundedAttempt?.refundStatus)
  );
}

export function useWorkspaceBilling(
  workspaceId: string,
  refetchInterval?: (
    data: WorkspaceBillingResponseData | null
  ) => number | false
) {
  const t = useTranslations("billing");
  const data = okData(
    useGetWorkspaceBillingSuspense(workspaceId, {
      query: {
        staleTime: 0,
        refetchOnWindowFocus: true,
        refetchInterval: refetchInterval
          ? (query) => refetchInterval(okData(query.state.data))
          : undefined,
      },
    }).data
  );
  if (!data) throw new Error(t("loadFailed"));
  return data;
}
