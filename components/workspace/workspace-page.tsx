"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

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

const ACTIVE_NOTE_LIST_POLL_MS = 10_000;
const INACTIVE_NOTE_LIST_POLL_MS = 30_000;

export function noteListRefetchInterval(
  notes: NoteListResponseDataNotesItem[] | undefined
): number {
  return notes?.some(isMeetingActive)
    ? ACTIVE_NOTE_LIST_POLL_MS
    : INACTIVE_NOTE_LIST_POLL_MS;
}

export function WorkspacePage({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("workspace.page");
  const tShell = useTranslations("shell.nav");
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
  const [shownScope, setShownScope] = useState(scopeKey);
  if (
    !notesQuery.isPlaceholderData &&
    notesQuery.data &&
    shownScope !== scopeKey
  ) {
    setShownScope(scopeKey);
  }
  const stale = notesQuery.isPlaceholderData && shownScope !== scopeKey;
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

  const hasNoProject =
    !isWorkspacePending && !isWorkspaceError && projects.length === 0;

  return (
    // **`overflow-y-auto`가 아니라 `ScrollArea`다.** 네이티브 스크롤바는 폭을 먹어서, 목록이
    // 도착해 스크롤이 생기는 순간 본문이 스크롤바만큼 좁아진다.
    //
    // `ScrollArea`(base-ui)의 스크롤바는 뷰포트 위에 얹히는 오버레이라 폭을 먹지 않는다.
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
            <header
              className={cn(
                "relative mb-4 border-b border-[var(--el-hairline)]",
                selectedProject ? "pb-0" : "pb-6"
              )}
            >
              <h2
                // 프로젝트를 골랐으면 「연결 지도」의 제목과 같은 틀(한 줄·같은 높이). `cn` 은 쓰지 않는다 — tailwind-merge 가
                // 글자 크기 `text-screen-title` 을 색 `text-[var(--el-ink)]` 와 겹친다고 보고 지운다
                className={`text-screen-title font-light leading-[1.05] tracking-[-0.035em] text-[var(--el-ink)]${selectedProject ? " min-h-[1.05em] truncate" : ""}`}
              >
                {selectedProject?.name ?? tShell("allNotes")}
              </h2>
              <div className="mt-3 text-sm leading-6 text-[var(--el-muted)]">
                {isPending && !page ? (
                  <Skeleton className="inline-block h-4 w-24 align-[-3px]" />
                ) : (
                  <span
                    className={cn(
                      "transition-opacity duration-150 ease-out motion-reduce:transition-none",
                      stale && "opacity-60"
                    )}
                  >
                    {t("noteCount", {
                      count: notes.length,
                      more: String(page?.hasMore ?? false),
                    })}
                  </span>
                )}{" "}
                · {t("subtitle")}
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
