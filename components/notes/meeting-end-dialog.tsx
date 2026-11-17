"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Mic, Users } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { REQUEST_TIMEOUT_MS } from "@/lib/api/fetcher";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  type endMeetingResponse,
  getGetLatestAnalysisQueryKey,
  getGetAnalysisFlowQueryKey,
  useEndMeeting,
} from "@/lib/api/generated/analysis/analysis";
import {
  getGetNoteQueryKey,
  type getNoteResponse,
} from "@/lib/api/generated/notes/notes";
import type { NoteResponseData } from "@/lib/api/generated/models";
import { invalidateNoteLists } from "@/lib/notes/invalidate";
import { MEETING_STATUS_KEY } from "@/lib/notes/meeting-state";
import { cn } from "@/lib/utils";

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
  participants: Participant[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnded?: () => void;
  onEditParticipants?: () => void;
}) {
  const t = useTranslations("notes.endDialog");
  const tActions = useTranslations("common.actions");
  const tStatus = useTranslations("common.meetingStatus");
  const queryClient = useQueryClient();
  const recording = useRecording();
  const endMeeting = useEndMeeting({
    request: { timeoutMs: REQUEST_TIMEOUT_MS },
    mutation: {
      meta: { suppressErrorToast: true },
      onSuccess: (response) => void convergeEnded(response),
      onError: (error) => {
        const code = errorCodeOf(error);
        if (code === "MEETING_ALREADY_ENDED") {
          void convergeEnded();
          return;
        }
        if (code === "MEETING_RECORDING") {
          setBlocked(errorMessageOf(error, t("recordingBlocked")));
          void queryClient.invalidateQueries({
            queryKey: getGetNoteQueryKey(noteId),
          });
          return;
        }
        toast.error(errorMessageOf(error, t("failed")));
      },
    },
  });
  const [blocked, setBlocked] = useState<string | null>(null);

  const [context, setContext] = useState(`${noteId}:${open}`);
  if (context !== `${noteId}:${open}`) {
    setContext(`${noteId}:${open}`);
    if (blocked) setBlocked(null);
  }

  const starting = isRecordingStarting(recording, noteId);
  const few = participants.length < 2;
  const convergeEnded = async (ended?: endMeetingResponse) => {
    await queryClient.cancelQueries({ queryKey: getGetNoteQueryKey(noteId) });
    if (ended?.status === 200 && ended.data.success) {
      queryClient.setQueryData<getNoteResponse>(
        getGetNoteQueryKey(noteId),
        ended as unknown as getNoteResponse
      );
    } else {
      void queryClient.invalidateQueries({
        queryKey: getGetNoteQueryKey(noteId),
      });
    }
    const flowKey = getGetAnalysisFlowQueryKey(noteId);
    await queryClient.cancelQueries({ queryKey: flowKey });
    void queryClient.invalidateQueries({ queryKey: flowKey });
    onOpenChange(false);
    void invalidateNoteLists(queryClient);
    void queryClient.invalidateQueries({
      queryKey: getGetLatestAnalysisQueryKey(noteId),
    });
    onEnded?.();
  };

  const requestEnd = () => {
    if (starting) return;
    setBlocked(null);
    endMeeting.mutate({ noteId });
  };

  const busy = endMeeting.isPending || starting;
  const handleOpenChange = (next: boolean) => {
    if (!next && busy) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          {/* 참여자 안내도 설명 안에 둔다 — 창의 `aria-describedby` 가 이 요소 하나만 가리켜, 밖에 두면 스크린리더가 창을 열 때 읽지 않는다. */}
          <DialogDescription render={<div />}>
            <p>{t("description")}</p>
            <section
              aria-label={t("participantsLabel")}
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
                {t("participantCount", { count: participants.length })}
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
                  ? t("participantsNone")
                  : few
                    ? t("participantsOne")
                    : t("participantsMany")}
              </p>
            </section>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-3 py-2.5 text-xs text-[var(--el-muted)]">
          <Mic className="size-3.5" />
          {t("recordingStatus", {
            status: tStatus(
              MEETING_STATUS_KEY[
                meetingStatus === "IN_PROGRESS" ? "IN_PROGRESS" : "PAUSED"
              ]
            ),
          })}
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
          <DialogClose render={<Button variant="outline" disabled={busy} />}>
            {tActions("cancel")}
          </DialogClose>
          {onEditParticipants ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                onOpenChange(false);
                onEditParticipants();
              }}
            >
              {t("editParticipants")}
            </Button>
          ) : null}
          <Button loading={busy} disabled={busy} onClick={requestEnd}>
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
