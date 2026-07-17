import { HydrationBoundary } from "@tanstack/react-query";

import { NoteRouteClient } from "@/components/notes/note-route-client";
import { prefetchNoteRoute } from "@/lib/workspace/prefetch";

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
  const state = await prefetchNoteRoute({ workspaceId, noteId });

  return (
    <HydrationBoundary state={state}>
      <NoteRouteClient
        workspaceId={workspaceId}
        noteId={noteId}
        initialQuery={{
          view: Array.isArray(query.view) ? query.view[0] : query.view,
          tab: Array.isArray(query.tab) ? query.tab[0] : query.tab,
        }}
      />
    </HydrationBoundary>
  );
}
