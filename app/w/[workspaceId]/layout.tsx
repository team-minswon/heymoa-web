import { HydrationBoundary } from "@tanstack/react-query";

import { WorkspaceRouteLayout } from "@/components/workspace/workspace-route-layout";
import { prefetchWorkspaceShell } from "@/lib/workspace/prefetch";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const state = await prefetchWorkspaceShell({ workspaceId });

  return (
    <HydrationBoundary state={state}>
      <WorkspaceRouteLayout workspaceId={workspaceId}>
        {children}
      </WorkspaceRouteLayout>
    </HydrationBoundary>
  );
}
