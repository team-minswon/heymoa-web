import { HydrationBoundary } from "@tanstack/react-query";

import { BillingCheckoutPage } from "@/components/billing/billing-checkout-page";
import { prefetchWorkspaceBilling } from "@/lib/billing/prefetch";

export default async function WorkspaceBillingCheckoutRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const state = await prefetchWorkspaceBilling(workspaceId, { usage: false });
  return (
    <HydrationBoundary state={state}>
      <BillingCheckoutPage workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
