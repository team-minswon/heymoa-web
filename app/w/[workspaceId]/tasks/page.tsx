import { HydrationBoundary } from "@tanstack/react-query";

import { AllTasks } from "@/components/tasks/all-tasks";
import { prefetchTasksRoute } from "@/lib/workspace/prefetch";

export default async function WorkspaceTasksRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const state = await prefetchTasksRoute({ workspaceId });

  return (
    <HydrationBoundary state={state}>
      <AllTasks workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
