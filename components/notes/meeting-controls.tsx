"use client";

import { useState } from "react";
import { Square } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { MeetingEndDialog } from "@/components/notes/meeting-end-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NoteResponseData } from "@/lib/api/generated/models";

/**
 * 노트 앱바의 회의 조작. **조작권은 시작자 단독이다** — `meetingStartedBy.userId === 내 userId`.
 * 뷰어는 상태 pill과 "OO님이 시작한 회의"만 본다(왜 버튼이 없는지 읽히게). 403
 * `NOT_MEETING_STARTER`는 버튼을 숨겨 예방하므로 최후 방어선일 뿐이다.
 *
 * **남는 조작은 `회의 종료` 하나다** (APP-219). 회의 중지·재개(PAUSED)를 폐기하면서 "멈춤"의
 * 창구가 레코더 독 하나로 정리됐다 — 쉬는 시간에는 녹음만 멈추고 회의는 열어 둔다.
 */
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

  // 아직 아무도 녹음을 시작하지 않았으면 조작이 없다(녹음 독이 시작을 맡는다).
  if (!startedBy) return null;

  const context = (
    <>
      <Badge variant="secondary">
        {note.meetingStatus === "ENDED" ? "회의 종료됨" : "진행 중"}
      </Badge>
      <span className="max-w-16 truncate text-xs text-[var(--el-muted)] sm:max-w-none">
        {startedBy.name}
        <span className="sr-only sm:not-sr-only">님이 시작한 회의</span>
      </span>
    </>
  );

  if (note.meetingStatus === "ENDED") {
    return showContext ? (
      <div className="flex items-center gap-2">{context}</div>
    ) : (
      <Badge variant="secondary">회의 종료됨</Badge>
    );
  }

  const isStarter = Boolean(user && startedBy.userId === user.userId);

  if (!isStarter) {
    // 뷰어 — 조작 버튼 없이 상태와 시작자만.
    return <div className="flex items-center gap-2">{context}</div>;
  }

  return (
    <div className="flex items-center gap-2">
      {showContext ? context : null}
      <Button size="sm" className="h-8" onClick={() => setEndOpen(true)}>
        <Square className="size-3.5" />
        <span className="sr-only sm:not-sr-only">회의 종료</span>
      </Button>
      <MeetingEndDialog
        noteId={note.noteId}
        open={endOpen}
        onOpenChange={setEndOpen}
        onEnded={onMeetingEnded}
      />
    </div>
  );
}
