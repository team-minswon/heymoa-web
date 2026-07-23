"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Mic } from "lucide-react";
import { toast } from "sonner";

import {
  isNoteRecordingActive,
  isRecordingStarting,
  isRecordingStoppable,
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
import { getGetNoteQueryKey } from "@/lib/api/generated/notes/notes";

/**
 * 회의 종료 확인 다이얼로그. 종료하면 요약 분석이 시작되고 이후 전사를 시작할 수 없다.
 *
 * **녹음이 살아 있으면 계약상 409 `ACTIVE_TRANSCRIPTION_SESSION`이다.** 로컬 녹음 상태를
 * 힌트로 쓰되 **서버의 409를 권위로 삼는다** — 다른 탭·기기의 녹음이나 새로고침으로 로컬
 * 상태를 잃은 경우에도 종료가 막히는 이유를 화면에 보인다.
 *
 * 정리 동작은 상태로 갈린다: 살아 있는 컨트롤러가 있으면 `stop()`(곱게), 실패로 컨트롤러가
 * 비었으면 `disconnect()`(강제), 서버만 활성이라 로컬이 없으면 재시도(서버가 정리하면 통한다).
 */
export function MeetingEndDialog({
  noteId,
  open,
  onOpenChange,
  onEnded,
}: {
  noteId: string;
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

  // 다이얼로그가 닫히거나(재오픈) noteId가 바뀌면 지난 차단 상태를 접는다 — 그 사이 원격
  // 녹음이 끝났을 수 있다. 렌더 중 상태 조정(React 공식 패턴).
  const [context, setContext] = useState(`${noteId}:${open}`);
  if (context !== `${noteId}:${open}`) {
    setContext(`${noteId}:${open}`);
    if (serverBlocked) setServerBlocked(false);
  }

  const localRecording = isNoteRecordingActive(recording, noteId);
  const stoppable = isRecordingStoppable(recording, noteId);
  const starting = isRecordingStarting(recording, noteId);
  const blocked = localRecording || serverBlocked;

  const confirmEnd = () =>
    endMeeting.mutate(
      { noteId },
      {
        onSuccess: () => {
          setServerBlocked(false);
          onOpenChange(false);
          void queryClient.invalidateQueries({
            queryKey: getGetNoteQueryKey(noteId),
          });
          void queryClient.invalidateQueries({
            queryKey: getGetLatestAnalysisQueryKey(noteId),
          });
          // 202 → 분석이 시작됐다. 어느 탭에서 종료했든 요약 탭으로 넘겨 진행을 보인다.
          onEnded?.();
        },
        onError: (error) => {
          // 로컬이 녹음 아님이라 봐도 서버는 활성 세션이 남아 막을 수 있다 — 차단 상태로 전환.
          if (errorCodeOf(error) === "ACTIVE_TRANSCRIPTION_SESSION") {
            setServerBlocked(true);
            return;
          }
          // 인라인으로 못 다루는 실패만 토스트한다(전역 토스트는 껐다).
          toast.error(errorMessageOf(error, "회의를 종료하지 못했습니다."));
        },
      }
    );

  const description = stoppable
    ? "아직 녹음 중입니다. 먼저 녹음을 중지해야 회의를 종료할 수 있습니다."
    : starting
      ? "녹음을 연결하는 중입니다. 연결이 끝나면 녹음을 중지한 뒤 종료해 주세요."
      : "녹음 세션이 아직 활성입니다. 다른 탭·기기의 녹음을 종료했거나 세션이 정리되면 다시 시도해 주세요.";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>회의를 종료할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            종료하면 요약 분석이 시작되고, 이후에는 이 회의의 전사를 다시 시작할 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-2 rounded-xl border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-3 py-2.5 text-xs text-[var(--el-muted)]">
          <Mic className="size-3.5" />
          녹음 상태 · {blocked ? "활성" : "대기"}
        </div>

        {blocked ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] p-3"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--el-error)]" />
            <p className="text-xs leading-relaxed text-[var(--el-body)]">
              {description}
            </p>
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>닫기</AlertDialogCancel>
          {stoppable ? (
            // 살아 있는 컨트롤러가 있으면 곱게 멈춘다.
            <Button variant="destructive" onClick={() => void recording.stop()}>
              녹음 중지
            </Button>
          ) : starting ? (
            // 시작 중 종료하면 서버 세션이 아직 없어 성공해 버리고, 이어지는 start()가 종료된
            // 노트에 고아 세션을 만든다 — 연결이 끝날 때까지 종료를 막는다.
            <Button disabled>연결 중…</Button>
          ) : blocked ? (
            // 실패로 컨트롤러를 잃었거나 서버만 활성이다 — 클라이언트가 세션을 끝낼 수 없으니
            // 재시도로 서버의 세션 정리(폴링 reconcile)를 기다린다. disconnect는 폴링을 끊어 오히려 복구를 막는다.
            <Button disabled={endMeeting.isPending} onClick={confirmEnd}>
              다시 시도
            </Button>
          ) : (
            <Button disabled={endMeeting.isPending} onClick={confirmEnd}>
              회의 종료
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
