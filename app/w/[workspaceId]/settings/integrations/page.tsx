import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { WorkspaceIntegrationsSettings } from "@/components/settings/workspace-integrations-settings";

export default async function WorkspaceIntegrationsSettingsRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <SettingsPageShell>
      <WorkspaceIntegrationsSettings workspaceId={workspaceId} />
    </SettingsPageShell>
  );
}
