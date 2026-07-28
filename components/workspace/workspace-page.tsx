"use client";

import { useState } from "react";
import { useQueries } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { WorkspaceNoteList } from "@/components/workspace/workspace-note-list";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import {
  getGetNotesQueryOptions,
  type getNotesResponse,
  useGetNotes,
} from "@/lib/api/generated/notes/notes";
import { isMeetingActive } from "@/lib/notes/meeting-state";
import { cn } from "@/lib/utils";

type NoteFilter = "all" | "mine";

// v5 목록 필터는 전체와 내가 시작(meetingStartedBy로 판별) 둘뿐이다.
// meetingStatus 표시는 APP-284가 목록 행에서 맡는다.
const FILTERS: { key: NoteFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "mine", label: "내가 시작" },
];

export const ACTIVE_NOTE_LIST_POLL_MS = 10_000;
export const INACTIVE_NOTE_LIST_POLL_MS = 30_000;

export function noteListRefetchInterval(
  notes: NoteListResponseDataNotesItem[] | undefined
): number {
  return notes?.some(isMeetingActive)
    ? ACTIVE_NOTE_LIST_POLL_MS
    : INACTIVE_NOTE_LIST_POLL_MS;
}

function notesFromResponse(
  response: getNotesResponse | undefined
): NoteListResponseDataNotesItem[] | undefined {
  return response?.status === 200 && response.data.success
    ? response.data.data.notes
    : undefined;
}

export function WorkspacePage({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth();
  const { selectedProjectId, projects, isWorkspacePending, isWorkspaceError } =
    useWorkspaceShell();
  const [filter, setFilter] = useState<NoteFilter>("all");
  const selectedProject = projects.find(
    (project) => project.projectId === selectedProjectId
  );
  const singleNotesQuery = useGetNotes(selectedProjectId ?? "", {
    query: {
      enabled: selectedProjectId !== null,
      refetchInterval: (query) =>
        noteListRefetchInterval(notesFromResponse(query.state.data)),
    },
  });
  const allNotesQueries = useQueries({
    queries: selectedProjectId
      ? []
      : projects.map((project) =>
          getGetNotesQueryOptions(project.projectId, {
            query: {
              refetchInterval: (query) =>
                noteListRefetchInterval(notesFromResponse(query.state.data)),
            },
          })
        ),
    combine: (results) => ({
      notes: results.flatMap((result) =>
        result.data?.status === 200 && result.data.data.success
          ? (result.data.data.data.notes ?? [])
          : []
      ),
      isPending: results.some((result) => result.isPending),
      isError: results.some((result) => result.isError),
      refetch: () => results.forEach((result) => void result.refetch()),
    }),
  });
  const selectedNotes =
    singleNotesQuery.data?.status === 200 && singleNotesQuery.data.data.success
      ? (singleNotesQuery.data.data.data.notes ?? [])
      : [];
  const notes: NoteListResponseDataNotesItem[] = selectedProjectId
    ? selectedNotes
    : allNotesQueries.notes;
  // 유저가 아직 안 풀렸으면(undefined) 소유 판별을 하지 않는다 — meetingStartedBy가 null인
  // 노트의 userId도 undefined라 `undefined === undefined`로 잘못 걸린다.
  const mineNotes = user
    ? notes.filter((note) => note.meetingStartedBy?.userId === user.userId)
    : [];
  const visibleNotes = filter === "mine" ? mineNotes : notes;
  const isPending = selectedProjectId
    ? singleNotesQuery.isPending
    : isWorkspacePending || allNotesQueries.isPending;
  const isError = selectedProjectId
    ? singleNotesQuery.isError
    : isWorkspaceError || allNotesQueries.isError;
  // 필터 때문에 비었을 뿐 노트는 있다 — "첫 회의를 시작하세요" 빈 상태는 오해를 준다.
  const isFilteredEmpty =
    filter === "mine" &&
    !isPending &&
    !isError &&
    notes.length > 0 &&
    visibleNotes.length === 0;

  const retry = () => {
    if (selectedProjectId) {
      void singleNotesQuery.refetch();
      return;
    }
    allNotesQueries.refetch();
  };

  return (
    // 목록은 셸이 아니라 **자기 안에서** 스크롤한다. 문서를 늘리면 셸 컨테이너가 따라 늘어나
    // 그 위에 앉는 노트 full 면이 컨테이너를 다 못 덮는다(APP-252).
    // `overflow-x-hidden`은 장식이다. `overflow-y`만 주면 계산된 `overflow-x`도 `auto`가 되어
    // 본문이 좁을 때(뷰포트 900 실측) 블롭의 `-right-24`가 96px짜리 가로 스크롤을 만든다.
    // 자르는 자리는 메인 컬럼 끝이라 APP-226이 없앤 콘텐츠 폭 이음선은 돌아오지 않는다.
    <section className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
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
        <header className="relative mb-6">
          <h2 className="font-serif text-screen-title font-light leading-[1.05] tracking-[-0.035em] text-[var(--el-ink)]">
            {selectedProject?.name ?? "모든 노트"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--el-muted)]">
            {visibleNotes.length}개의 회의 기록 · 발화와 결정이 시간순으로
            보관됩니다.
          </p>
        </header>
        <div
          role="group"
          aria-label="노트 필터"
          className="mb-4 flex items-center gap-1.5 border-b border-[var(--el-hairline)] pb-4"
        >
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                // 칩은 chip 6이다. pill(9999)은 주 CTA와 레코더 독 두 곳뿐. (FORM SPEC)
                "h-8 rounded-chip px-3.5 text-[13px] font-medium transition-colors",
                filter === key
                  ? "bg-[var(--el-surface-strong)] text-[var(--el-ink)]"
                  : "text-[var(--el-muted)] hover:bg-[var(--el-canvas-soft)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {isFilteredEmpty ? (
          <p className="py-16 text-center text-sm text-[var(--el-muted)]">
            내가 시작한 회의가 없습니다.
          </p>
        ) : (
          <WorkspaceNoteList
            workspaceId={workspaceId}
            notes={visibleNotes}
            isPending={isPending}
            isError={isError}
            onRetry={retry}
          />
        )}
      </div>
    </section>
  );
}
