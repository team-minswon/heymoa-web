import { AllTasks } from "@/components/tasks/all-tasks";

export default async function WorkspaceTasksRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <AllTasks workspaceId={workspaceId} />;
}
