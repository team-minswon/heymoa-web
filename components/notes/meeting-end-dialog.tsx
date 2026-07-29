"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Mic } from "lucide-react";
import { toast } from "sonner";

import {
  isNoteRecordingActive,
  isRecordingStarting,
  useRecording,
} from "@/components/transcription/recording-provider";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  getGetLatestAnalysisQueryKey,
  useEndMeeting,
} from "@/lib/api/generated/analysis/analysis";
import {
  getGetNoteQueryKey,
  type getNoteResponse,
} from "@/lib/api/generated/notes/notes";
import type { NoteResponseData } from "@/lib/api/generated/models";
import { getRecordedDurationMs } from "@/lib/notes/meeting-state";
import { isProjectNotesQueryKey } from "@/lib/notes/query-keys";

/** 기록 중이면 로컬 stop 성공을 확인한 뒤 같은 확인 흐름에서 회의를 종료한다. */
export function MeetingEndDialog({
  noteId,
  meetingStatus,
  open,
  onOpenChange,
  onEnded,
}: {
  noteId: string;
  meetingStatus: NoteResponseData["meetingStatus"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 종료가 접수된(202) 뒤 호출 — 호출부가 요약 탭으로 넘겨 분석 진행을 보인다. */
  onEnded?: () => void;
}) {
  const queryClient = useQueryClient();
  const recording = useRecording();
  // 인라인 차단 안내가 사유를 소유하므로 전역 토스트는 끈다 — 인라인이 없는 실패만 토스트한다.
  const endMeeting = useEndMeeting({
    mutation: { meta: { suppressErrorToast: true } },
  });
  /** 서버가 활성 전사 세션으로 종료를 막았는가(로컬 상태로는 안 보일 수 있다). */
  const [serverBlocked, setServerBlocked] = useState(false);
  const [stopFailed, setStopFailed] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // 다이얼로그가 닫히거나(재오픈) noteId가 바뀌면 지난 차단 상태를 접는다 — 그 사이 원격
  // 녹음이 끝났을 수 있다. 렌더 중 상태 조정(React 공식 패턴).
  const [context, setContext] = useState(`${noteId}:${open}`);
  if (context !== `${noteId}:${open}`) {
    setContext(`${noteId}:${open}`);
    if (serverBlocked) setServerBlocked(false);
    if (stopFailed) setStopFailed(false);
  }

  const localRecording = isNoteRecordingActive(recording, noteId);
  const starting = isRecordingStarting(recording, noteId);
  const convergeEnded = async (
    stoppedAt?: number,
    localSessionStartedAt?: string | null
  ) => {
    await queryClient.cancelQueries({
      queryKey: getGetNoteQueryKey(noteId),
    });
    queryClient.setQueryData<getNoteResponse>(
      getGetNoteQueryKey(noteId),
      (prev) =>
        prev?.status === 200 && prev.data.success
          ? {
              ...prev,
              data: {
                ...prev.data,
                data: {
                  ...prev.data.data,
                  ...(stoppedAt === undefined
                    ? {}
                    : {
                        recordedDurationMs: getRecordedDurationMs(
                          {
                            ...prev.data.data,
                            activeSessionStartedAt:
                              prev.data.data.activeSessionStartedAt ??
                              localSessionStartedAt ??
                              null,
                          },
                          stoppedAt
                        ),
                        activeSessionStartedAt: null,
                      }),
                  meetingStatus: "ENDED",
                },
              },
            }
          : prev
    );
    onOpenChange(false);
    void queryClient.invalidateQueries({
      queryKey: getGetNoteQueryKey(noteId),
    });
    void queryClient.invalidateQueries({
      predicate: ({ queryKey }) => isProjectNotesQueryKey(queryKey),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetLatestAnalysisQueryKey(noteId),
    });
    onEnded?.();
  };

  const requestEnd = (
    stoppedAt?: number,
    localSessionStartedAt?: string | null
  ) =>
    endMeeting.mutate(
      { noteId },
      {
        onSuccess: () => {
          setServerBlocked(false);
          void convergeEnded(stoppedAt, localSessionStartedAt);
        },
        onError: (error) => {
          const code = errorCodeOf(error);
          if (code === "MEETING_ALREADY_ENDED") {
            void convergeEnded(stoppedAt, localSessionStartedAt);
            return;
          }
          if (code === "ACTIVE_TRANSCRIPTION_SESSION") {
            setServerBlocked(true);
            return;
          }
          toast.error(errorMessageOf(error, "회의를 종료하지 못했습니다."));
        },
      }
    );

  const confirmEnd = async () => {
    if (starting) return;
    setStopFailed(false);
    let stoppedAt: number | undefined;
    let localSessionStartedAt: string | null | undefined;
    if (
      meetingStatus === "IN_PROGRESS" &&
      localRecording &&
      recording.phase !== "failed"
    ) {
      setIsStopping(true);
      let stopped = false;
      try {
        stopped = await recording.stop();
      } catch {
        stopped = false;
      } finally {
        setIsStopping(false);
      }
      if (!stopped) {
        setStopFailed(true);
        return;
      }
      localSessionStartedAt = recording.session?.startedAt;
      stoppedAt = Date.now();
    }
    requestEnd(stoppedAt, localSessionStartedAt);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>회의를 종료할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {meetingStatus === "IN_PROGRESS"
              ? "현재 기록을 먼저 안전하게 저장한 뒤 회의를 종료하고 요약을 시작합니다."
              : "회의를 종료하고 요약을 시작합니다. 이후에는 전사를 다시 시작할 수 없습니다."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-3 py-2.5 text-xs text-[var(--el-muted)]">
          <Mic className="size-3.5" />
          녹음 상태 · {meetingStatus === "IN_PROGRESS" ? "기록 중" : "중지됨"}
        </div>

        {stopFailed || serverBlocked ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-block border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] p-3"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--el-error)]" />
            <p className="text-xs leading-relaxed text-[var(--el-body)]">
              {stopFailed
                ? "현재 기록을 안전하게 저장하지 못했습니다. 기록 상태를 확인한 뒤 다시 시도해 주세요."
                : "다른 탭·기기에서 기록 중입니다. 해당 기록이 중지된 뒤 다시 시도해 주세요."}
            </p>
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>닫기</AlertDialogCancel>
          <Button
            className="h-11"
            disabled={endMeeting.isPending || isStopping || starting}
            onClick={() => void confirmEnd()}
          >
            {starting
              ? "연결 중…"
              : isStopping
                ? "기록 저장 중…"
                : serverBlocked
                  ? "다시 시도"
                  : "회의 종료"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
