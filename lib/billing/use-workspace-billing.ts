import { useTranslations } from "next-intl";

import { useGetWorkspaceBillingSuspense } from "@/lib/api/generated/billing/billing";
import type { WorkspaceBillingResponseData } from "@/lib/api/generated/models";
import { okData } from "@/lib/api/ok-data";

/** 서버가 아직 일하는 중이거나 결과를 확인 중이라 다시 읽을 가치가 있는가. */
export function billingInProgress(billing: WorkspaceBillingResponseData) {
  return (
    billing.allowedActions.includes("REFRESH_STATUS") ||
    billing.latestAttemptStatus === "PENDING" ||
    billing.latestAttemptStatus === "PROCESSING" ||
    billing.latestAttemptStatus === "UNKNOWN"
  );
}

/**
 * 그 공간의 결제 조회(suspense). 키가 공간 id 를 품어서 다른 공간으로 바뀌면 이전 공간의 값을 보여 주지 않고 다시 기다린다
 * (`placeholderData` 를 쓰지 않는다). 항상 새로 읽는다 — 다른 관리자가 바꾸는 상태다.
 */
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
        refetchInterval: refetchInterval
          ? (query) => refetchInterval(okData(query.state.data))
          : undefined,
      },
    }).data
  );
  if (!data) throw new Error(t("loadFailed"));
  return data;
}
