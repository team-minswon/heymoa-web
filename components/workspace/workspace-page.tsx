"use client";

import { useState } from "react";
import { useQueries } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { WorkspaceNoteList } from "@/components/workspace/workspace-note-list";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import {
  getGetNotesQueryOptions,
  useGetNotes,
} from "@/lib/api/generated/notes/notes";
import { cn } from "@/lib/utils";

type NoteFilter = "all" | "mine";

// v5: 상태 배지·"녹음 중" 필터는 목록 계약에 meetingStatus가 없어 만들지 않는다(FORM SPEC).
// 필터는 전체와 내가 시작(meetingStartedBy로 판별) 둘뿐이다.
const FILTERS: { key: NoteFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "mine", label: "내가 시작" },
];

export function WorkspacePage({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth();
  const { selectedProjectId, projects, isWorkspacePending, isWorkspaceError } =
    useWorkspaceShell();
  const [filter, setFilter] = useState<NoteFilter>("all");
  const selectedProject = projects.find(
    (project) => project.projectId === selectedProjectId
  );
  const singleNotesQuery = useGetNotes(selectedProjectId ?? "", {
    query: { enabled: selectedProjectId !== null },
  });
  const allNotesQueries = useQueries({
    queries: selectedProjectId
      ? []
      : projects.map((project) => getGetNotesQueryOptions(project.projectId)),
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
    <section className="relative mx-auto min-h-full w-full max-w-4xl overflow-hidden px-5 pb-16 pt-8 sm:px-8 sm:pt-11">
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
          {visibleNotes.length}개의 회의 기록 · 발화와 결정이 시간순으로 보관됩니다.
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
              "h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors",
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
    </section>
  );
}
