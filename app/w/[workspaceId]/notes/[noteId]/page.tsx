import { NoteView } from "@/components/notes/note-view";
import { WorkspaceAppShell } from "@/components/workspace/workspace-app-shell";

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
    <WorkspaceAppShell workspaceId={workspaceId} activeNoteId={noteId}>
      <NoteView
        workspaceId={workspaceId}
        noteId={noteId}
        initialQuery={{
          view: Array.isArray(query.view) ? query.view[0] : query.view,
          tab: Array.isArray(query.tab) ? query.tab[0] : query.tab,
        }}
      />
    </WorkspaceAppShell>
  );
}
