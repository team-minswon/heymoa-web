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
    <SettingsPageShell
      title="워크스페이스 일반"
      description="이름은 사이드바와 초대 메일에 그대로 나옵니다. 수정은 관리자만 할 수 있습니다."
    >
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
