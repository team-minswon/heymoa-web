"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { BillingScreen, BillingSection } from "@/components/billing/billing-screen";
import { billingEvents } from "@/lib/billing/analytics";

/**
 * `/w/{workspaceId}/billing/checkout` — 주문서·동의.
 *
 * 다음 묶음이 채울 자리: 「주문 내용」(공간 이름·테스트 배지·서버가 준 상품 버전과 금액·주기),
 * 「동의」(구매 동의 → `billingEvents.agreementAccepted`, 카드 등록 시작 → `cardSetupStarted`).
 * **금액·상품은 서버 응답만 그린다** — 화면에 값을 적어 두지 않는다. 동의 전에는 구매할 수 없다.
 */
export function BillingCheckoutPage({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("billing.checkout");
  useEffect(() => {
    billingEvents.checkoutEntered(workspaceId);
  }, [workspaceId]);
  return (
    <BillingScreen title={t("title")} description={t("description")}>
      <BillingSection title={t("order")} />
      <BillingSection title={t("agreement")} />
    </BillingScreen>
  );
}
