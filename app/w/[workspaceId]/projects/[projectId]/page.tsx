import { ProjectTimelinePage } from "@/components/workspace/project-timeline-page";

export default async function ProjectTimelineRoute({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = await params;
  return (
    <ProjectTimelinePage workspaceId={workspaceId} projectId={projectId} />
  );
}
