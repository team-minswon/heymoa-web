"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Square } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { MeetingEndDialog } from "@/components/notes/meeting-end-dialog";
import {
  isNoteRecordingActive,
  useRecording,
} from "@/components/transcription/recording-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getGetNoteQueryKey } from "@/lib/api/generated/notes/notes";
import {
  usePauseMeeting,
  useResumeMeeting,
} from "@/lib/api/generated/meeting/meeting";
import type { NoteResponseData } from "@/lib/api/generated/models";

/**
 * 노트 앱바의 회의 조작. **조작권은 시작자 단독이다** — `meetingStartedBy.userId === 내 userId`.
 * 뷰어는 상태 pill과 "OO님이 시작한 회의"만 본다(왜 버튼이 없는지 읽히게). 403
 * `NOT_MEETING_STARTER`는 버튼을 숨겨 예방하므로 최후 방어선일 뿐이다.
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
  const queryClient = useQueryClient();
  const recording = useRecording();
  const pauseMeeting = usePauseMeeting();
  const resumeMeeting = useResumeMeeting();
  const [endOpen, setEndOpen] = useState(false);

  const startedBy = note.meetingStartedBy;
  const status = note.meetingStatus;

  // 아직 아무도 녹음을 시작하지 않았으면 조작이 없다(녹음 독이 시작을 맡는다).
  if (!startedBy) return null;

  if (status === "ENDED") {
    return <Badge variant="secondary">회의 종료됨</Badge>;
  }

  const isStarter = Boolean(user && startedBy.userId === user.userId);

  const refetchNote = () =>
    void queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(note.noteId) });

  if (!isStarter) {
    // 뷰어 — 조작 버튼 없이 상태와 시작자만.
    return (
      <div className="flex items-center gap-2">
        <Badge variant={status === "PAUSED" ? "outline" : "secondary"}>
          {status === "PAUSED" ? "중지됨" : "진행 중"}
        </Badge>
        <span className="hidden text-xs text-[var(--el-muted)] sm:inline">
          {startedBy.name}님이 시작한 회의
        </span>
      </div>
    );
  }

  const isPending = pauseMeeting.isPending || resumeMeeting.isPending;
  // 녹음 중지는 레코더 독이 단독으로 맡는다(MOTION SPEC drift #7) — 여기선 recording.stop()을
  // 부르지 않는다. 녹음 중에는 계약상 meeting-pause가 ACTIVE_TRANSCRIPTION_SESSION(409)로
  // 막히므로 회의 중지를 비활성화하고 "먼저 녹음을 중지" 안내를 준다(독에서 녹음을 멈춘 뒤 중지).
  const isRecording = isNoteRecordingActive(recording, note.noteId);

  return (
    <div className="flex items-center gap-2">
      {status === "IN_PROGRESS" ? (
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={isPending || isRecording}
          title={
            isRecording ? "녹음을 중지한 뒤 회의를 중지할 수 있습니다" : undefined
          }
          onClick={() =>
            pauseMeeting.mutate({ noteId: note.noteId }, { onSuccess: refetchNote })
          }
        >
          <Pause className="size-3.5" />
          {/* 좁은 화면에서는 아이콘만 — 접근성 이름은 sr-only로 유지. */}
          <span className="sr-only sm:not-sr-only">중지</span>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={isPending}
          onClick={() =>
            resumeMeeting.mutate({ noteId: note.noteId }, { onSuccess: refetchNote })
          }
        >
          <Play className="size-3.5" />
          <span className="sr-only sm:not-sr-only">재개</span>
        </Button>
      )}
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
