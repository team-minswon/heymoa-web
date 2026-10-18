"use client";

import { useState } from "react";
import { CircleCheck, FileText, UserPlus, Users } from "lucide-react";

import { MeetingEndDialog } from "@/components/notes/meeting-end-dialog";
import { Button } from "@/components/ui/button";
import type { NoteResponseData } from "@/lib/api/generated/models";

/**
 * 종료 전 요약 탭. **회의를 종료하면 무엇이 생기는지를 말한다.**
 *
 * 운영에서 회의를 중지만 하고 종료하지 않는 사람이 많았다. 종료해야 화자 분리·요약·검토가 생기는데,
 * 한 줄짜리 안내는 그것을 알려 주지 못했다. 점이나 배지로 끌지 않고, 이 탭을 연 사람에게 충분히
 * 알린다.
 *
 * 문구가 말하는 사실은 확인한 것만이다 — 종료 뒤에는 이어서 녹음할 수 없다(서버가
 * `MeetingAlreadyEndedException`), 요약은 운영 로그상 종료 후 10~30초에 생긴다.
 */
const STEPS = [
  {
    icon: FileText,
    title: "요약",
    body: "개요, 결정, 액션 아이템을 자동으로 정리해요.",
  },
  {
    icon: Users,
    title: "화자 분리",
    body: "목소리를 사람별로 나누고, 누구인지 이름을 붙일 수 있어요.",
  },
  {
    icon: CircleCheck,
    title: "검토 후 확정",
    body: "정리된 항목을 확인하고 고친 뒤 프로젝트 지식으로 확정해요.",
  },
] as const;

export function PreEndGuide({
  note,
  onEditParticipants,
  onMeetingEnded,
}: {
  note: NoteResponseData | null | undefined;
  /** 참여자 안내의 「참여자 추가」 — note-panel이 정보 탭으로 넘긴다. */
  onEditParticipants?: () => void;
  /** 종료 접수 후 호출 — note-panel이 요약 탭을 새로 그린다. */
  onMeetingEnded?: () => void;
}) {
  const [endOpen, setEndOpen] = useState(false);
  // 기록 중에는 서버가 종료를 거절한다. 중지한 뒤에만 버튼을 둔다.
  const canEnd = note?.meetingStatus === "PAUSED";
  const recording = note?.meetingStatus === "IN_PROGRESS";
  const lonely = note != null && note.participants.length <= 1;

  return (
    <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pt-6 pb-16">
      <div
        data-testid="pre-end-guide"
        className="rounded-panel border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-6"
      >
        <h3 className="text-base font-medium text-[var(--el-ink)]">
          회의를 종료하면 이런 것들이 만들어져요
        </h3>
        <p className="mt-1 text-xs text-[var(--el-muted)]">
          보통 종료 후 1분 안에 준비돼요. 종료 전에는 볼 수 없어요.
        </p>

        <ol className="mt-5 divide-y divide-[var(--el-hairline)]">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3 py-3 first:pt-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--el-surface-strong)] text-[var(--el-ink)]">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--el-ink)]">
                  {title}
                </span>
                <span className="block text-xs leading-relaxed text-[var(--el-muted)]">
                  {body}
                </span>
              </span>
            </li>
          ))}
        </ol>

        {lonely && onEditParticipants ? (
          <div
            data-testid="pre-end-guide-participants"
            className="mt-2 flex items-center gap-3 rounded-block bg-[var(--el-surface-strong)] px-3 py-2.5 text-xs text-[var(--el-muted)]"
          >
            <UserPlus
              className="size-4 shrink-0 text-[var(--el-ink)]"
              aria-hidden
            />
            <span className="flex-1">
              참여자가 1명이에요. 종료하기 전에 추가하면 화자를 더 정확히
              나눠요.
            </span>
            <button
              type="button"
              onClick={onEditParticipants}
              className="shrink-0 text-[var(--el-ink)] underline underline-offset-2"
            >
              참여자 추가
            </button>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--el-muted-soft)]">
            {recording
              ? "기록을 중지하면 회의를 종료할 수 있어요."
              : canEnd
                ? "종료한 뒤에는 이어서 녹음할 수 없어요."
                : null}
          </p>
          {canEnd && note ? (
            <Button type="button" size="sm" onClick={() => setEndOpen(true)}>
              회의 종료
            </Button>
          ) : null}
        </div>
      </div>

      {note ? (
        <MeetingEndDialog
          noteId={note.noteId}
          meetingStatus={note.meetingStatus}
          participants={note.participants}
          open={endOpen}
          onOpenChange={setEndOpen}
          onEnded={onMeetingEnded}
          onEditParticipants={onEditParticipants}
        />
      ) : null}
    </div>
  );
}
