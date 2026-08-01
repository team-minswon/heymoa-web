import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { WorkspaceIntegrationsSettings } from "@/components/settings/workspace-integrations-settings";

export default async function WorkspaceIntegrationsSettingsRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <SettingsPageShell
      title="연동"
      description="챗봇이 회의에서 이슈를 만들거나 조회할 때 이 워크스페이스의 연동을 씁니다."
    >
      <WorkspaceIntegrationsSettings workspaceId={workspaceId} />
    </SettingsPageShell>
  );
}
