import { ProjectAgendaMap, type Focus } from "@/components/projects/project-agenda-map";

export default async function ProjectAgendaMapRoute({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
  searchParams: Promise<{ agenda?: string | string[]; topic?: string | string[] }>;
}) {
  const { workspaceId, projectId } = await params;
  const { agenda, topic } = await searchParams;
  const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
  const focus: Focus | undefined =
    first(agenda) || first(topic) ? { agenda: first(agenda), topic: first(topic) } : undefined;
  return <ProjectAgendaMap workspaceId={workspaceId} projectId={projectId} focus={focus} />;
}
