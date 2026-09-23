"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Mic } from "lucide-react";
import { toast } from "@/lib/ui/toast";

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
  type endMeetingResponse,
  getGetLatestAnalysisQueryKey,
  useEndMeeting,
} from "@/lib/api/generated/analysis/analysis";
import {
  getGetNoteQueryKey,
  type getNoteResponse,
} from "@/lib/api/generated/notes/notes";
import type { NoteResponseData } from "@/lib/api/generated/models";
import { isNoteListQueryKey } from "@/lib/notes/query-keys";

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
  const [stopFailed, setStopFailed] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // 다이얼로그가 닫히거나(재오픈) noteId가 바뀌면 지난 차단 상태를 접는다 — 그 사이 원격
  // 녹음이 끝났을 수 있다. 렌더 중 상태 조정(React 공식 패턴).
  const [context, setContext] = useState(`${noteId}:${open}`);
  if (context !== `${noteId}:${open}`) {
    setContext(`${noteId}:${open}`);
    if (stopFailed) setStopFailed(false);
  }

  const localRecording = isNoteRecordingActive(recording, noteId);
  const starting = isRecordingStarting(recording, noteId);
  /**
   * **서버가 준 노트를 그대로 캐시에 넣는다** (APP-685).
   *
   * 전에는 종료가 204 라 화면이 종료 뒤 상태를 **스스로 지어냈다** — 녹음 길이를 브라우저의
   * `Date.now()` 로 계산했고, 시계가 서로 다른 두 사람이 같은 회의를 다른 길이로 봤다.
   * 이제 응답이 갱신된 노트이고 `meetingEndedAt` 은 서버가 찍은 시각이다.
   */
  const convergeEnded = async (ended?: endMeetingResponse) => {
    await queryClient.cancelQueries({ queryKey: getGetNoteQueryKey(noteId) });
    if (ended?.status === 200 && ended.data.success) {
      // 종료 응답과 노트 조회는 **같은 `NoteResponse`** 다. 서버가 그렇게 맞춰 뒀다.
      queryClient.setQueryData<getNoteResponse>(
        getGetNoteQueryKey(noteId),
        ended as unknown as getNoteResponse
      );
    } else {
      // 이미 끝난 회의였다 — 응답에 노트가 없다. 지어내지 말고 다시 묻는다.
      void queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) });
    }
    onOpenChange(false);
    // 목록 항목이 상태와 시간을 보여주므로 같이 비운다. 응답 하나로는 못 대신한다.
    void queryClient.invalidateQueries({
      predicate: ({ queryKey }) => isNoteListQueryKey(queryKey),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetLatestAnalysisQueryKey(noteId),
    });
    onEnded?.();
  };

  /**
   * **`ACTIVE_TRANSCRIPTION_SESSION` 분기가 사라졌다** (APP-685). 서버가 열린 세션을 거절
   * 대신 닫으므로 그 409 가 더 이상 오지 않는다. 그 거절이 강제하던 「STOMP stop → completed
   * 대기 → REST」 순서도 같이 사라졌다 — 아래에서 로컬 스트림을 먼저 끊는 것은 마이크를
   * 놓기 위해서지 서버가 요구해서가 아니다.
   */
  const requestEnd = () =>
    endMeeting.mutate(
      { noteId },
      {
        onSuccess: (response) => void convergeEnded(response),
        onError: (error) => {
          if (errorCodeOf(error) === "MEETING_ALREADY_ENDED") {
            void convergeEnded();
            return;
          }
          toast.error(errorMessageOf(error, "회의를 종료하지 못했습니다."));
        },
      }
    );

  const confirmEnd = async () => {
    if (starting) return;
    setStopFailed(false);
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
    }
    requestEnd();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>회의를 종료할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {meetingStatus === "IN_PROGRESS"
              ? "현재 기록을 먼저 안전하게 저장한 뒤 회의를 종료하고 요약을 시작합니다."
              : "회의를 종료하고 요약을 시작합니다. 이후에는 스크립트를 다시 시작할 수 없습니다."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-3 py-2.5 text-xs text-[var(--el-muted)]">
          <Mic className="size-3.5" />
          녹음 상태 · {meetingStatus === "IN_PROGRESS" ? "기록 중" : "중지됨"}
        </div>

        {stopFailed ? (
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
          {/* 높이를 손으로 주지 않는다 — `h-11`(44)이 `닫기`의 기본 높이와 달라 같은 줄에서
              두 버튼 크기가 어긋났다. 진행 표시도 문구 교체가 아니라 `loading`으로 준다:
              문구를 갈아 끼우면 버튼 폭이 「회의 종료」→「기록 저장 중…」으로 튄다. */}
          <Button
            loading={endMeeting.isPending || isStopping || starting}
            disabled={endMeeting.isPending || isStopping || starting}
            onClick={() => void confirmEnd()}
          >
            {/* 진행 중에도 **라벨을 갈지 않는다.** 공용 `Button`은 로딩 중에도 투명한
                children으로 폭을 잡으므로, 문구를 바꾸면 스피너가 도는 동안 버튼이
                「회의 종료」→「기록 저장 중…」으로 늘어난다. 무엇이 진행 중인지는 위
                본문이 말한다. */}
            회의 종료
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
