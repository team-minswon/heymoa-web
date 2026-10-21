"use client";

import { useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics/track";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { usePersonalChatScope } from "@/components/chat/personal-chat";
import { NotePanel, type NoteTab } from "@/components/notes/note-panel";
import { NoteRouteSurface } from "@/components/notes/note-route-surface";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import {
  deriveMeetingPhase,
  isPersonalChatHiddenInNote,
  MEETING_STATUS_LABEL,
  type MeetingPhase,
} from "@/lib/notes/meeting-state";

type NoteViewMode = "side" | "full";

/** 노트 주소가 서버에 처음 온 모양. `source` 는 메일 링크로 들어왔을 때만 있다(APP-1312). */
export type NoteRouteQuery = { view?: string; tab?: string; source?: "mail" };

/**
 * `view`·`tab`은 라우터를 안 거친다.
 *
 * `router.replace`로 쓰면 Next가 이걸 진짜 내비게이션으로 취급한다 — `page.tsx`가
 * `searchParams`를 읽는 async Server Component라 탭 하나 누를 때마다 `_rsc=` 왕복이 돌고,
 * 서버 페이지가 다시 실행된다. 탭 UI는 URL을 단일 출처로 쓰므로
 * 그 왕복이 끝나야 움직인다(prod·localhost 실측 100~140ms, 실서버는 RTT만큼 더).
 *
 * `window.history.replaceState`는 Next 16이 라우터와 통합해 두어 `useSearchParams`가 그대로
 * 갱신되고 RSC 요청이 아예 안 나간다. 히스토리 의미는 `router.replace`와 같다 — 뒤로가기
 * 항목을 만들지 않는다. 목록으로 나가는 이동은 여전히 진짜 내비게이션이라 `router`를 쓴다.
 */
function replaceNoteSearch(pathname: string, search: string) {
  window.history.replaceState(null, "", `${pathname}?${search}`);
}

/**
 * **되돌아올 자리를 남긴다.** 요약의 근거를 눌러 전사로 건너뛰는 것은 탭을 고르는 것과
 * 다르다 — 각주를 따라간 것이고, 뒤로가기로 읽던 자리에 돌아오는 것이 그 동작의 절반이다.
 * `replaceState`로 쓰면 뒤로가기가 노트 진입 이전으로 나가 노트가 통째로 닫힌다.
 *
 * **탭 클릭에는 안 쓴다.** 탭마다 항목을 쌓으면 다섯 번 누른 사람이 다섯 번 눌러야 나간다.
 */
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
  // unknown에서는 직링크를 보존한다. 노트를 읽은 뒤 아래 effect가 실제 phase에 맞게 URL도 고친다.
  const tab: NoteTab =
    rawTab === "details"
      ? "details"
      : rawTab === "summary" &&
          (view === "full" || phase === "ended" || phase === "unknown")
        ? "summary"
        : rawTab === "transcript"
          ? "transcript"
          : // 「타임라인」. 예전에는 사이드 뷰 전용이라 full 딥링크를 기본 탭으로 접었다.
            rawTab === "context"
            ? "context"
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
  initialQuery: NoteRouteQuery;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const requested = {
    view: searchParams.get("view") ?? initialQuery.view,
    tab: searchParams.get("tab") ?? initialQuery.tab,
  };

  // 노트 안에서는 개인 챗봇이 **떠 있는 카드로는** 안 뜬다. 전체 화면에서는 레일이 그 패널을
  // 자기 자리로 포털해 온다(`note-agent-rail`). 감출 뿐 언마운트하지 않아 흐르던 스트림은 산다.
  const noteQuery = useGetNote(noteId);
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;
  const phase = deriveMeetingPhase(note);
  const current = normalizeNoteViewQuery(requested, phase);
  usePersonalChatScope({
    noteId,
    // **제목까지 넘긴다.** 이 화면이 이미 들고 있는 값이라, 안 넘기면 채팅이 같은 노트를
    // 한 번 더 조회하고 그 왕복(로컬에서도 ~0.9초) 동안 칩이 안 붙는다.
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
    // Wait for the initial render to commit before triggering the open transition
    const timer = setTimeout(() => setIsOpen(true), 10);
    return () => clearTimeout(timer);
  }, []);

  /**
   * 메일 링크로 들어온 진입을 한 번 센다(APP-1312). 목록 행은 누를 때 이미 `source: "list"` 로 보내므로 여기서는
   * 메일만 센다 — 둘이 겹치지 않는다. 같은 화면에서 다시 그려져도 다시 보내지 않게 노트마다 한 번이다.
   */
  const fromMail = initialQuery.source === "mail";
  const mailCountedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!fromMail || mailCountedRef.current === noteId) return;
    mailCountedRef.current = noteId;
    track("note_opened", {
      workspace_id: workspaceId,
      view: current.view,
      source: "mail",
    });
  }, [current.view, fromMail, noteId, workspaceId]);

  useEffect(() => {
    // **첫 커밋 전에는 URL을 안 고친다.** App Router는 자기 effect에서 `history.replaceState`를
    // 패치하는데, 자식 effect가 부모보다 먼저 돌므로 마운트 중에 여기서 쓰면 패치 전 네이티브
    // 호출이 되어 현재 엔트리의 `__NA`와 router tree를 지운다. 지금은 App Router가 마운트
    // 직후 자기 상태를 다시 써서 되살리지만 그건 effect 순서에 기댄 회복이다. `isOpen`은
    // 첫 커밋 뒤 타이머에서 켜지므로 그 시점은 패치보다 확실히 뒤다.
    //
    // 사용자 조작(`setQuery`)은 어차피 마운트 뒤라 이 게이트가 필요 없다.
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
    // 발화 주소(`segment`)는 첫 화면의 점프 대상일 뿐이다. 읽었으면 주소에서 걷는다 — 남기면
    // 새로고침·탭 재방문마다 같은 줄로 끌려가고, 공유한 주소가 지금 보는 자리와 어긋난다.
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
    // Wait for the exit animation duration before routing
    setTimeout(() => {
      router.push(`/w/${workspaceId}`);
    }, 200);
  };

  const setQuery = (
    updates: Partial<{ view: NoteViewMode; tab: NoteTab }>,
    /** 뒤로가기로 되돌아올 자리를 남긴다. 근거 점프에만 쓴다. */
    options?: { push?: boolean }
  ) => {
    // 종료 응답보다 먼저 노트 자체를 떠났다면 이전 노트로 되돌리지 않는다.
    if (activeNoteIdRef.current !== noteId) return;
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
    // 같은 URL이면 밀지 않는다 — 이미 전사 탭인데 또 쌓으면 뒤로가기가 제자리를 돈다.
    if (options?.push && nextSearch !== search) {
      pushNoteSearch(pathname, nextSearch);
      return;
    }
    replaceNoteSearch(pathname, nextSearch);
  };

  /**
   * 메일을 보낸 뒤 회의가 이미 끝났으면 요약 탭으로 보낸다(APP-1312, userflow 「메일 링크로 도착한 사람」).
   * 도착했을 때 한 번만 본다 — 그 뒤 사용자가 고른 탭을 다시 뺏지 않는다.
   */
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
        onTabChange={(tab, options) => setQuery({ tab }, options)}
        onClose={closeWithAnim}
        onExpand={
          current.view === "side" ? () => setQuery({ view: "full" }) : undefined
        }
        onCollapse={
          current.view === "full" ? () => setQuery({ view: "side" }) : undefined
        }
        // **replace다.** push하면 목록에서 뒤로가기가 방금 지운 노트 URL로 돌아가 404가 된다.
        onDeleted={() => router.replace(`/w/${workspaceId}`)}
        fromMail={fromMail}
        // **지금 주소의 값이다.** 서버가 처음 넘긴 값을 쓰면 같은 링크로 다시 들어왔을 때
        // 「읽고 걷힘 → 다시 들어옴」이 값 변화로 안 보여 점프하지 않는다.
        linkedSegmentId={searchParams.get("segment")}
      />
    </NoteRouteSurface>
  );
}
