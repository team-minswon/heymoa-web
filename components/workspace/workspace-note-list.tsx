"use client";

import { useEffect, useRef } from "react";
import { FileText, Mic, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { NoteListRow } from "@/components/workspace/note-list-row";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import { formatAppDate, getAppDateKey } from "@/lib/format/date";

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
    const key = getAppDateKey(note.updatedAt);
    grouped.set(key, [...(grouped.get(key) ?? []), note]);
  });

  return [...grouped.entries()].map(([key, groupedNotes]) => ({
    key,
    label: formatAppDate(
      groupedNotes[0].updatedAt,
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      },
      locale
    ),
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
  const retryRef = useRef(onRetry);

  useEffect(() => {
    retryRef.current = onRetry;
  }, [onRetry]);

  useEffect(() => {
    if (!isError) return;

    toast.error("노트를 불러오지 못했습니다.", {
      id: `workspace-notes-${workspaceId}`,
      action: {
        label: "다시 시도",
        onClick: () => retryRef.current(),
      },
    });
  }, [isError, workspaceId]);

  if (isPending) {
    return (
      <div aria-label="노트 불러오는 중" className="space-y-3 py-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-[92px] rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError && !notes.length) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={onRetry}
        >
          <RefreshCcw /> 다시 시도
        </Button>
      </div>
    );
  }

  if (!notes.length) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--el-hairline-strong)] bg-white/75 px-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <span className="flex size-12 items-center justify-center rounded-full bg-[var(--el-surface-strong)]">
          <FileText className="size-5 text-[var(--el-muted)]" />
        </span>
        <h2 className="mt-5 font-serif text-2xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
          아직 회의 기록이 없습니다
        </h2>
        <p className="mt-1 max-w-sm text-sm text-[var(--el-muted)]">
          첫 회의를 시작하면 실시간 전사와 확정된 기록이 이곳에 쌓입니다.
        </p>
        <Button
          size="xl"
          className="mt-6 rounded-full px-5"
          disabled={isCreateMeetingDisabled}
          onClick={onCreateMeeting}
        >
          <Mic /> {createMeetingLabel}
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="workspace-note-list" className="space-y-10">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`date-${group.key}`}>
          <div className="mb-3 flex items-center gap-4 px-1">
            <h2
              id={`date-${group.key}`}
              className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--el-muted)]"
            >
              {group.label}
            </h2>
            <div className="min-w-0 flex-1">
              <Separator />
            </div>
          </div>
          <div className="space-y-2">
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
