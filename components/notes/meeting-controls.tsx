"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Square } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { MeetingEndDialog } from "@/components/notes/meeting-end-dialog";
import {
  isNoteRecordingActive,
  isRecordingStoppable,
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
        <span className="text-xs text-[var(--el-muted)]">
          {startedBy.name}님이 시작한 회의
        </span>
      </div>
    );
  }

  const isPending = pauseMeeting.isPending || resumeMeeting.isPending;
  // 녹음 중이면 계약상 meeting-pause가 ACTIVE_TRANSCRIPTION_SESSION(409)로 항상 막힌다 —
  // 종료와 같은 "먼저 녹음 중지" 흐름을 준다. failed지만 세션이 열린 경우도 활성으로 보고,
  // 그때는 stop()이 no-op이라 disconnect()로 강제 정리한다.
  const isRecording = isNoteRecordingActive(recording, note.noteId);
  const stoppable = isRecordingStoppable(recording, note.noteId);

  return (
    <div className="flex items-center gap-2">
      {status === "IN_PROGRESS" ? (
        stoppable ? (
          // 살아 있는 컨트롤러가 있으면 곱게 멈춘다(그 뒤에 중지할 수 있다).
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => void recording.stop()}
          >
            <Square className="size-3.5" />
            녹음 중지
          </Button>
        ) : isRecording ? (
          // failed로 컨트롤러를 잃었지만 서버 세션이 살아 있다 — 클라이언트가 끝낼 수 없으니
          // 세션이 정리(폴링 reconcile)될 때까지 중지를 막는다(항상 409를 부르지 않게).
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled
            title="녹음 세션이 정리되면 중지할 수 있습니다"
          >
            <Pause className="size-3.5" />
            중지
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={isPending}
            onClick={() =>
              pauseMeeting.mutate({ noteId: note.noteId }, { onSuccess: refetchNote })
            }
          >
            <Pause className="size-3.5" />
            중지
          </Button>
        )
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
          재개
        </Button>
      )}
      <Button size="sm" className="h-8" onClick={() => setEndOpen(true)}>
        <Square className="size-3.5" />
        회의 종료
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
