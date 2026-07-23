"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { usePersonalChatScope } from "@/components/chat/personal-chat";
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

  // full이면 개인 챗봇이 이 노트 스코프가 되고, side(Sheet)면 감춘다.
  usePersonalChatScope({ noteId, hidden: current.view === "side" });

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Wait for the initial render to commit before triggering the open transition
    const timer = setTimeout(() => setIsOpen(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const closeWithAnim = () => {
    setIsOpen(false);
    // Wait for the exit animation duration before routing
    setTimeout(() => {
      router.push(`/w/${workspaceId}`);
    }, 200);
  };

  const setQuery = (updates: Partial<{ view: NoteViewMode; tab: NoteTab }>) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", updates.view ?? current.view);
    next.set("tab", updates.tab ?? current.tab);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <NoteRouteSurface
      view={current.view}
      isOpen={isOpen}
      onClose={closeWithAnim}
    >
      <NotePanel
        workspaceId={workspaceId}
        noteId={noteId}
        tab={current.tab}
        onTabChange={(tab) => setQuery({ tab })}
        onClose={closeWithAnim}
        onExpand={
          current.view === "side" ? () => setQuery({ view: "full" }) : undefined
        }
      />
    </NoteRouteSurface>
  );
}
