import { redirect } from "next/navigation";

/**
 * 회의 목록의 정본 주소는 `/w/{workspaceId}/meetings` 다. 워크스페이스 루트는 거기로 보낸다 —
 * 두 주소가 같은 화면을 그리면 「지금 어디인가」가 둘이 되고 사이드바 강조도 갈린다.
 */
export default async function WorkspaceRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(`/w/${workspaceId}/meetings`);
}
