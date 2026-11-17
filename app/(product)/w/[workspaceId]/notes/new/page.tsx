import { redirect } from "next/navigation";

export default async function NewMeetingRoute({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ projectId?: string | string[] }>;
}) {
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  const projectId = Array.isArray(query.projectId)
    ? query.projectId[0]
    : query.projectId;
  redirect(
    projectId
      ? `/w/${workspaceId}?newMeeting=${encodeURIComponent(projectId)}`
      : `/w/${workspaceId}`
  );
}
