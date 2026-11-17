import { HydrationBoundary } from "@tanstack/react-query";

import { BillingCheckoutPage } from "@/components/billing/billing-checkout-page";
import { nextMonthlyChargeAt } from "@/lib/billing/next-charge";
import { prefetchCardEntry } from "@/lib/workspace/prefetch";

import { loginRequired } from "../../../login-gate";

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
      <BillingCheckoutPage
        workspaceId={workspaceId}
        nextChargeAt={nextMonthlyChargeAt(new Date())}
      />
    </HydrationBoundary>
  );
}
