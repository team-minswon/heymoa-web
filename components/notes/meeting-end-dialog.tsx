"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Mic, Users } from "lucide-react";
import { toast } from "@/lib/ui/toast";

import {
  type Participant,
  ParticipantAvatar,
} from "@/components/notes/note-participants";
import {
  isRecordingStarting,
  useRecording,
} from "@/components/transcription/recording-provider";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { invalidateNoteLists } from "@/lib/notes/invalidate";
import { cn } from "@/lib/utils";

/** 중지된 회의를 확인 한 번으로 종료한다. 기록 중이면 서버가 409 MEETING_RECORDING 을 준다. */
export function MeetingEndDialog({
  noteId,
  meetingStatus,
  participants,
  open,
  onOpenChange,
  onEnded,
  onEditParticipants,
}: {
  noteId: string;
  meetingStatus: NoteResponseData["meetingStatus"];
  /**
   * 서버는 **종료 순간**의 참여자 수를 화자 분리의 최대 화자 수로 쓴다(APP-1098). 종료 뒤에
   * 넣은 참여자는 반영되지 않고, 말한 사람보다 적게 넣으면 화자가 합쳐진다. 서버는 2명
   * 미만이면 화자 수를 알려 주지 않는다 — 그래서 수만이 아니라 **누가 들어 있는지**를 보인다
   * (APP-1102).
   */
  participants: Participant[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 종료가 접수된(202) 뒤 호출 — 호출부가 요약 탭으로 넘겨 분석 진행을 보인다. */
  onEnded?: () => void;
  /** 창을 닫고 참여자를 고칠 수 있는 정보 탭으로 보낸다. 뷰(side·full)는 호출부가 유지한다. */
  onEditParticipants?: () => void;
}) {
  const queryClient = useQueryClient();
  const recording = useRecording();
  // 인라인 차단 안내가 사유를 소유하므로 전역 토스트는 끈다 — 인라인이 없는 실패만 토스트한다.
  const endMeeting = useEndMeeting({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [blocked, setBlocked] = useState<string | null>(null);

  // 다이얼로그가 닫히거나(재오픈) noteId가 바뀌면 지난 차단 상태를 접는다 — 그 사이 원격
  // 녹음이 끝났을 수 있다. 렌더 중 상태 조정(React 공식 패턴).
  const [context, setContext] = useState(`${noteId}:${open}`);
  if (context !== `${noteId}:${open}`) {
    setContext(`${noteId}:${open}`);
    if (blocked) setBlocked(null);
  }

  const starting = isRecordingStarting(recording, noteId);
  // 한 명 이하면 말한 사람이 적게 처리될 수 있어 경고 톤으로 그린다. 서버는 한 명이어도 그 수를
  // 화자 상한으로 보낸다(APP-1104, `DiarizationProperties.forMeeting`)
  const few = participants.length < 2;
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
    void invalidateNoteLists(queryClient);
    void queryClient.invalidateQueries({
      queryKey: getGetLatestAnalysisQueryKey(noteId),
    });
    onEnded?.();
  };

  const requestEnd = () => {
    if (starting) return;
    setBlocked(null);
    endMeeting.mutate(
      { noteId },
      {
        onSuccess: (response) => void convergeEnded(response),
        onError: (error) => {
          const code = errorCodeOf(error);
          if (code === "MEETING_ALREADY_ENDED") {
            void convergeEnded();
            return;
          }
          // 그 사이 누군가 기록을 시작했다(APP-694). 화면이 따라잡도록 노트를 다시 묻는다.
          if (code === "MEETING_RECORDING") {
            setBlocked(
              errorMessageOf(
                error,
                "기록 중인 회의는 중지한 뒤 종료할 수 있습니다."
              )
            );
            void queryClient.invalidateQueries({
              queryKey: getGetNoteQueryKey(noteId),
            });
            return;
          }
          toast.error(errorMessageOf(error, "회의를 종료하지 못했습니다."));
        },
      }
    );
  };

  // **종료 요청이 떠 있는 동안은 닫지 못하게 한다.** 이 창이 진행 표시(버튼 spinner)를 들고 있고,
  // 응답이 오면 `onEnded` 가 요약 탭으로 넘긴다. 배경·X·Esc 도 같은 길로 막힌다(APP-1105).
  const busy = endMeeting.isPending || starting;
  const handleOpenChange = (next: boolean) => {
    if (!next && busy) return;
    onOpenChange(next);
  };

  return (
    // **일반 `Dialog` 다** — 배경 클릭·Esc·우측 상단 X 로 닫힌다. 예전 `AlertDialog` 는 배경을 눌러도
    // 안 닫히고 X 도 없어 빠져나갈 길이 하단 버튼 하나뿐이었다(APP-1105). 종료는 이 창 안의
    // `회의 종료` 를 눌러야만 일어나므로 가볍게 닫혀도 잃는 것이 없다.
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* 진행 중에는 X 를 그리지 않고 취소를 잠근다 — 눌러도 안 닫히는 활성 버튼을 두지 않는다 */}
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>회의를 종료할까요?</DialogTitle>
          {/* 참여자 안내도 설명 안에 둔다 — 창의 `aria-describedby`가 이 요소 하나만 가리켜서
              밖에 두면 스크린리더가 창을 열 때 읽지 않는다(codex 리뷰 1회차). 칩 목록(`ul`)이
              들어가므로 기본 `<p>` 가 아니라 `<div>` 로 그린다. */}
          <DialogDescription render={<div />}>
            <p>
              회의를 종료하고 요약을 시작합니다. 이후에는 스크립트를 다시 시작할
              수 없습니다.
            </p>
            <section
              aria-label="회의 참여자"
              className={cn(
                "mt-3 rounded-block border p-3",
                few
                  ? "border-[var(--el-warning-strong)]/30 bg-[var(--el-warning-strong)]/[0.06]"
                  : "border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]"
              )}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--el-ink)]">
                {few ? (
                  <AlertTriangle className="size-3.5 text-[var(--el-warning-strong)]" />
                ) : (
                  <Users className="size-3.5 text-[var(--el-muted)]" />
                )}
                참여자 {participants.length}명
              </div>
              {participants.length > 0 ? (
                <ul className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {participants.map((participant) => (
                    <li
                      key={participant.participantId}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--el-hairline)] bg-[var(--el-canvas)] py-0.5 pr-2.5 pl-0.5 text-xs text-[var(--el-ink)]"
                    >
                      <ParticipantAvatar
                        participant={participant}
                        interactive={false}
                      />
                      {participant.name}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2 text-xs leading-relaxed text-[var(--el-body)]">
                {participants.length === 0
                  ? "참여자가 없어 화자 수를 정하지 않고 나눕니다. 말한 사람을 참여자로 지정하면 화자 분리가 더 정확해집니다."
                  : few
                    ? "참여자가 1명이라 말한 사람이 1명으로 처리됩니다. 여러 명이 말했다면 먼저 참여자를 지정해 주세요. 종료 뒤에 추가한 참여자는 이번 화자 분리에 반영되지 않습니다."
                    : "말한 사람이 모두 들어 있나요? 실제로 말한 사람보다 참여자가 적으면 화자가 합쳐질 수 있고, 종료 뒤에 추가한 참여자는 이번 화자 분리에 반영되지 않습니다."}
              </p>
            </section>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-3 py-2.5 text-xs text-[var(--el-muted)]">
          <Mic className="size-3.5" />
          녹음 상태 · {meetingStatus === "IN_PROGRESS" ? "기록 중" : "중지됨"}
        </div>

        {blocked ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-block border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] p-3"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--el-error)]" />
            <p className="text-xs leading-relaxed text-[var(--el-body)]">
              {blocked}
            </p>
          </div>
        ) : null}

        <DialogFooter>
          {/* 우측 상단 X 의 이름이 「닫기」라 같은 이름을 또 두지 않는다 */}
          <DialogClose render={<Button variant="outline" disabled={busy} />}>
            취소
          </DialogClose>
          {onEditParticipants ? (
            // 종료 요청이 떠 있는 동안은 막는다 — 응답이 오면 `onEnded`가 요약 탭으로 다시
            // 데려가고, 종료 순간의 참여자 수는 이미 정해진 뒤다(codex 리뷰 1회차).
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                onOpenChange(false);
                onEditParticipants();
              }}
            >
              참여자 지정하러 가기
            </Button>
          ) : null}
          {/* 높이를 손으로 주지 않는다 — `h-11`(44)이 `닫기`의 기본 높이와 달라 같은 줄에서
              두 버튼 크기가 어긋났다. 진행 표시는 문구 교체가 아니라 `loading`으로 준다. */}
          <Button
            loading={busy}
            disabled={busy}
            onClick={requestEnd}
          >
            회의 종료
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
