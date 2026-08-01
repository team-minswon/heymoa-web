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
      description="에이전트가 쓸 도구를 워크스페이스 단위로 연결합니다."
    >
      <WorkspaceIntegrationsSettings workspaceId={workspaceId} />
    </SettingsPageShell>
  );
}
