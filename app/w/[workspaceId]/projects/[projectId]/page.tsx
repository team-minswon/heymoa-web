import { HydrationBoundary } from "@tanstack/react-query";

import { ProjectTimelinePage } from "@/components/workspace/project-timeline-page";
import { prefetchProjectTimeline } from "@/lib/workspace/prefetch";

export default async function ProjectTimelineRoute({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = await params;
  const state = await prefetchProjectTimeline(projectId);

  return (
    <HydrationBoundary state={state}>
      <ProjectTimelinePage workspaceId={workspaceId} projectId={projectId} />
    </HydrationBoundary>
  );
}
