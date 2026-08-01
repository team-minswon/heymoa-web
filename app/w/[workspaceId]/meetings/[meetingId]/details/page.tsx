import { redirect } from "next/navigation";

/**
 * [ROUTES] 가 정한 주소. 링크로 받은 사람이 **도착하는** 자리이고, 머무는 자리는 아니다 —
 * 탭을 경로로 유지하면 탭 전환이 라우트 전환이 되고, 이 셸에 붙은 녹음 소켓과 STOMP 구독이
 * 흔들린다(회의 종료→분석 전환이 실제로 깨졌다).
 */
export default async function DetailsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; meetingId: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [{ workspaceId, meetingId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const view =
    (Array.isArray(query.view) ? query.view[0] : query.view) ?? "full";
  redirect(
    `/w/${workspaceId}/meetings/${meetingId}?view=${view}&tab=details`
  );
}
