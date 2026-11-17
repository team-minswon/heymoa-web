import { NoteRouteClient } from "@/components/notes/note-route-client";

export default async function NoteRoute({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; noteId: string }>;
  searchParams: Promise<{
    view?: string | string[];
    tab?: string | string[];
    utm_medium?: string | string[];
    source?: string | string[];
  }>;
}) {
  const [{ workspaceId, noteId }, query] = await Promise.all([
    params,
    searchParams,
  ]);

  return (
    <NoteRouteClient
      workspaceId={workspaceId}
      noteId={noteId}
      initialQuery={{
        view: Array.isArray(query.view) ? query.view[0] : query.view,
        tab: Array.isArray(query.tab) ? query.tab[0] : query.tab,
        ...([query.utm_medium].flat().includes("email")
          ? { source: "mail" as const }
          : [query.source].flat().includes("notification")
            ? { source: "notification" as const }
            : {}),
      }}
    />
  );
}
