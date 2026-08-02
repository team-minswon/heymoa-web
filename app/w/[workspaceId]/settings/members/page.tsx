import { MembersSettings } from "@/components/settings/members-settings";

export default async function WorkspaceMembersSettingsRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <>
      <MembersSettings workspaceId={workspaceId} />
    </>
  );
}
