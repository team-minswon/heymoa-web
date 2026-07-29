"use client";

import { NoteView } from "@/components/notes/note-view";
import { NoteRealtimeProvider } from "@/components/notes/note-realtime-provider";

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
    <NoteRealtimeProvider noteId={noteId}>
      <NoteView
        workspaceId={workspaceId}
        noteId={noteId}
        initialQuery={initialQuery}
      />
    </NoteRealtimeProvider>
  );
}
