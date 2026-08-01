import { MembersSettings } from "@/components/settings/members-settings";
import { SettingsPageShell } from "@/components/settings/settings-page-shell";

export default async function WorkspaceMembersSettingsRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <SettingsPageShell
      title="멤버"
      description="워크스페이스 멤버와 초대를 관리합니다."
    >
      <MembersSettings workspaceId={workspaceId} />
    </SettingsPageShell>
  );
}
