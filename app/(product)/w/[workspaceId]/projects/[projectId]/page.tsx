import { ProjectAgendaMap, type Focus } from "@/components/projects/project-agenda-map";

export default async function ProjectAgendaMapRoute({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
  searchParams: Promise<{ agenda?: string | string[]; topic?: string | string[] }>;
}) {
  const { workspaceId, projectId } = await params;
  // 처음 자리. 회의록의 「안건 지도에서 보기」와 지도에 남긴 주소가 쓴다(`agenda` 는 옆 패널, `topic` 은 포커스 화면)
  const { agenda, topic } = await searchParams;
  const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
  const focus: Focus | undefined =
    first(agenda) || first(topic) ? { agenda: first(agenda), topic: first(topic) } : undefined;
  return <ProjectAgendaMap workspaceId={workspaceId} projectId={projectId} focus={focus} />;
}
