"use client";

import { useState } from "react";

import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { WorkspaceNoteList } from "@/components/workspace/workspace-note-list";
import { WorkspaceOnboarding } from "@/components/workspace/workspace-onboarding";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import { isMeetingActive } from "@/lib/notes/meeting-state";
import { useNoteListPages } from "@/lib/workspace/use-note-list-pages";

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
  const notesQuery = useNoteListPages({
    scope: selectedProjectId
      ? { kind: "project", projectId: selectedProjectId }
      : { kind: "workspace", workspaceId },
    pages,
    enabled: true,
    refetchInterval: noteListRefetchInterval,
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
  // 다음 쪽을 읽는 중 = 키가 바뀌어 이전 목록을 붙들고 있는 동안
  const isLoadingMore = notesQuery.isFetching && notesQuery.isPlaceholderData;

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
      {/* 이 박스는 클리핑하지 않는다. 장식 블롭이 콘텐츠 폭(896) 밖까지 뻗는데 여기서 자르면
          부드러운 그라데이션이 캔버스 한복판에서 직선으로 끊겨 이음선처럼 보였다(실측: 화면
          끝보다 144px 앞에서 잘림). 바깥 셸 컨테이너가 이미 overflow-hidden이라 화면
          가장자리에서 처리된다 — 가로 스크롤도 생기지 않는다. 블롭의 기준은 콘텐츠 폭이라
          이 안에 남는다. */}
      <div className="relative mx-auto w-full max-w-4xl px-5 pb-16 pt-8 sm:px-8 sm:pt-11">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-0 size-72 rounded-full opacity-25 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--el-gradient-mint) 0%, transparent 68%)",
          }}
        />
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
            <header className="relative mb-4 border-b border-[var(--el-hairline)] pb-6">
              <h2 className="font-serif text-screen-title font-light leading-[1.05] tracking-[-0.035em] text-[var(--el-ink)]">
                {selectedProject?.name ?? "모든 노트"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--el-muted)]">
                {notes.length}개{page?.hasMore ? " 이상" : ""}의 회의 기록 ·
                발화와 결정이 시간순으로 보관됩니다.
              </p>
            </header>
            <WorkspaceNoteList
              workspaceId={workspaceId}
              notes={notes}
              isPending={isPending}
              isError={isError}
              onRetry={retry}
              onNewMeeting={requestNewMeeting}
              hasMore={page?.hasMore ?? false}
              isLoadingMore={isLoadingMore}
              onLoadMore={loadMore}
            />
          </>
        )}
      </div>
    </ScrollArea>
  );
}
