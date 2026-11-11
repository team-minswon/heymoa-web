import { BillingCheckoutPage } from "@/components/billing/billing-checkout-page";

export default async function WorkspaceBillingCheckoutRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <BillingCheckoutPage workspaceId={workspaceId} />;
}
