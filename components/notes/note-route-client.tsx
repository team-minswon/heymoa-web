"use client";

import { NoteView } from "@/components/notes/note-view";
import { WorkspaceAppShell } from "@/components/workspace/workspace-app-shell";
import { WorkspacePage } from "@/components/workspace/workspace-page";

export function NoteRouteClient({
  workspaceId,
  noteId,
  initialQuery,
}: {
  workspaceId: string;
  noteId: string;
  initialQuery: { view?: string; tab?: string };
}) {
  const isFullScreen = initialQuery.view !== "side";

  return (
    <WorkspaceAppShell
      workspaceId={workspaceId}
      activeNoteId={noteId}
      hideSidebar={isFullScreen}
    >
      <WorkspacePage workspaceId={workspaceId} />
      <NoteView
        workspaceId={workspaceId}
        noteId={noteId}
        initialQuery={initialQuery}
      />
    </WorkspaceAppShell>
  );
}
