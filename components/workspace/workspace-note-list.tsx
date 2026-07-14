"use client";

import { FileText, RefreshCcw } from "lucide-react";
import { useQueries } from "@tanstack/react-query";

import { NoteListRow } from "@/components/workspace/note-list-row";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import { useGetNotes, getGetNotesQueryOptions } from "@/lib/api/generated/notes/notes";
import { useGetProjects } from "@/lib/api/generated/projects/projects";

export type NoteDateGroup = {
  key: string;
  label: string;
  notes: NoteListResponseDataNotesItem[];
};

export function groupNotesByDate(
  notes: NoteListResponseDataNotesItem[],
  locale: string
): NoteDateGroup[] {
  const sorted = [...notes].sort((a, b) => {
    const aTime = Date.parse(a.updatedAt);
    const bTime = Date.parse(b.updatedAt);
    return bTime - aTime || b.noteId.localeCompare(a.noteId);
  });
  const grouped = new Map<string, NoteListResponseDataNotesItem[]>();

  sorted.forEach((note) => {
    const date = new Date(note.updatedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    grouped.set(key, [...(grouped.get(key) ?? []), note]);
  });

  return [...grouped.entries()].map(([key, groupedNotes]) => ({
    key,
    label: new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(new Date(groupedNotes[0].updatedAt)),
    notes: groupedNotes,
  }));
}

export function WorkspaceNoteList({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string | null;
}) {
  // Fetch projects list (used for fallback when querying all projects)
  const projectsQuery = useGetProjects(workspaceId);
  const projects =
    projectsQuery.data?.status === 200 && projectsQuery.data.data.success
      ? (projectsQuery.data.data.data.projects ?? [])
      : [];

  // 1. Single project note list query
  const singleNotesQuery = useGetNotes(projectId ?? "", {
    query: { enabled: projectId !== null },
  });

  // 2. Parallel queries for all projects inside the workspace
  const allNotesQueries = useQueries({
    queries: projects.map((p) => getGetNotesQueryOptions(p.projectId)),
    combine: (results) => {
      const combinedNotes: NoteListResponseDataNotesItem[] = [];
      results.forEach((r) => {
        if (r.data?.status === 200 && r.data.data.success) {
          combinedNotes.push(...(r.data.data.data.notes ?? []));
        }
      });
      return {
        data: combinedNotes,
        isPending: results.some((r) => r.isPending),
        isError: results.some((r) => r.isError),
        refetch: () => results.forEach((r) => void r.refetch()),
      };
    },
  });

  const isPending = projectId
    ? singleNotesQuery.isPending
    : (projectsQuery.isPending || allNotesQueries.isPending);

  const isError = projectId
    ? singleNotesQuery.isError
    : (projectsQuery.isError || allNotesQueries.isError);

  const refetch = projectId
    ? () => void singleNotesQuery.refetch()
    : () => {
        void projectsQuery.refetch();
        allNotesQueries.refetch();
      };

  const notes = projectId
    ? (singleNotesQuery.data?.status === 200 && singleNotesQuery.data.data.success
        ? (singleNotesQuery.data.data.data.notes ?? [])
        : [])
    : allNotesQueries.data;

  const groups = groupNotesByDate(notes, "ko-KR");

  if (isPending) {
    return (
      <div aria-label="노트 불러오는 중" className="space-y-3 py-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="mt-8">
        <AlertTitle>노트를 불러오지 못했습니다.</AlertTitle>
        <AlertDescription className="mt-3">
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCcw /> 다시 시도
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!notes.length) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted">
          <FileText className="size-5 text-muted-foreground" />
        </span>
        <h2 className="mt-4 text-base font-semibold">
          {projectId ? "이 프로젝트에 노트가 없습니다" : "아직 노트가 없습니다"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          상단의 새 노트 또는 실시간 기록 시작을 사용해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="workspace-note-list" className="space-y-7">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`date-${group.key}`}>
          <div className="flex items-center gap-4">
            <h2
              id={`date-${group.key}`}
              className="shrink-0 text-xs font-medium tracking-[-0.01em] text-[var(--el-muted)]"
            >
              {group.label}
            </h2>
            <div className="min-w-0 flex-1">
              <Separator />
            </div>
          </div>
          <div className="mt-1">
            {group.notes.map((note) => (
              <NoteListRow
                key={note.noteId}
                workspaceId={workspaceId}
                note={note}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
