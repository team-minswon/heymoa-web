"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CircleCheck, FileText, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { MeetingEndDialog } from "@/components/notes/meeting-end-dialog";
import { Button } from "@/components/ui/button";
import type { NoteResponseData } from "@/lib/api/generated/models";

const STEPS = [
  { icon: FileText, key: "summary" },
  { icon: Users, key: "speakers" },
  { icon: CircleCheck, key: "review" },
] as const;

export function PreEndGuide({
  note,
  onEditParticipants,
  onMeetingEnded,
}: {
  note: NoteResponseData | null | undefined;
  onEditParticipants?: () => void;
  onMeetingEnded?: () => void;
}) {
  const t = useTranslations("notes.preEnd");
  const [endOpen, setEndOpen] = useState(false);
  const reduced = useReducedMotion();
  const canEnd = note?.meetingStatus === "PAUSED";
  const recording = note?.meetingStatus === "IN_PROGRESS";
  const lonely = note != null && note.participants.length <= 1;

  return (
    <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pt-10 pb-16">
      <motion.div
        data-testid="pre-end-guide"
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <h3 className="text-[26px] leading-tight font-light tracking-tight text-[var(--el-ink)]">
          {t("title")}
        </h3>
        <p className="mt-2 text-sm text-[var(--el-muted)]">
          {t("description")}
        </p>

        <ol className="mt-7 grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, key }, index) => (
            <motion.li
              key={key}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeOut",
                delay: 0.08 + index * 0.07,
              }}
              className="flex flex-col rounded-panel border border-[var(--el-hairline)] bg-[var(--el-surface-card)] p-4"
            >
              <span className="flex items-center justify-between">
                <Icon
                  className="size-5 text-[var(--el-muted)]"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <span
                  aria-hidden
                  className="text-xs tabular-nums text-[var(--el-muted-soft)]"
                >
                  {index + 1}
                </span>
              </span>
              <span className="mt-4 text-sm font-medium text-[var(--el-ink)]">
                {t(`steps.${key}.title`)}
              </span>
              <span className="mt-1 text-xs leading-relaxed text-[var(--el-muted)]">
                {t(`steps.${key}.body`)}
              </span>
            </motion.li>
          ))}
        </ol>

        {lonely && onEditParticipants ? (
          <p
            data-testid="pre-end-guide-participants"
            className="mt-5 flex items-center gap-2 text-xs text-[var(--el-muted)]"
          >
            <UserPlus
              className="size-4 shrink-0 text-[var(--el-ink)]"
              aria-hidden
            />
            <span>{t("loneParticipant")}</span>
            <button
              type="button"
              onClick={onEditParticipants}
              className="shrink-0 text-[var(--el-ink)] underline underline-offset-2"
            >
              {t("addParticipant")}
            </button>
          </p>
        ) : null}

        <div className="mt-7 flex items-center gap-4">
          {canEnd && note ? (
            <Button type="button" onClick={() => setEndOpen(true)}>
              {t("end")}
            </Button>
          ) : null}
          <p className="text-xs text-[var(--el-muted-soft)]">
            {recording
              ? t("pauseToEnd")
              : canEnd
                ? t("noResume")
                : null}
          </p>
        </div>
      </motion.div>

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
