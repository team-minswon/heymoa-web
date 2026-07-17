import { WorkspaceClientBoundary } from "@/components/workspace/workspace-client-boundary";

export default async function WorkspaceRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <WorkspaceClientBoundary workspaceId={workspaceId} />;
}
