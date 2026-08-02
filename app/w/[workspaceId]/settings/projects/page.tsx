import {
  ProjectsSettings,
  ProjectsSettingsSkeleton,
} from "@/components/settings/projects-settings";
import { DataBoundary } from "@/components/ui/data-boundary";

export default async function WorkspaceProjectsSettingsRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <>
      <DataBoundary
        fallback={<ProjectsSettingsSkeleton />}
        errorLabel="프로젝트를 불러오지 못했습니다"
        resetKeys={[workspaceId]}
      >
        <ProjectsSettings workspaceId={workspaceId} />
      </DataBoundary>
    </>
  );
}
