"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { NoteView, type NoteRouteQuery } from "@/components/notes/note-view";
import { NoteRealtimeProvider } from "@/components/notes/note-realtime-provider";
import { DesktopMeetingTimelineReporter } from "@/components/transcription/desktop-meeting-timeline";

export function NoteRouteClient({
  workspaceId,
  noteId,
  initialQuery,
}: {
  workspaceId: string;
  noteId: string;
  initialQuery: NoteRouteQuery;
}) {
  const router = useRouter();
  const onNotMember = useCallback(
    () => router.replace(`/w/${workspaceId}`),
    [router, workspaceId]
  );
  return (
    <NoteRealtimeProvider noteId={noteId} onNotMember={onNotMember}>
      <DesktopMeetingTimelineReporter />
      <NoteView
        workspaceId={workspaceId}
        noteId={noteId}
        initialQuery={initialQuery}
      />
    </NoteRealtimeProvider>
  );
}
