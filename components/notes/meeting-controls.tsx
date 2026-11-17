"use client";

import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  CalendarDays,
  CircleCheck,
  CircleStop,
  FileText,
  Pause,
  Users,
} from "lucide-react";

import { MeetingEndDialog } from "@/components/notes/meeting-end-dialog";
import { CountdownBar, useNudgeMotion } from "@/components/notes/nudge-bubble";
import {
  isNoteRecordingActive,
  useRecording,
} from "@/components/transcription/recording-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NoteResponseData } from "@/lib/api/generated/models";
import type { NoteResponseDataMeetingStatus } from "@/lib/api/generated/models";
import { MEETING_STATUS_KEY } from "@/lib/notes/meeting-state";
import { useAuthUserId } from "@/components/auth/auth-provider";
import { readUserFlag, writeUserFlag } from "@/lib/storage/user-flags";
import { cn } from "@/lib/utils";

export function MeetingStatusChip({
  status,
}: {
  status: NoteResponseDataMeetingStatus;
}) {
  const tStatus = useTranslations("common.meetingStatus");
  const label = tStatus(MEETING_STATUS_KEY[status]);
  const live = status === "IN_PROGRESS";
  const Icon =
    status === "NOT_STARTED"
      ? CalendarDays
      : status === "PAUSED"
        ? Pause
        : null;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-[11px] font-semibold",
        live ? "text-destructive" : "text-[var(--el-muted)]"
      )}
      title={label}
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
      <span className="@max-[640px]/topbar:sr-only">{label}</span>
    </span>
  );
}

const NUDGE_MS = 15_000;

function nudgeSuppressed(userId: string | undefined) {
  return !userId || readUserFlag(userId, "endNudgeOff") === "1";
}

const NUDGE_ITEMS = [
  { icon: Users, key: "speakers" },
  { icon: FileText, key: "summary" },
  { icon: CircleCheck, key: "review" },
] as const;

function EndNudge({
  onLater,
  onEnd,
  onNever,
}: {
  onLater: () => void;
  onEnd: () => void;
  onNever: () => void;
}) {
  const t = useTranslations("notes.endNudge");
  const motionProps = useNudgeMotion("top right");
  return (
    <motion.div
      role="status"
      data-testid="end-nudge"
      {...motionProps}
      className="absolute top-[calc(100%+18px)] right-0 z-50 w-80 rounded-block border border-[var(--el-hairline-strong)] bg-[var(--el-surface-card)] shadow-xl"
    >
      <span
        aria-hidden
        className="absolute -top-[7px] right-10 size-3 rotate-45 border-t border-l border-[var(--el-hairline-strong)] bg-[var(--el-surface-card)]"
      />
      <div className="p-4">
        <p className="text-sm font-medium text-[var(--el-ink)]">
          {t("title")}
        </p>
        <ul className="mt-3 grid gap-2.5">
          {NUDGE_ITEMS.map(({ icon: Icon, key }) => (
            <li key={key} className="flex gap-2.5 text-xs leading-snug">
              <Icon
                className="mt-0.5 size-4 shrink-0 text-[var(--el-ink)]"
                aria-hidden
              />
              <span className="text-[var(--el-muted)]">
                <b className="font-medium text-[var(--el-ink)]">
                  {t(`items.${key}.title`)}
                </b>{" "}
                — {t(`items.${key}.body`)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--el-hairline)] px-4 py-3">
        <Button type="button" variant="outline" size="sm" onClick={onLater}>
          {t("later")}
        </Button>
        <Button type="button" size="sm" onClick={onEnd}>
          {t("endNow")}
        </Button>
        <button
          type="button"
          onClick={onNever}
          className="ml-auto text-[11px] text-[var(--el-muted-soft)] underline underline-offset-2 hover:text-[var(--el-ink)]"
        >
          {t("never")}
        </button>
      </div>
      <CountdownBar
        ms={NUDGE_MS}
        className="rounded-b-block"
        barClassName="bg-[var(--el-ink)]"
      />
    </motion.div>
  );
}

export function MeetingControls({
  note,
  onMeetingEnded,
  onEditParticipants,
}: {
  note: NoteResponseData;
  onEditParticipants?: () => void;
  onMeetingEnded?: () => void;
}) {
  const t = useTranslations("notes.controls");
  const [endOpen, setEndOpen] = useState(false);
  const recording = useRecording();
  const userId = useAuthUserId();
  const reasonId = useId();
  const [prevStatus, setPrevStatus] = useState(note.meetingStatus);
  const [nudge, setNudge] = useState(false);
  if (note.meetingStatus !== prevStatus) {
    setPrevStatus(note.meetingStatus);
    setNudge(
      prevStatus === "IN_PROGRESS" &&
        note.meetingStatus === "PAUSED" &&
        !nudgeSuppressed(userId)
    );
  }
  useEffect(() => {
    if (!nudge) return;
    const timer = window.setTimeout(() => setNudge(false), NUDGE_MS);
    return () => window.clearTimeout(timer);
  }, [nudge]);

  const canEnd =
    note.meetingStatus === "IN_PROGRESS" || note.meetingStatus === "PAUSED";

  if (!canEnd) return null;

  const recordingHere = isNoteRecordingActive(recording, note.noteId);
  const recordingBlocked =
    note.meetingStatus === "IN_PROGRESS" &&
    (note.activeSessionStartedAt != null || recordingHere);
  const recorder =
    recordingHere || !note.meetingStartedBy ? null : note.meetingStartedBy.name;
  const blockedReason = recorder
    ? t("blockedBy", { name: recorder })
    : t("blocked");

  const paused = note.meetingStatus === "PAUSED";
  const endButton = (
    <Button
      type="button"
      variant={paused ? "default" : "outline"}
      className={cn(
        "relative h-8 gap-1.5 rounded-control px-2.5 text-xs",
        !paused && "border-destructive text-destructive hover:text-destructive"
      )}
      disabled={recordingBlocked}
      aria-describedby={recordingBlocked ? reasonId : undefined}
      title={recordingBlocked ? undefined : t("end")}
      onClick={() => setEndOpen(true)}
    >
      <CircleStop className="size-4" />
      <span className="@max-[640px]/topbar:sr-only">{t("end")}</span>
      {nudge ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-[12px] border-[1.5px] border-[var(--el-ink)] opacity-0 motion-reduce:hidden"
          style={{ animation: "end-nudge-ring 2.2s ease-out 3" }}
        />
      ) : null}
    </Button>
  );

  return (
    <div
      role="group"
      aria-label={t("group")}
      className="flex shrink-0 items-center gap-3"
    >
      {recordingBlocked ? (
        <Tooltip>
          {/* disabled 버튼은 포인터 이벤트를 안 내서 감싼 span 이 툴팁을 연다. */}
          <TooltipTrigger
            delay={0}
            render={<span tabIndex={0} className="inline-flex" />}
          >
            {endButton}
          </TooltipTrigger>
          <TooltipContent>{blockedReason}</TooltipContent>
          <span id={reasonId} hidden>
            {blockedReason}
          </span>
        </Tooltip>
      ) : (
        <div className="relative">
          {endButton}
          <AnimatePresence>
            {nudge ? (
              <EndNudge
                onLater={() => setNudge(false)}
                onEnd={() => {
                  setNudge(false);
                  setEndOpen(true);
                }}
                onNever={() => {
                  if (userId) writeUserFlag(userId, "endNudgeOff", "1");
                  setNudge(false);
                }}
              />
            ) : null}
          </AnimatePresence>
        </div>
      )}
      <MeetingEndDialog
        noteId={note.noteId}
        meetingStatus={note.meetingStatus}
        participants={note.participants}
        open={endOpen}
        onOpenChange={setEndOpen}
        onEnded={onMeetingEnded}
        onEditParticipants={onEditParticipants}
      />
    </div>
  );
}
