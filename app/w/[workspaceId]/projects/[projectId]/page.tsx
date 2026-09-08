import { ProjectConceptSummary } from "@/components/workspace/project-concept-summary";

/**
 * 프로젝트 개념 요약 route. 워크스페이스 셸(`app/w/[workspaceId]/layout.tsx`) 안에서
 * 노트 목록 위에 면으로 열린다 — 노트 route 와 같은 자리다. Server Component 는 params 만
 * 읽는다. 요약 조회는 계약이 아직 제안이라 server prefetch 를 걸지 않는다(`ADAPTER.md`).
 */
export default async function ProjectRoute({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = await params;
  return <ProjectConceptSummary workspaceId={workspaceId} projectId={projectId} />;
}
