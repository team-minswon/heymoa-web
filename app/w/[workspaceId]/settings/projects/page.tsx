import {
  ProjectsSettings,
  ProjectsSettingsSkeleton,
} from "@/components/settings/projects-settings";
import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { DataBoundary } from "@/components/ui/data-boundary";

export default async function WorkspaceProjectsSettingsRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <SettingsPageShell
      title="프로젝트"
      description="회의를 담는 프로젝트를 관리합니다."
    >
      <DataBoundary
        fallback={<ProjectsSettingsSkeleton />}
        errorLabel="프로젝트를 불러오지 못했습니다"
        resetKeys={[workspaceId]}
      >
        <ProjectsSettings workspaceId={workspaceId} />
      </DataBoundary>
    </SettingsPageShell>
  );
}
