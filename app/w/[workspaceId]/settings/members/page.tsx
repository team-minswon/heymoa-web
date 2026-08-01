import { MembersSettings } from "@/components/settings/members-settings";
import { SettingsPageShell } from "@/components/settings/settings-page-shell";

export default async function WorkspaceMembersSettingsRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <SettingsPageShell>
      <MembersSettings workspaceId={workspaceId} />
    </SettingsPageShell>
  );
}
