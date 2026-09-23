"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const onNotMember = useCallback(
    () => router.replace(`/w/${workspaceId}`),
    [router, workspaceId]
  );
  return (
    <NoteRealtimeProvider noteId={noteId} onNotMember={onNotMember}>
      <NoteView
        workspaceId={workspaceId}
        noteId={noteId}
        initialQuery={initialQuery}
      />
    </NoteRealtimeProvider>
  );
}
