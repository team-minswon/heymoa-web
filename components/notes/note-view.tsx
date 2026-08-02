"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  usePersonalChat,
  usePersonalChatScope,
} from "@/components/chat/personal-chat";
import { NotePanel, type NoteTab } from "@/components/notes/note-panel";
import { NoteRouteSurface } from "@/components/notes/note-route-surface";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import {
  deriveMeetingPhase,
  hasSharedRail,
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
  // (활성·미시작·중지) 감춰진다. 종료(ENDED)면 우측이 개인 챗봇으로 돌아온다(`TqX06`).
  // unknown(로딩)은 감춰 둔다 — 트레이 자리에 개인 패널이 깜빡이지 않게.
  // 감출 뿐 언마운트하지 않아 흐르던 스트림은 산다.
  const noteQuery = useGetNote(noteId);
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;
  const phase = deriveMeetingPhase(note);
  const [sharedTurnActive, setSharedTurnActive] = useState(false);
  const current = normalizeNoteViewQuery(requested, phase, sharedTurnActive);
  const personalChat = usePersonalChat();
  const noteRailAvailable = hasSharedRail(
    current.view,
    phase,
    noteQuery.isPending
  );
  usePersonalChatScope({
    noteId,
    // side 시트에서는 개인 챗봇을 **열 수 없다.** 시트는 목록 위에 얹히는 얕은 표면이고
    // 레일은 노트 전체 화면의 것이다(D12 · DESIGN.md 「우측 레일」). 목록에서 열어 둔 채로
    // 들어와도 감춘다 — 그래서 `isOpen` 이 못 이긴다.
    //
    // full 에서는 공유 챗봇이 레일을 쓰는 동안 감추되, 사용자가 탭으로 직접 부르면 그쪽이
    // 이긴다. 그러지 않으면 「내 에이전트」 탭이 눌려도 아무것도 안 뜬다.
    hidden:
      current.view === "side" ||
      (!personalChat.isOpen &&
        isPersonalChatHiddenInNote(current.view, phase, noteQuery.isPending)),
    hasNoteRail: noteRailAvailable,
    // 노트 전체 화면은 우측 레일이 늘 서 있는 화면이다. 살아 있는 회의는 공유 챗봇이 그 자리를
    // 쓰고(`sharedRailVisible` 기본 참), 종료돼 공유 레일이 없으면 개인 에이전트가 대신 선다.
    //
    // **턴이 도는 중에는 안 편다.** 답변이 흐르는 중에 다른 멤버가 회의를 끝내면
    // `noteRailAvailable`이 즉시 거짓이 되는데, 여기서 개인 레일을 펴면 공유 패널이 마운트된
    // 채로 가려져 사용자는 흐르던 답변의 나머지를 못 본다. 턴이 끝난 뒤에 편다.
    autoOpen:
      current.view === "full" && !noteRailAvailable && !sharedTurnActive,
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
      router.push(`/w/${workspaceId}/meetings`);
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
        onViewChange={(view) => setQuery({ view })}
        onOpenAgentRail={personalChat.open}
        agentRailOpen={personalChat.isOpen}
        onSharedTurnActiveChange={setSharedTurnActive}
        onClose={closeWithAnim}
        onExpand={
          current.view === "side" ? () => setQuery({ view: "full" }) : undefined
        }
      />
    </NoteRouteSurface>
  );
}
