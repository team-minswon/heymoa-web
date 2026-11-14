import { HydrationBoundary } from "@tanstack/react-query";

import { BillingCheckoutPage } from "@/components/billing/billing-checkout-page";
import { nextMonthlyChargeAt } from "@/lib/billing/next-charge";
import { prefetchCardEntry } from "@/lib/workspace/prefetch";

import { loginRequired } from "../../../login-gate";

// 첫 구독의 전용 결제 페이지(APP-1600). 분석 없는 루트(`app/(card-entry)`), CSP·프레임 금지는 `proxy.ts`·`next.config.ts`.
export default async function BillingCheckoutRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const login = await loginRequired();
  if (login) return login;
  return (
    <HydrationBoundary state={await prefetchCardEntry(workspaceId)}>
      {/* 다음 결제 예정일은 브라우저 시계가 아니라 이 페이지를 만든 서버 시각으로 계산한다. */}
      <BillingCheckoutPage
        workspaceId={workspaceId}
        nextChargeAt={nextMonthlyChargeAt(new Date())}
      />
    </HydrationBoundary>
  );
}
