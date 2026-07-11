"use client";

import { FileText, RefreshCcw } from "lucide-react";

import { NoteListRow } from "@/components/workspace/note-list-row";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { NoteSummaryResponse } from "@/lib/api/generated/models";
import { useListWorkspaceNotes } from "@/lib/api/generated/note/note";

export type NoteDateGroup = {
  key: string;
  label: string;
  notes: NoteSummaryResponse[];
};

export function groupNotesByDate(
  notes: NoteSummaryResponse[],
  locale: string
): NoteDateGroup[] {
  const sorted = [...notes].sort((a, b) => {
    const aTime = Date.parse(a.lastRecordedAt ?? a.createdAt);
    const bTime = Date.parse(b.lastRecordedAt ?? b.createdAt);
    return bTime - aTime || b.noteId.localeCompare(a.noteId);
  });
  const grouped = new Map<string, NoteSummaryResponse[]>();

  sorted.forEach((note) => {
    const date = new Date(note.lastRecordedAt ?? note.createdAt);
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
    }).format(
      new Date(groupedNotes[0].lastRecordedAt ?? groupedNotes[0].createdAt)
    ),
    notes: groupedNotes,
  }));
}

export function WorkspaceNoteList({
  workspaceId,
  folderId,
}: {
  workspaceId: string;
  folderId: string | null;
}) {
  const notesQuery = useListWorkspaceNotes(workspaceId, {
    limit: 100,
    ...(folderId ? { folderId } : {}),
  });
  const notes =
    notesQuery.data?.status === 200 && notesQuery.data.data.success
      ? (notesQuery.data.data.data?.items ?? [])
      : [];
  const groups = groupNotesByDate(notes, "ko-KR");

  if (notesQuery.isPending) {
    return (
      <div aria-label="노트 불러오는 중" className="space-y-3 py-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (notesQuery.isError) {
    return (
      <Alert variant="destructive" className="mt-8">
        <AlertTitle>노트를 불러오지 못했습니다.</AlertTitle>
        <AlertDescription className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void notesQuery.refetch()}
          >
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
          {folderId ? "이 폴더에 노트가 없습니다" : "아직 노트가 없습니다"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          상단의 새 노트 또는 실시간 기록 시작을 사용해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-6">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`date-${group.key}`}>
          <div className="flex items-center gap-3">
            <h2
              id={`date-${group.key}`}
              className="shrink-0 text-xs font-semibold text-muted-foreground"
            >
              {group.label}
            </h2>
            <div className="min-w-0 flex-1">
              <Separator />
            </div>
          </div>
          <div className="mt-2 divide-y divide-border/60">
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
