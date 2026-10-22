import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";

/**
 * 지금 사용자가 이 워크스페이스의 ADMIN 인가. 모르는 동안(불러오는 중·실패)은 `false` — 관리자 전용 조작은
 * 역할이 확정된 뒤에만 보인다. 서버가 다시 검사하므로 이것은 화면 표시용이다.
 */
export function useIsWorkspaceAdmin(workspaceId: string) {
  return okData(useGetWorkspace(workspaceId).data)?.role === "ADMIN";
}
