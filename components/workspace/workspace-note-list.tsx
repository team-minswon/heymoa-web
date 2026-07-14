"use client";

import { FileText, Mic, RefreshCcw } from "lucide-react";

import { NoteListRow } from "@/components/workspace/note-list-row";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";

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
  notes,
  isPending,
  isError,
  onRetry,
  onCreateMeeting,
  projectNames,
  createMeetingLabel = "새 회의",
  isCreateMeetingDisabled = false,
}: {
  workspaceId: string;
  notes: NoteListResponseDataNotesItem[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onCreateMeeting: () => void;
  projectNames: Record<string, string>;
  createMeetingLabel?: string;
  isCreateMeetingDisabled?: boolean;
}) {
  const groups = groupNotesByDate(notes, "ko-KR");

  if (isPending) {
    return (
      <div aria-label="노트 불러오는 중" className="space-y-3 py-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="mt-8 rounded-2xl">
        <AlertTitle>노트를 불러오지 못했습니다.</AlertTitle>
        <AlertDescription className="mt-3">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={onRetry}
          >
            <RefreshCcw /> 다시 시도
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!notes.length) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--el-hairline)] bg-white px-6 text-center shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
        <span className="flex size-11 items-center justify-center rounded-full bg-[var(--el-canvas-soft)]">
          <FileText className="size-5 text-[var(--el-muted)]" />
        </span>
        <h2 className="mt-4 font-serif text-xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
          아직 회의 기록이 없습니다
        </h2>
        <p className="mt-1 max-w-sm text-sm text-[var(--el-muted)]">
          첫 회의를 시작하면 실시간 전사와 확정된 기록이 이곳에 쌓입니다.
        </p>
        <Button
          className="mt-5 rounded-full"
          disabled={isCreateMeetingDisabled}
          onClick={onCreateMeeting}
        >
          <Mic /> {createMeetingLabel}
        </Button>
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
                projectName={projectNames[note.projectId]}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
