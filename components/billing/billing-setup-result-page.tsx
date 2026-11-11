"use client";

import { useTranslations } from "next-intl";

import { BillingScreen, BillingSection } from "@/components/billing/billing-screen";

/**
 * `/billing/setups/{setupId}` — 카드 등록 결과. 워크스페이스 셸 밖이다(PG 복귀 뒤 깨끗한 주소).
 *
 * 다음 묶음이 채울 자리: 원 등록자가 로그인한 채 setup 진행을 조회하고(`setupId` 만 쓴다), 완료를 재개하며,
 * 결과(`completed`·`declined`·`unknown`)를 그린다. 결과가 보이면 `billingEvents.cardSetupResulted`,
 * 「다시 결제」는 `retryClicked`. 주소에는 authKey·state 가 없고, 이 화면도 그 값을 읽거나 저장하지 않는다.
 */
export function BillingSetupResultPage({ setupId }: { setupId: string }) {
  const t = useTranslations("billing.setup");
  return (
    <BillingScreen title={t("title")} description={t("description")}>
      <div data-setup-id={setupId} className="contents">
        <BillingSection title={t("result")} />
      </div>
    </BillingScreen>
  );
}
