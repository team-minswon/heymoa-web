import { WorkspacePage } from "@/components/workspace/workspace-page";

export default async function WorkspaceRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <WorkspacePage workspaceId={workspaceId} />;
}
