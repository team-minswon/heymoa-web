"use client";

import { useQueries } from "@tanstack/react-query";

import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { WorkspaceNoteList } from "@/components/workspace/workspace-note-list";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import {
  getGetNotesQueryOptions,
  useGetNotes,
} from "@/lib/api/generated/notes/notes";

export function WorkspacePage({ workspaceId }: { workspaceId: string }) {
  const { selectedProjectId, projects, isWorkspacePending, isWorkspaceError } =
    useWorkspaceShell();
  const selectedProject = projects.find(
    (project) => project.projectId === selectedProjectId
  );
  const projectNames = Object.fromEntries(
    projects.map((project) => [project.projectId, project.name])
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
  const isPending = selectedProjectId
    ? singleNotesQuery.isPending
    : isWorkspacePending || allNotesQueries.isPending;
  const isError = selectedProjectId
    ? singleNotesQuery.isError
    : isWorkspaceError || allNotesQueries.isError;

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
      {/* 대문자 키커·헤더 새 노트 버튼은 v5에서 뺐다 — 진입점은 상단바 하나(FORM/CHROME SPEC). */}
      <header className="relative mb-10 border-b border-[var(--el-hairline)] pb-9">
        <h2 className="font-serif text-screen-title font-light leading-[1.05] tracking-[-0.035em] text-[var(--el-ink)]">
          {selectedProject?.name ?? "모든 노트"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--el-muted)]">
          {notes.length}개의 회의 기록 · 발화와 결정이 시간순으로 보관됩니다.
        </p>
      </header>
      <WorkspaceNoteList
        workspaceId={workspaceId}
        notes={notes}
        isPending={isPending}
        isError={isError}
        onRetry={retry}
        projectNames={projectNames}
      />
    </section>
  );
}
