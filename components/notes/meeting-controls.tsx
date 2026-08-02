"use client";

import { useState } from "react";
import { Square } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { MeetingEndDialog } from "@/components/notes/meeting-end-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NoteResponseData } from "@/lib/api/generated/models";
import {
  getRecordedDurationMs,
  MEETING_STATUS_LABEL,
} from "@/lib/notes/meeting-state";
import { useAlignedNow } from "@/lib/notes/use-aligned-now";

function formatRecordedClock(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(
    totalSeconds % 60
  ).padStart(2, "0")}`;
}

function RecordedTime({ elapsedMs }: { elapsedMs: number }) {
  return (
    <span
      role="timer"
      aria-label="누적 기록 시간"
      className="text-xs font-medium tabular-nums text-[var(--el-muted)]"
    >
      {formatRecordedClock(elapsedMs)}
    </span>
  );
}

export function MeetingControls({
  note,
  onMeetingEnded,
  showContext = false,
}: {
  note: NoteResponseData;
  /** 종료 접수 후 호출 — note-panel이 요약 탭으로 넘긴다. */
  onMeetingEnded?: () => void;
  /** side 헤더처럼 시작자에게도 상태와 시작자명을 함께 보여 주는 면. */
  showContext?: boolean;
}) {
  const { user } = useAuth();
  const [endOpen, setEndOpen] = useState(false);

  const startedBy = note.meetingStartedBy;
  const isStarter = Boolean(
    user && startedBy && startedBy.userId === user.userId
  );
  const now = useAlignedNow(
    1_000,
    note.meetingStatus === "IN_PROGRESS",
    note.activeSessionStartedAt ? [Date.parse(note.activeSessionStartedAt)] : []
  );
  const showStarter = Boolean(startedBy && (showContext || !isStarter));
  const canEnd =
    isStarter &&
    (note.meetingStatus === "IN_PROGRESS" || note.meetingStatus === "PAUSED");

  return (
    <div
      role="group"
      aria-label="회의 상태 및 제어"
      className="flex min-w-0 flex-wrap items-center gap-2"
    >
      <Badge variant="secondary">
        {MEETING_STATUS_LABEL[note.meetingStatus]}
      </Badge>
      <RecordedTime elapsedMs={getRecordedDurationMs(note, now ?? 0)} />
      {showStarter ? (
        <span className="max-w-16 truncate text-xs text-[var(--el-muted)] sm:max-w-none">
          {startedBy?.name}
          <span className="sr-only sm:not-sr-only">님이 시작한 회의</span>
        </span>
      ) : null}
      {canEnd ? (
        <Button
          type="button"
          variant="outline"
          size="xl"
          className="border-destructive/30 text-destructive"
          onClick={() => setEndOpen(true)}
        >
          <Square className="size-3.5" />
          회의 종료
        </Button>
      ) : null}
      {canEnd ? (
        <MeetingEndDialog
          noteId={note.noteId}
          meetingStatus={note.meetingStatus}
          open={endOpen}
          onOpenChange={setEndOpen}
          onEnded={onMeetingEnded}
        />
      ) : null}
    </div>
  );
}
