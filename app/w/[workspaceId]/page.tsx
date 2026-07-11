import { WorkspacePage } from "@/components/workspace/workspace-page";
import { WorkspaceAppShell } from "@/components/workspace/workspace-app-shell";

export default async function WorkspaceRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <WorkspaceAppShell workspaceId={workspaceId}>
      <WorkspacePage workspaceId={workspaceId} />
    </WorkspaceAppShell>
  );
}
