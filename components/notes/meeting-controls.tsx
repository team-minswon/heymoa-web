"use client";

import { useState } from "react";
import { CalendarDays, CircleStop, Eye, Pause } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { MeetingEndDialog } from "@/components/notes/meeting-end-dialog";
import { Button } from "@/components/ui/button";
import type { NoteResponseData } from "@/lib/api/generated/models";
import type { NoteResponseDataMeetingStatus } from "@/lib/api/generated/models";
import { MEETING_STATUS_LABEL } from "@/lib/notes/meeting-state";
import { cn } from "@/lib/utils";

/**
 * 회의 상태 칩. design.pen `u3yYCX`/`XtEMZ`의 Note Header 첫 줄 — 6px 점 또는 아이콘 하나에
 * 11px semibold 라벨이 붙는다. 배경 없는 칩이라 프로젝트 pill과 나란히 놓여도 안 싸운다.
 *
 * **기록 중만 붉다.** 나머지는 muted다 — 종료·중지·시작 전은 사건이 아니라 상태다.
 * 라벨은 `MEETING_STATUS_LABEL`을 그대로 쓴다(목록 행과 같은 이름). 정본은 「예정」이라고
 * 적혀 있지만 목록이 「시작 전」으로 부르는 같은 상태라, 화면마다 다르게 부르지 않는다.
 */
export function MeetingStatusChip({
  status,
}: {
  status: NoteResponseDataMeetingStatus;
}) {
  const live = status === "IN_PROGRESS";
  const Icon =
    status === "NOT_STARTED" ? CalendarDays : status === "PAUSED" ? Pause : null;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-[11px] font-semibold",
        live ? "text-destructive" : "text-[var(--el-muted)]"
      )}
    >
      {Icon ? (
        <Icon className="size-3.5" aria-hidden />
      ) : (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            live ? "bg-destructive" : "bg-[var(--el-muted)]"
          )}
        />
      )}
      {MEETING_STATUS_LABEL[status]}
    </span>
  );
}

/**
 * 참관 칩. 기록 중인데 내가 시작자가 아닐 때 선다 — 회의 제어가 왜 없는지를 그 자리에서
 * 말해 준다(design.pen `BiafK`). 예전에는 헤더가 시작자 아바타와 이름을 그렸는데, 제어가
 * 없는 이유는 여전히 화면 어디에도 없었다. 시작자가 누구인지는 아래 메타 줄이 말한다.
 */
export function MeetingViewerChip() {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--el-muted)]">
      <Eye className="size-3.5" aria-hidden />
      참관
    </span>
  );
}

/**
 * 회의 제어. design.pen의 Meeting Bar는 **회의 종료 하나뿐이다** — 상태 칩은 헤더 첫 줄로,
 * 초 단위 타이머는 레코더 독(`qYRCW`)으로 갔다. 예전에는 이 그룹이 상태 배지·누적 타이머·
 * 시작자 아바타까지 들고 있어서 조용한 헤더에서 이 줄만 소리쳤다.
 */
export function MeetingControls({
  note,
  onMeetingEnded,
}: {
  note: NoteResponseData;
  /** 종료 접수 후 호출 — note-panel이 요약 탭으로 넘긴다. */
  onMeetingEnded?: () => void;
}) {
  const { user } = useAuth();
  const [endOpen, setEndOpen] = useState(false);

  const startedBy = note.meetingStartedBy;
  const isStarter = Boolean(
    user && startedBy && startedBy.userId === user.userId
  );
  const canEnd =
    isStarter &&
    (note.meetingStatus === "IN_PROGRESS" || note.meetingStatus === "PAUSED");

  if (!canEnd) return null;

  return (
    <div
      role="group"
      aria-label="회의 상태 및 제어"
      className="flex shrink-0 items-center gap-3"
    >
      <Button
        type="button"
        variant="outline"
        // design.pen `Dpy5O`: h32 · r8 · destructive 테두리와 글자 · 12px. 예전에 붉은
        // 테두리를 뺀 것은 이 버튼이 h-10이던 때의 이야기다 — 32px에 12px 글자면 정본대로
        // 둘러도 헤더에서 튀지 않고, 종료는 다이얼로그가 한 번 더 확인한다.
        className="h-8 gap-1.5 rounded-control border-destructive px-2.5 text-xs text-destructive hover:text-destructive"
        onClick={() => setEndOpen(true)}
      >
        <CircleStop className="size-4" />
        회의 종료
      </Button>
      <MeetingEndDialog
        noteId={note.noteId}
        meetingStatus={note.meetingStatus}
        open={endOpen}
        onOpenChange={setEndOpen}
        onEnded={onMeetingEnded}
      />
    </div>
  );
}
