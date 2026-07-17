"use client";

import { NoteView } from "@/components/notes/note-view";

export function NoteRouteClient({
  workspaceId,
  noteId,
  initialQuery,
}: {
  workspaceId: string;
  noteId: string;
  initialQuery: { view?: string; tab?: string };
}) {
  return (
    <NoteView
      workspaceId={workspaceId}
      noteId={noteId}
      initialQuery={initialQuery}
    />
  );
}
