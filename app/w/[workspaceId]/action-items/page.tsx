import { HydrationBoundary } from "@tanstack/react-query";

import { ActionItemsPage } from "@/components/workspace/action-items-page";
import { prefetchActionItems } from "@/lib/workspace/prefetch";

export default async function ActionItemsRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const state = await prefetchActionItems(workspaceId);

  return (
    <HydrationBoundary state={state}>
      <ActionItemsPage workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
