"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Calendar, CornerUpLeft, Pause } from "lucide-react";

import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import type { NoteSummary } from "@/lib/api/generated/models";
import { useGetNotesSuspense } from "@/lib/api/generated/notes/notes";
import { formatAppDate } from "@/lib/format/date";
import {
  groupNotesByMonth,
  timelineAnchorOf,
} from "@/lib/workspace/timeline-groups";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "예정",
  IN_PROGRESS: "기록 중",
  PAUSED: "중지됨",
  ENDED: "종료됨",
};

function StatusChip({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  const glyph =
    status === "NOT_STARTED" ? (
      <Calendar className="size-3 text-[var(--el-muted)]" />
    ) : status === "PAUSED" ? (
      <Pause className="size-3 text-[var(--el-muted)]" />
    ) : (
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "IN_PROGRESS"
            ? "bg-[var(--el-error)]"
            : "bg-[var(--el-muted)]"
        )}
      />
    );

  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-[var(--el-body)]">
      {glyph}
      {label}
    </span>
  );
}

function Item({
  note,
  workspaceId,
  last,
}: {
  note: NoteSummary;
  workspaceId: string;
  last: boolean;
}) {
  const when = formatAppDate(timelineAnchorOf(note), {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <li className="flex gap-4">
      <span className="flex w-6 shrink-0 flex-col items-center">
        {/* 이어짐이 있는 회의는 점을 채운다 — 사슬이 눈으로 보이게. */}
        <span
          className={cn(
            "mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-[var(--control-border)]",
            note.previousNote ? "bg-[var(--el-ink)]" : "bg-card"
          )}
        />
        {last ? null : (
          <span className="w-0.5 flex-1 bg-[var(--el-hairline)]" />
        )}
      </span>
      <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-6")}>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/w/${workspaceId}/notes/${note.noteId}?view=full&tab=transcript`}
            className="text-read font-medium underline-offset-4 hover:underline"
          >
            {note.title}
          </Link>
          <StatusChip status={note.meetingStatus} />
          {note.previousNote ? (
            <span className="flex items-center gap-1 rounded-chip bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-[var(--el-body)]">
              <CornerUpLeft className="size-3 text-[var(--el-muted)]" />
              {note.previousNote.title}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[12px] text-[var(--el-muted)]">
          {when}
          {note.participants.length
            ? ` · 참석자 ${note.participants.length}명`
            : ""}
        </p>
      </div>
    </li>
  );
}

function Timeline({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const query = useGetNotesSuspense(projectId, { sort: "scheduledAt_asc" });
  const notes = useMemo<NoteSummary[]>(
    () =>
      query.data.status === 200 && query.data.data.success
        ? (query.data.data.data.notes ?? [])
        : [],
    [query.data]
  );
  // 라벨에만 쓰는 값이라 서버·클라이언트가 같은 해를 본다. 자정에 해가 바뀌는 순간의
  // 불일치는 라벨 하나뿐이라 hydration 을 위해 스켈레톤을 한 번 더 그릴 값이 아니다.
  const groups = useMemo(
    () => groupNotesByMonth(notes, String(new Date().getUTCFullYear())),
    [notes]
  );

  if (!notes.length) {
    return (
      <div className="rounded-panel border border-[var(--el-hairline)] bg-card px-8 py-16 text-center">
        <p className="text-[15px] font-medium">이 프로젝트에 회의가 없습니다</p>
        <p className="mt-2 text-[13px] leading-6 text-[var(--el-muted)]">
          첫 회의를 만들면 여기에 시간순으로 쌓입니다.
          <br />
          지난 회의에서 맥락을 이어받아 시작할 수도 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-panel border border-[var(--el-hairline)] bg-card p-6">
      {groups.map((group, groupIndex) => (
        <section
          key={group.monthKey}
          data-testid="timeline-month"
          className={groupIndex === 0 ? "" : "mt-5"}
        >
          <h3 className="mb-3.5 text-[13px] font-bold text-[var(--el-muted)]">
            {group.label}
          </h3>
          <ul>
            {group.notes.map((note, index) => (
              <Item
                key={note.noteId}
                note={note}
                workspaceId={workspaceId}
                last={
                  groupIndex === groups.length - 1 &&
                  index === group.notes.length - 1
                }
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="rounded-panel border border-[var(--el-hairline)] bg-card p-6">
      <Skeleton className="mb-3.5 h-3 w-6" />
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex gap-4">
          <span className="flex w-6 shrink-0 flex-col items-center">
            <Skeleton className="mt-1.5 size-2.5 rounded-full" />
            <span className="w-0.5 flex-1 bg-[var(--el-hairline)]" />
          </span>
          <div className="flex-1 pb-6">
            <Skeleton className="h-3 w-52" />
            <Skeleton className="mt-2.5 h-2.5 w-60" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectTimelinePage({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { projects } = useWorkspaceShell();
  const project = projects.find((row) => row.projectId === projectId);

  return (
    <div className="px-8 pb-7 pt-6">
      <header className="pb-4">
        <h1 className="text-note-title font-serif font-light">
          {project?.name ?? "프로젝트"}
        </h1>
        <p className="mt-1 text-[13px] text-[var(--el-muted)]">
          {project?.description ??
            "이 프로젝트의 회의를 시간순으로 봅니다."}
        </p>
      </header>
      <DataBoundary
        fallback={<TimelineSkeleton />}
        errorLabel="프로젝트 회의를 불러오지 못했습니다"
        resetKeys={[projectId]}
      >
        <Timeline workspaceId={workspaceId} projectId={projectId} />
      </DataBoundary>
    </div>
  );
}
