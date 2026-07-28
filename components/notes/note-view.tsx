"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { usePersonalChatScope } from "@/components/chat/personal-chat";
import { NotePanel, type NoteTab } from "@/components/notes/note-panel";
import { NoteRouteSurface } from "@/components/notes/note-route-surface";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import {
  deriveMeetingPhase,
  isPersonalChatHiddenInNote,
  type SharedChatPhase,
} from "@/lib/notes/meeting-state";

type NoteViewMode = "side" | "full";

export function normalizeNoteViewQuery(
  query: {
    view?: string | string[];
    tab?: string | string[];
  },
  phase: SharedChatPhase
): { view: NoteViewMode; tab: NoteTab } {
  const view = query.view === "side" ? "side" : "full";
  const rawTab = query.tab;
  // unknown에서는 직링크를 보존한다. 노트를 읽은 뒤 아래 effect가 실제 phase에 맞게 URL도 고친다.
  const tab: NoteTab =
    rawTab === "details"
      ? "details"
      : rawTab === "summary" &&
          (view === "full" || phase === "ended" || phase === "unknown")
        ? "summary"
        : rawTab === "chat" &&
            view === "side" &&
            (phase === "active" || phase === "unknown")
          ? "chat"
          : "transcript";
  return { view, tab };
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
  const search = searchParams.toString();
  const requested = {
    view: searchParams.get("view") ?? initialQuery.view,
    tab: searchParams.get("tab") ?? initialQuery.tab,
  };

  // 개인 챗봇은 side에서 감춰지고, full에서도 공유 챗봇 트레이가 레일을 독차지하는 동안
  // (활성·미시작) 감춰진다. 종료(ENDED)면 우측이 개인 챗봇으로 돌아온다(`TqX06`).
  // unknown(로딩)은 감춰 둔다 — 트레이 자리에 개인 패널이 깜빡이지 않게.
  // 감출 뿐 언마운트하지 않아 흐르던 스트림은 산다.
  const noteQuery = useGetNote(noteId);
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;
  const phase = deriveMeetingPhase(note);
  const current = normalizeNoteViewQuery(requested, phase);
  usePersonalChatScope({
    noteId,
    hidden: isPersonalChatHiddenInNote(
      current.view,
      phase,
      noteQuery.isPending
    ),
  });

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Wait for the initial render to commit before triggering the open transition
    const timer = setTimeout(() => setIsOpen(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (
      (requested.view ?? "full") === current.view &&
      (requested.tab ?? "transcript") === current.tab
    ) {
      return;
    }
    const next = new URLSearchParams(search);
    next.set("view", current.view);
    next.set("tab", current.tab);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [
    current.tab,
    current.view,
    pathname,
    requested.tab,
    requested.view,
    router,
    search,
  ]);

  const closeWithAnim = () => {
    setIsOpen(false);
    // Wait for the exit animation duration before routing
    setTimeout(() => {
      router.push(`/w/${workspaceId}`);
    }, 200);
  };

  const setQuery = (updates: Partial<{ view: NoteViewMode; tab: NoteTab }>) => {
    const next = new URLSearchParams(search);
    const normalized = normalizeNoteViewQuery(
      {
        view: updates.view ?? current.view,
        tab: updates.tab ?? current.tab,
      },
      phase
    );
    next.set("view", normalized.view);
    next.set("tab", normalized.tab);
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
        view={current.view}
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
