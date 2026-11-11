"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { BillingScreen, BillingSection } from "@/components/billing/billing-screen";
import { billingEvents } from "@/lib/billing/analytics";

/**
 * `/w/{workspaceId}/billing` — 요금제와 현재 상태.
 *
 * 다음 묶음(API 연결)이 채울 자리: 「현재 상태」(플랜·잔여량, ADMIN 에게는 청구·관리 추가),
 * 「요금제」(상품 비교 + 주문서로 가는 링크 `/w/{workspaceId}/billing/checkout`).
 * Free·ENDED 는 정상 상태이고, 진행 중·확인 중 업무가 있으면 새 주문서 대신 기존 결과로 보낸다.
 */
export function WorkspaceBillingPage({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("billing.page");
  useEffect(() => {
    billingEvents.plansViewed(workspaceId);
  }, [workspaceId]);
  return (
    <BillingScreen title={t("title")} description={t("description")}>
      <BillingSection title={t("status")} />
      <BillingSection title={t("plans")} />
    </BillingScreen>
  );
}
