"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { usePersonalChatScope } from "@/components/chat/personal-chat";
import { NotePanel, type NoteTab } from "@/components/notes/note-panel";
import { NoteRouteSurface } from "@/components/notes/note-route-surface";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import {
  deriveMeetingPhase,
  isPersonalChatHiddenInNote,
  MEETING_STATUS_LABEL,
  type SharedChatPhase,
} from "@/lib/notes/meeting-state";

type NoteViewMode = "side" | "full";

export function normalizeNoteViewQuery(
  query: {
    view?: string | string[];
    tab?: string | string[];
  },
  phase: SharedChatPhase,
  sharedTurnActive = false
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
            (phase === "active" ||
              phase === "paused" ||
              phase === "unknown" ||
              sharedTurnActive)
          ? "chat"
          : rawTab === "transcript"
            ? "transcript"
            : // 기본은 정보다 — 회의를 열면 제목·참여자·시각이 먼저 보인다.
              "details";
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

  // 노트 안에서는 개인 챗봇이 **떠 있는 카드로는** 안 뜬다. 전체 화면에서는 레일의
  // 「내 에이전트」 탭이 그 패널을 자기 자리로 포털해 온다(`note-agent-rail`).
  // 감출 뿐 언마운트하지 않아 흐르던 스트림은 산다.
  const noteQuery = useGetNote(noteId);
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;
  const phase = deriveMeetingPhase(note);
  const [sharedTurnActive, setSharedTurnActive] = useState(false);
  const current = normalizeNoteViewQuery(requested, phase, sharedTurnActive);
  usePersonalChatScope({
    noteId,
    hidden: isPersonalChatHiddenInNote(current.view),
  });

  const [isOpen, setIsOpen] = useState(false);
  const pendingSearchRef = useRef<{ from: string; to: string } | null>(null);

  useEffect(() => {
    // Wait for the initial render to commit before triggering the open transition
    const timer = setTimeout(() => setIsOpen(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
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
    if (
      (requested.view ?? "full") === current.view &&
      (requested.tab ?? "details") === current.tab
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
    // 회의 종료 성공 콜백은 쿼리 캐시 구독자가 ENDED로 다시 그리기 직전에 올 수 있다.
    // 여기서 이전 phase로 정규화하면 의도한 summary가 transcript로 유실된다. 이벤트 의도를
    // 먼저 URL에 쓰고, 위 effect가 다음 렌더의 실제 phase로 유효하지 않은 조합만 고친다.
    next.set("view", updates.view ?? current.view);
    next.set("tab", updates.tab ?? current.tab);
    const nextSearch = next.toString();
    if (nextSearch !== search) {
      pendingSearchRef.current = { from: search, to: nextSearch };
    }
    router.replace(`${pathname}?${nextSearch}`, { scroll: false });
  };

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
          aria-label="회의 상태 변경"
          className="sr-only"
        >
          회의 상태가 {MEETING_STATUS_LABEL[note.meetingStatus]}으로
          변경되었습니다.
        </span>
      ) : null}
      <NotePanel
        workspaceId={workspaceId}
        noteId={noteId}
        view={current.view}
        tab={current.tab}
        onTabChange={(tab) => setQuery({ tab })}
        onSharedTurnActiveChange={setSharedTurnActive}
        onClose={closeWithAnim}
        onExpand={
          current.view === "side" ? () => setQuery({ view: "full" }) : undefined
        }
        onCollapse={
          current.view === "full" ? () => setQuery({ view: "side" }) : undefined
        }
        // **replace다.** push하면 목록에서 뒤로가기가 방금 지운 노트 URL로 돌아가 404가 된다.
        onDeleted={() => router.replace(`/w/${workspaceId}`)}
      />
    </NoteRouteSurface>
  );
}
