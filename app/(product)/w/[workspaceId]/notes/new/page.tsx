import { redirect } from "next/navigation";

/**
 * 새 회의 진입 주소(APP-802). 외부 에이전트의 「회의를 시작하자」가 이 주소를 돌려준다.
 *
 * **노트를 만들지 않는다.** 워크스페이스 화면으로 넘기면 셸이 그 프로젝트의 새 회의 창을
 * 연다(`?newMeeting=`) — 사람이 제목을 넣고 만들어야 노트가 생기고, 창을 닫으면 아무것도
 * 남지 않는다. 정적 경로라 `[noteId]` 보다 먼저 잡힌다.
 */
export default async function NewMeetingRoute({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ projectId?: string | string[] }>;
}) {
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  const projectId = Array.isArray(query.projectId)
    ? query.projectId[0]
    : query.projectId;
  redirect(
    projectId
      ? `/w/${workspaceId}?newMeeting=${encodeURIComponent(projectId)}`
      : `/w/${workspaceId}`
  );
}
