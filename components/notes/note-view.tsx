"use client";

import { useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics/track";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { usePersonalChatScope } from "@/components/chat/personal-chat";
import { NotePanel, type NoteTab } from "@/components/notes/note-panel";
import { NoteRouteSurface } from "@/components/notes/note-route-surface";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import {
  deriveMeetingPhase,
  isPersonalChatHiddenInNote,
  MEETING_STATUS_KEY,
  type MeetingPhase,
} from "@/lib/notes/meeting-state";

type NoteViewMode = "side" | "full";

export type NoteRouteQuery = {
  view?: string;
  tab?: string;
  source?: "mail" | "notification";
};

/**
 * `view`·`tab`은 라우터를 안 거친다. `router.replace` 는 Next 가 진짜 내비게이션으로 다뤄 탭마다 `_rsc=` 왕복이 돈다.
 * `window.history.replaceState` 는 Next 16 이 라우터와 통합해 `useSearchParams` 가 갱신되고 RSC 요청이 안 나간다.
 */
function replaceNoteSearch(pathname: string, search: string) {
  window.history.replaceState(null, "", `${pathname}?${search}`);
}

function pushNoteSearch(pathname: string, search: string) {
  window.history.pushState(null, "", `${pathname}?${search}`);
}

export function normalizeNoteViewQuery(
  query: {
    view?: string | string[];
    tab?: string | string[];
  },
  phase: MeetingPhase
): { view: NoteViewMode; tab: NoteTab } {
  const view = query.view === "side" ? "side" : "full";
  const rawTab = query.tab;
  const tab: NoteTab =
    rawTab === "details"
      ? "details"
      : rawTab === "summary" &&
          (view === "full" || phase === "ended" || phase === "unknown")
        ? "summary"
        : rawTab === "transcript"
          ? "transcript"
          : rawTab === "context"
            ? "context"
            : "details";
  return { view, tab };
}

export function NoteView({
  workspaceId,
  noteId,
  initialQuery,
}: {
  workspaceId: string;
  noteId: string;
  initialQuery: NoteRouteQuery;
}) {
  const router = useRouter();
  const t = useTranslations("notes.view");
  const tStatus = useTranslations("common.meetingStatus");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const requested = {
    view: searchParams.get("view") ?? initialQuery.view,
    tab: searchParams.get("tab") ?? initialQuery.tab,
  };

  const noteQuery = useGetNote(noteId);
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;
  const phase = deriveMeetingPhase(note);
  const current = normalizeNoteViewQuery(requested, phase);
  usePersonalChatScope({
    noteId,
    title: note?.title ?? null,
    hidden: isPersonalChatHiddenInNote(current.view),
  });

  const [isOpen, setIsOpen] = useState(false);
  const pendingSearchRef = useRef<{ from: string; to: string } | null>(null);
  const activeNoteIdRef = useRef<string | null>(noteId);
  useEffect(() => {
    activeNoteIdRef.current = noteId;
    return () => {
      activeNoteIdRef.current = null;
    };
  }, [noteId]);

  useEffect(() => {
    const timer = setTimeout(() => setIsOpen(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const source = initialQuery.source;
  const fromMail = source === "mail";
  const sourceCountedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!source || sourceCountedRef.current === noteId) return;
    sourceCountedRef.current = noteId;
    track("note_opened", {
      workspace_id: workspaceId,
      view: current.view,
      source,
    });
  }, [current.view, source, noteId, workspaceId]);

  useEffect(() => {
    // 첫 커밋 전에는 URL을 안 고친다. App Router 는 자기 effect 에서 `history.replaceState` 를 패치하는데 자식 effect 가 먼저 돌아,
    // 마운트 중에 쓰면 패치 전 네이티브 호출이 되어 현재 엔트리의 `__NA` 와 router tree 를 지운다.
    if (!isOpen) return;

    const pendingSearch = pendingSearchRef.current;
    if (pendingSearch) {
      if (search === pendingSearch.to) {
        pendingSearchRef.current = null;
      } else if (search === pendingSearch.from) {
        return;
      } else {
        pendingSearchRef.current = null;
      }
    }
    const hasSegment = new URLSearchParams(search).has("segment");
    if (
      !hasSegment &&
      (requested.view ?? "full") === current.view &&
      (requested.tab ?? "details") === current.tab
    ) {
      return;
    }
    const next = new URLSearchParams(search);
    next.set("view", current.view);
    next.set("tab", current.tab);
    next.delete("segment");
    replaceNoteSearch(pathname, next.toString());
  }, [
    current.tab,
    current.view,
    isOpen,
    pathname,
    requested.tab,
    requested.view,
    search,
  ]);

  const closeWithAnim = () => {
    setIsOpen(false);
    setTimeout(() => {
      router.push(`/w/${workspaceId}`);
    }, 200);
  };

  const setQuery = (
    updates: Partial<{ view: NoteViewMode; tab: NoteTab }>,
    options?: { push?: boolean }
  ) => {
    if (activeNoteIdRef.current !== noteId) return;
    const next = new URLSearchParams(search);
    next.set("view", updates.view ?? current.view);
    next.set("tab", updates.tab ?? current.tab);
    const nextSearch = next.toString();
    if (nextSearch !== search) {
      pendingSearchRef.current = { from: search, to: nextSearch };
    }
    if (options?.push && nextSearch !== search) {
      pushNoteSearch(pathname, nextSearch);
      return;
    }
    replaceNoteSearch(pathname, nextSearch);
  };

  const mailLandedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!fromMail || !isOpen || phase === "unknown") return;
    if (mailLandedRef.current === noteId) return;
    mailLandedRef.current = noteId;
    if (phase === "ended" && current.tab !== "summary") {
      setQuery({ tab: "summary" });
    }
  });

  return (
    <NoteRouteSurface
      view={current.view}
      isOpen={isOpen}
      onClose={closeWithAnim}
    >
      {note ? (
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={t("statusChange.label")}
          className="sr-only"
        >
          {t("statusChange.message", {
            status: tStatus(MEETING_STATUS_KEY[note.meetingStatus]),
          })}
        </span>
      ) : null}
      <NotePanel
        workspaceId={workspaceId}
        noteId={noteId}
        view={current.view}
        tab={current.tab}
        onTabChange={(tab, options) => setQuery({ tab }, options)}
        onClose={closeWithAnim}
        onExpand={
          current.view === "side" ? () => setQuery({ view: "full" }) : undefined
        }
        onCollapse={
          current.view === "full" ? () => setQuery({ view: "side" }) : undefined
        }
        onDeleted={() => router.replace(`/w/${workspaceId}`)}
        fromMail={fromMail}
        linkedSegmentId={searchParams.get("segment")}
      />
    </NoteRouteSurface>
  );
}
