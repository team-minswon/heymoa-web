import { WorkspaceBillingPage } from "@/components/billing/workspace-billing-page";

export default async function WorkspaceBillingRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <WorkspaceBillingPage workspaceId={workspaceId} />;
}
