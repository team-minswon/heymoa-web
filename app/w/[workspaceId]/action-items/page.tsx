import { ActionItemsPage } from "@/components/workspace/action-items-page";

export default async function ActionItemsRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <ActionItemsPage workspaceId={workspaceId} />;
}
