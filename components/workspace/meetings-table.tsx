"use client";

import Link from "next/link";
import { Calendar, Pause } from "lucide-react";

import { AvatarStack, Sheet } from "@/components/workspace/page-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import type { NoteSummary } from "@/lib/api/generated/models";
import { getRecordedDurationMs } from "@/lib/notes/meeting-state";
import {
  formatMeetingWhen,
  formatRecordedDuration,
  formatScheduledWhen,
  groupMeetings,
} from "@/lib/workspace/meeting-rows";
import { cn } from "@/lib/utils";

/** 칸 폭은 표 전체에서 한 벌만 존재한다 — 머리와 몸이 갈리면 표가 아니라 목록이 된다. */
const COL = {
  status: "w-[100px]",
  project: "w-[124px]",
  people: "w-[146px]",
  duration: "w-[100px]",
  when: "w-[164px]",
} as const;

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "예정",
  IN_PROGRESS: "기록 중",
  PAUSED: "중지됨",
  ENDED: "종료됨",
};

function StatusCell({ status }: { status: string }) {
  const live = status === "IN_PROGRESS";
  return (
    <span
      className={cn(
        "flex h-4 shrink-0 items-center gap-1.5 text-[11px] font-semibold",
        COL.status,
        live ? "text-[var(--el-error)]" : "text-[var(--el-muted)]"
      )}
    >
      {status === "NOT_STARTED" ? (
        <Calendar className="size-3 text-[var(--el-muted)]" />
      ) : status === "PAUSED" ? (
        <Pause className="size-3 text-[var(--el-muted)]" />
      ) : (
        <span
          className={cn(
            "size-1.5 rounded-full",
            live ? "bg-[var(--el-error)]" : "bg-[var(--el-muted)]"
          )}
        />
      )}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function HeadRow() {
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-[var(--el-hairline)] bg-[var(--el-surface-strong)] px-4 text-[11px] font-bold tracking-[0.4px] text-[var(--el-body)]">
      <span aria-hidden className="w-0.5 shrink-0" />
      <span className={cn("shrink-0", COL.status)}>상태</span>
      <span className="min-w-0 flex-1">제목</span>
      <span className={cn("shrink-0", COL.project)}>프로젝트</span>
      <span className={cn("shrink-0", COL.people)}>참석자</span>
      <span className={cn("shrink-0", COL.duration)}>기록</span>
      <span className={cn("shrink-0", COL.when)}>일시</span>
    </div>
  );
}

function SectionRow({ label, order }: { label: string; order: string }) {
  return (
    <div className="flex h-[34px] shrink-0 items-center gap-2 border-b border-[var(--el-hairline)] px-4">
      <span className="text-[11px] font-bold tracking-[0.4px] text-[var(--el-body)]">
        {label}
      </span>
      <span className="text-[11px] text-[var(--el-muted)]">{order}</span>
    </div>
  );
}

function MeetingRow({
  note,
  workspaceId,
  projectName,
  now,
}: {
  note: NoteSummary;
  workspaceId: string;
  projectName?: string;
  now: number | null;
}) {
  const live = note.meetingStatus === "IN_PROGRESS";
  const scheduled = note.meetingStatus === "NOT_STARTED";
  const durationMs = now === null ? 0 : getRecordedDurationMs(note, now);
  // 시작 시각이 비어도 일시 칸을 「—」로 두지 않는다. 시작된 회의인데 언제인지 안 보이면
  // 목록에서 그 회의를 다시 찾을 방법이 없다 — 만들어진 시각으로 떨어진다.
  const anchor =
    note.meetingStartedAt ?? note.lastRecordedAt ?? note.createdAt;

  return (
    // 목록에서 여는 회의는 **side 오버레이**다(design.pen `iPCAj`) — 목록을 잃지 않고
    // 옆에서 읽다가 필요할 때 상단바에서 전체 화면으로 넓힌다.
    <Link
      href={`/w/${workspaceId}/meetings/${note.noteId}?view=side&tab=${scheduled ? "details" : live ? "transcript" : "summary"}`}
      className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--el-hairline)] px-4 transition-colors last:border-b-0 hover:bg-[var(--el-canvas-soft)]"
    >
      {/* 기록 중인 회의만 왼쪽에 막대가 선다 — 표에서 눈이 먼저 가는 자리다. */}
      <span
        aria-hidden
        className={cn(
          "h-6 w-0.5 shrink-0 rounded-full",
          live && "bg-[var(--el-ink)]"
        )}
      />
      <StatusCell status={note.meetingStatus} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] text-[var(--el-ink)]",
          live ? "font-semibold" : "font-medium"
        )}
      >
        {note.title}
      </span>
      <span
        className={cn(
          "shrink-0 truncate text-[12px] text-[var(--el-body)]",
          COL.project
        )}
      >
        {projectName ?? "—"}
      </span>
      <span className={cn("shrink-0", COL.people)}>
        <AvatarStack people={note.participants} />
      </span>
      <span
        className={cn(
          "shrink-0 text-[12px]",
          COL.duration,
          live ? "text-[var(--el-body)]" : "text-[var(--el-muted)]"
        )}
      >
        {scheduled
          ? "—"
          : live
            ? `경과 ${formatRecordedDuration(durationMs)}`
            : formatRecordedDuration(durationMs)}
      </span>
      <span
        className={cn(
          "shrink-0 truncate text-[12px]",
          COL.when,
          scheduled ? "text-[var(--el-ink)]" : "text-[var(--el-muted)]"
        )}
      >
        {scheduled
          ? formatScheduledWhen(note.scheduledAt)
          : formatMeetingWhen(anchor, now)}
      </span>
    </Link>
  );
}

export function MeetingsTableSkeleton() {
  return (
    <Sheet>
      <HeadRow />
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="flex h-12 items-center gap-3 border-b border-[var(--el-hairline)] px-4 last:border-b-0"
        >
          <span className="w-0.5 shrink-0" />
          <Skeleton className={cn("h-3", COL.status)} />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className={cn("h-3", COL.project)} />
          <Skeleton className={cn("h-3", COL.people)} />
          <Skeleton className={cn("h-3", COL.duration)} />
          <Skeleton className={cn("h-3", COL.when)} />
        </div>
      ))}
    </Sheet>
  );
}

export function MeetingsTable({
  workspaceId,
  notes,
  projectNames,
  now,
}: {
  workspaceId: string;
  notes: readonly NoteSummary[];
  projectNames: Map<string, string>;
  now: number | null;
}) {
  const sections = groupMeetings(notes);

  return (
    <Sheet>
      <HeadRow />
      {sections.map((section) => (
        <div key={section.key}>
          <SectionRow label={section.label} order={section.order} />
          {section.notes.map((note) => (
            <MeetingRow
              key={note.noteId}
              note={note}
              workspaceId={workspaceId}
              projectName={projectNames.get(note.projectId)}
              now={now}
            />
          ))}
        </div>
      ))}
    </Sheet>
  );
}
