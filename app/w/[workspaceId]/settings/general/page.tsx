import { DataBoundary } from "@/components/ui/data-boundary";
import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import {
  WorkspaceSettingsForm,
  WorkspaceSettingsFormSkeleton,
} from "@/components/settings/workspace-settings-form";

export default async function WorkspaceGeneralSettingsRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <SettingsPageShell>
      <DataBoundary
        fallback={<WorkspaceSettingsFormSkeleton />}
        errorLabel="워크스페이스 정보를 불러오지 못했습니다"
        resetKeys={[workspaceId]}
      >
        <WorkspaceSettingsForm workspaceId={workspaceId} />
      </DataBoundary>
    </SettingsPageShell>
  );
}
