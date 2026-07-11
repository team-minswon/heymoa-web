"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { NotePanel, type NoteTab } from "@/components/notes/note-panel";
import { NoteRouteSurface } from "@/components/notes/note-route-surface";

type NoteViewMode = "side" | "full";

export function normalizeNoteViewQuery(query: {
  view?: string | string[];
  tab?: string | string[];
}): { view: NoteViewMode; tab: NoteTab } {
  return {
    view: query.view === "side" ? "side" : "full",
    tab: query.tab === "details" ? "details" : "transcript",
  };
}

export function NoteView({
  workspaceId,
  noteId,
  initialQuery,
}: {
  workspaceId: string;
  noteId: string;
  initialQuery: { view?: string; tab?: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = normalizeNoteViewQuery({
    view: searchParams.get("view") ?? initialQuery.view,
    tab: searchParams.get("tab") ?? initialQuery.tab,
  });

  const setQuery = (updates: Partial<{ view: NoteViewMode; tab: NoteTab }>) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", updates.view ?? current.view);
    next.set("tab", updates.tab ?? current.tab);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <NoteRouteSurface workspaceId={workspaceId} view={current.view}>
      <NotePanel
        workspaceId={workspaceId}
        noteId={noteId}
        tab={current.tab}
        onTabChange={(tab) => setQuery({ tab })}
        onClose={() => router.push(`/w/${workspaceId}`)}
        onExpand={
          current.view === "side"
            ? () => setQuery({ view: "full" })
            : undefined
        }
      />
    </NoteRouteSurface>
  );
}
