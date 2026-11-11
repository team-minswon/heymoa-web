import { HydrationBoundary } from "@tanstack/react-query";

import { BillingCheckoutPage } from "@/components/billing/billing-checkout-page";
import { prefetchWorkspaceBilling } from "@/lib/billing/prefetch";

// 카드 변경(APP-1565). 주문서와 같은 화면을 `REPLACE` 로 쓴다 — 카드만 등록하고 지금 청구하지 않는다.
export default async function WorkspaceBillingCardRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const state = await prefetchWorkspaceBilling(workspaceId, { usage: false });
  return (
    <HydrationBoundary state={state}>
      <BillingCheckoutPage workspaceId={workspaceId} purpose="REPLACE" />
    </HydrationBoundary>
  );
}
