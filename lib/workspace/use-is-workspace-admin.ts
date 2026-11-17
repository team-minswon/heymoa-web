import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";

export function useIsWorkspaceAdmin(workspaceId: string) {
  return okData(useGetWorkspace(workspaceId).data)?.role === "ADMIN";
}
