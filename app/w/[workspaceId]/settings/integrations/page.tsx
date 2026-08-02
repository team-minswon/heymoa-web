import { WorkspaceIntegrationsSettings } from "@/components/settings/workspace-integrations-settings";

export default async function WorkspaceIntegrationsSettingsRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <>
      <WorkspaceIntegrationsSettings workspaceId={workspaceId} />
    </>
  );
}
