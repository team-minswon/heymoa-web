import { HydrationBoundary } from "@tanstack/react-query";

import { BillingPaymentPage } from "@/components/billing/billing-payment-page";
import { prefetchWorkspaceBilling } from "@/lib/billing/prefetch";

// 공간 결제 상세(APP-1565, ADMIN). 결제 조회는 404·403 을 화면이 그리므로 미리 읽지 않고 요금제 조회만 미리 읽는다.
export default async function WorkspaceBillingPaymentRoute({
  params,
}: {
  params: Promise<{ workspaceId: string; paymentId: string }>;
}) {
  const { workspaceId, paymentId } = await params;
  const state = await prefetchWorkspaceBilling(workspaceId, { usage: false });
  return (
    <HydrationBoundary state={state}>
      <BillingPaymentPage workspaceId={workspaceId} paymentId={paymentId} />
    </HydrationBoundary>
  );
}
