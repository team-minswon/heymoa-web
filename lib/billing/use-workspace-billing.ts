import { useTranslations } from "next-intl";

import { useGetWorkspaceBillingSuspense } from "@/lib/api/generated/billing/billing";
import type { WorkspaceBillingResponseData } from "@/lib/api/generated/models";
import { okData } from "@/lib/api/ok-data";
import { refundPending } from "@/lib/billing/payment-status";

/** 서버가 아직 일하는 중이거나 결과를 확인 중이라 다시 읽을 가치가 있는가. */
export function billingInProgress(billing: WorkspaceBillingResponseData) {
  return (
    billing.allowedActions.includes("REFRESH_STATUS") ||
    billing.latestAttemptStatus === "PENDING" ||
    billing.latestAttemptStatus === "PROCESSING" ||
    billing.latestAttemptStatus === "UNKNOWN"
  );
}

/** 화면이 자동으로 다시 읽을 상태 — 진행 중이거나, 운영자 환불(`REFRESH_STATUS` 가 없다)의 취소 처리 중. */
export function billingNeedsRereading(billing: WorkspaceBillingResponseData) {
  return (
    billingInProgress(billing) ||
    refundPending(billing.detail?.refundedAttempt?.refundStatus)
  );
}

/**
 * 그 공간의 결제 조회(suspense). 키가 공간 id 를 품어서 다른 공간으로 바뀌면 이전 공간의 값을 보여 주지 않고 다시 기다린다
 * (`placeholderData` 를 쓰지 않는다). 항상 새로 읽는다 — 다른 관리자가 바꾸는 상태다. 창으로 돌아올 때도 다시 읽는다
 * (전역 기본은 끔) — 다른 탭·기기에서 해지·카드 변경을 했으면 그 버튼을 그대로 두지 않는다.
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
