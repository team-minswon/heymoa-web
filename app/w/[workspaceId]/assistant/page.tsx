import { redirect } from "next/navigation";

/**
 * [ROUTES] 가 정한 주소. 개인 에이전트는 **화면이 아니라 레일**이라 목록 위에 얹힌다 —
 * design.pen 의 에이전트 화면들이 전부 `?panel=assistant` 인 이유다.
 * 여기서는 그 자리로 보내기만 한다.
 */
export default async function AssistantRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(`/w/${workspaceId}/meetings?panel=assistant`);
}
