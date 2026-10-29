"use client";

import { useState } from "react";

import { ProjectViewBody, ProjectViewTabs } from "@/components/projects/project-view-tabs";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { DesktopAppPromo } from "@/components/workspace/desktop-app-promo";
import { WorkspaceNoteList } from "@/components/workspace/workspace-note-list";
import { WorkspaceOnboarding } from "@/components/workspace/workspace-onboarding";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import { isMeetingActive } from "@/lib/notes/meeting-state";
import { cn } from "@/lib/utils";
import { useNoteListPages } from "@/lib/workspace/use-note-list-pages";
import { useEventStreamHealthy } from "@/lib/events/health";
import { hintedInterval } from "@/lib/events/interval";

export const ACTIVE_NOTE_LIST_POLL_MS = 10_000;
export const INACTIVE_NOTE_LIST_POLL_MS = 30_000;

export function noteListRefetchInterval(
  notes: NoteListResponseDataNotesItem[] | undefined
): number {
  return notes?.some(isMeetingActive)
    ? ACTIVE_NOTE_LIST_POLL_MS
    : INACTIVE_NOTE_LIST_POLL_MS;
}

export function WorkspacePage({ workspaceId }: { workspaceId: string }) {
  const {
    selectedProjectId,
    projects,
    isWorkspacePending,
    isWorkspaceError,
    openCreateProject,
    requestNewMeeting,
  } = useWorkspaceShell();
  const selectedProject = projects.find(
    (project) => project.projectId === selectedProjectId
  );
  /**
   * **쪽 수는 범위(프로젝트·모든 노트)마다 따로 센다.** 한 곳에서 더 본 만큼이 다른 곳에 따라가면
   * 처음 보는 목록이 몇 쪽씩 한꺼번에 읽힌다. 키에 두면 범위를 바꿨다 돌아와도 펼친 만큼이 남는다.
   * 서버가 워크스페이스 단위로 한 번에 세워 주므로(APP-685) 클라이언트 정렬은 없다.
   */
  const scopeKey = selectedProjectId ?? `all:${workspaceId}`;
  const [pagesByScope, setPagesByScope] = useState<Record<string, number>>({});
  const pages = pagesByScope[scopeKey] ?? 1;
  const streamHealthy = useEventStreamHealthy();
  const notesQuery = useNoteListPages({
    scope: selectedProjectId
      ? { kind: "project", projectId: selectedProjectId }
      : { kind: "workspace", workspaceId },
    pages,
    enabled: true,
    // 건강한 이벤트 스트림이면 `notes.changed` 힌트가 다시 읽게 하고 폴링은 안전망만(PRO-67 I04).
    refetchInterval: (notes) =>
      hintedInterval(streamHealthy, noteListRefetchInterval(notes)),
  });
  const page =
    notesQuery.data?.status === 200 && notesQuery.data.data.success
      ? notesQuery.data.data.data
      : undefined;
  const notes: NoteListResponseDataNotesItem[] = page?.notes ?? [];
  const isPending = selectedProjectId
    ? notesQuery.isPending
    : isWorkspacePending || notesQuery.isPending;
  const isError = selectedProjectId
    ? notesQuery.isError
    : isWorkspaceError || notesQuery.isError;
  /**
   * 지금 그린 목록이 어느 범위의 것인가. `keepPreviousData` 는 범위를 바꿔도 앞 범위의 목록을 준다 — 「더 보기」(같은 범위)와
   * 범위 바꾸기를 여기서 가른다. 앞 범위의 목록은 옅게 그리고, 그동안 「더 보기」가 「불러오는 중」으로 서지 않게 한다 (APP-1212).
   */
  const [shownScope, setShownScope] = useState(scopeKey);
  if (
    !notesQuery.isPlaceholderData &&
    notesQuery.data &&
    shownScope !== scopeKey
  ) {
    setShownScope(scopeKey);
  }
  const stale = notesQuery.isPlaceholderData && shownScope !== scopeKey;
  // 다음 쪽을 읽는 중 = 같은 범위에서 키가 바뀌어 이전 목록을 붙들고 있는 동안
  const isLoadingMore =
    notesQuery.isFetching && notesQuery.isPlaceholderData && !stale;

  const loadMore = () =>
    setPagesByScope((current) => ({
      ...current,
      [scopeKey]: (current[scopeKey] ?? 1) + 1,
    }));

  const retry = () => {
    void notesQuery.refetch();
  };

  /**
   * 프로젝트가 하나도 없다 — **제목·개수를 통째로 온보딩으로 바꾼다**(design.pen `kbUlG`).
   * 「0개의 회의 기록」은 셀 것이 있다는 뜻인데 여기엔 아무것도 없고, 지금 필요한 것은
   * 무엇을 먼저 해야 하는가 하나다.
   *
   * **`isWorkspacePending`을 함께 본다.** 프로젝트 목록이 오기 전에는 `projects`가 빈 배열이라
   * 이것만 보면 로딩 중 한 프레임 동안 온보딩이 번쩍인다.
   */
  const hasNoProject =
    !isWorkspacePending && !isWorkspaceError && projects.length === 0;

  return (
    // 목록은 셸이 아니라 **자기 안에서** 스크롤한다. 문서를 늘리면 셸 컨테이너가 따라 늘어나
    // 그 위에 앉는 노트 full 면이 컨테이너를 다 못 덮는다(APP-252).
    //
    // **`overflow-y-auto`가 아니라 `ScrollArea`다.** 네이티브 스크롤바는 폭을 먹어서, 목록이
    // 도착해 스크롤이 생기는 순간 본문이 스크롤바만큼 좁아졌다 — 로딩 직후 폭이 튀는 것이
    // 그것이다. 게다가 이 컨테이너는 `rounded-panel`(16) + `overflow-hidden` 패널 **안**이라
    // 네이티브 바가 둥근 모서리에 붙어 잘린 채 그려졌다.
    //
    // `ScrollArea`(base-ui)의 스크롤바는 뷰포트 위에 얹히는 오버레이라 폭을 먹지 않는다 —
    // 시프트가 사라지고, 「아래에 더 있다」는 신호는 남는다. 노트 쪽 다섯 면(전사·요약·
    // 아카이브·챗 둘)이 이미 이걸 쓰고 있어서 이 파일만 예외였다.
    //
    // 가로는 뷰포트에서 자른다 — 아래 블롭의 `-right-24`가 콘텐츠 상자 밖으로 나가서
    // 가로 스크롤을 만든다(본문 1026 폭에서 31px 실측). 세로 스크롤바만 그리므로 그 가로
    // 스크롤은 **손잡이 없는 스크롤**이 된다. 자르는 자리는 패널 끝이라 APP-226이 없앤
    // 콘텐츠 폭 이음선은 돌아오지 않는다.
    //
    // **`!`가 필요하다.** base-ui가 뷰포트에 `overflow: scroll`을 **인라인으로** 박기 때문에
    // (네이티브 바를 숨기고 스크롤은 살리는 방식) 평범한 클래스로는 못 덮는다. 저자
    // 스타일시트의 `!important`는 인라인 선언을 이기므로 이게 유일한 길이다.
    <ScrollArea
      className="min-h-0 flex-1"
      viewportClassName="overflow-x-hidden!"
    >
      <div className="relative mx-auto w-full max-w-4xl px-5 pb-16 pt-8 sm:px-8 sm:pt-11">
        {hasNoProject ? (
          <WorkspaceOnboarding
            stage="no-project"
            onCreateProject={openCreateProject}
            onNewMeeting={requestNewMeeting}
          />
        ) : (
          <>
            {/* **hairline은 헤더가 갖는다.** 예전에는 아래 필터 줄이 들고 있었는데, 「내가 시작」이
                없어지자 남는 칩이 「전체」 하나뿐이라 줄을 통째로 걷었다(고를 것이 하나면 고르는
                것이 아니다). 선은 목록의 위 끝을 정하므로 함께 없앨 수 없어 헤더로 옮겼다. */}
            <header
              className={cn(
                "relative mb-4 border-b border-[var(--el-hairline)]",
                // 프로젝트를 골랐으면 「노트 | 연결 지도」 탭이 머리 아래 선에 앉는다
                selectedProject ? "pb-0" : "pb-6"
              )}
            >
              <h2
                // 프로젝트를 골랐으면 「연결 지도」의 제목과 같은 틀(한 줄·같은 높이). `cn` 은 쓰지 않는다 — tailwind-merge 가
                // 글자 크기 `text-screen-title` 을 색 `text-[var(--el-ink)]` 와 겹친다고 보고 지운다
                className={`text-screen-title font-light leading-[1.05] tracking-[-0.035em] text-[var(--el-ink)]${selectedProject ? " min-h-[1.05em] truncate" : ""}`}
              >
                {selectedProject?.name ?? "모든 노트"}
              </h2>
              {/* `p` 가 아니라 `div` — 자리표시(`Skeleton`)가 `div` 라 `p` 안에 두면 잘못 포갠 HTML 이 된다. */}
              <div className="mt-3 text-sm leading-6 text-[var(--el-muted)]">
                {/* 오기 전에 「0개」를 그리면 노트가 없다고 읽힌다 — 자리만 잡는다. 앞 범위의 개수는 목록과 함께 옅게 둔다. */}
                {isPending && !page ? (
                  <Skeleton className="inline-block h-4 w-24 align-[-3px]" />
                ) : (
                  <span
                    className={cn(
                      "transition-opacity duration-150 ease-out motion-reduce:transition-none",
                      stale && "opacity-60"
                    )}
                  >
                    {notes.length}개{page?.hasMore ? " 이상" : ""}의 회의 기록
                  </span>
                )}{" "}
                · 발화와 결정이 시간순으로 보관됩니다.
              </div>
              {selectedProject ? (
                <ProjectViewTabs
                  workspaceId={workspaceId}
                  projectId={selectedProject.projectId}
                  current="notes"
                  className="mt-5"
                />
              ) : null}
            </header>
            <ProjectViewBody enabled={Boolean(selectedProject)}>
              <DesktopAppPromo />
              <WorkspaceNoteList
                workspaceId={workspaceId}
                notes={notes}
                isPending={isPending}
                isError={isError}
                onRetry={retry}
                onNewMeeting={requestNewMeeting}
                hasMore={page?.hasMore ?? false}
                isLoadingMore={isLoadingMore}
                stale={stale}
                onLoadMore={loadMore}
              />
            </ProjectViewBody>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
