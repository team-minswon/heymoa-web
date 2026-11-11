import { HydrationBoundary } from "@tanstack/react-query";

import { WorkspaceBillingPage } from "@/components/billing/workspace-billing-page";
import { prefetchWorkspaceBilling } from "@/lib/billing/prefetch";

export default async function WorkspaceBillingRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const state = await prefetchWorkspaceBilling(workspaceId, { usage: true });
  return (
    <HydrationBoundary state={state}>
      <WorkspaceBillingPage workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
