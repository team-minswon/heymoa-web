import { NoteClientBoundary } from "@/components/workspace/workspace-client-boundary";

export default async function NoteRoute({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; noteId: string }>;
  searchParams: Promise<{ view?: string | string[]; tab?: string | string[] }>;
}) {
  const [{ workspaceId, noteId }, query] = await Promise.all([
    params,
    searchParams,
  ]);

  return (
    <NoteClientBoundary
      workspaceId={workspaceId}
      noteId={noteId}
      initialQuery={{
        view: Array.isArray(query.view) ? query.view[0] : query.view,
        tab: Array.isArray(query.tab) ? query.tab[0] : query.tab,
      }}
    />
  );
}
