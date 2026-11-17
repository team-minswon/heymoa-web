"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Pause, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  type RecordingPhase,
  useRecording,
  useRecordingMeter,
} from "@/components/transcription/recording-provider";
import { RecordingPendingSpinner } from "@/components/transcription/recording-pending-spinner";
import { ACTIVE_PHASES } from "@/lib/transcription/recording-state";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { siteConfig } from "@/lib/site";

import { formatOffset as formatElapsed } from "@/lib/transcription/presentation";

function WorkspaceRecordingIndicator({
  noteId,
  phase,
  elapsedMs,
  onOpen,
  onStop,
}: {
  noteId: string;
  phase: RecordingPhase;
  elapsedMs: number;
  onOpen: (noteId: string) => void;
  onStop: () => void;
}) {
  const meter = useRecordingMeter();
  const t = useTranslations("shell.toolbar");
  const tRecording = useTranslations("recording");

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      exit={{ opacity: 0, y: -12, x: "-50%" }}
      className="fixed left-1/2 top-5 z-50 flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] px-3 py-1.5 shadow-e2 backdrop-blur-xl"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onOpen(noteId)}
        className="h-7 rounded-full px-2.5 text-[13px] font-medium text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)]"
      >
        <ExternalLink className="size-3.5" /> {t("currentRecording")}
      </Button>
      <div className="h-4 w-px bg-[var(--el-hairline)]" />
      {phase === "recording" ? (
        <span
          role="meter"
          aria-label={tRecording("micInput")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(meter.level * 100)}
          className="flex h-4 w-8 items-center justify-center gap-[3px] rounded-full bg-[var(--el-ink)]"
        >
          {meter.levelHistory.slice(-4).map((sample, index) => (
            <span
              key={index}
              className="h-2.5 w-[2px] origin-center rounded-full bg-white transition-transform duration-75"
              style={{ transform: `scaleY(${Math.max(0.12, sample)})` }}
            />
          ))}
        </span>
      ) : (
        <RecordingPendingSpinner />
      )}
      <span className="font-mono text-[13px] font-medium tabular-nums text-[var(--el-ink)]">
        {formatElapsed(elapsedMs)}
      </span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="size-7 rounded-full text-destructive"
              aria-label={tRecording("pause.label")}
              disabled={phase !== "recording"}
              onClick={onStop}
            />
          }
        >
          <Pause className="size-3.5" aria-hidden />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {tRecording("pause.tooltip")}
        </TooltipContent>
      </Tooltip>
    </motion.div>
  );
}

export function WorkspaceToolbar({
  workspaceId,
  currentLabel,
  activeNoteId,
  covered = false,
}: {
  workspaceId: string;
  currentLabel: string;
  activeNoteId?: string;
  covered?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("shell.toolbar");
  const recording = useRecording();
  const { requestNewMeeting } = useWorkspaceShell();

  const isActive = ACTIVE_PHASES.has(recording.phase);

  const openRecordingNote = (noteId: string) =>
    router.push(
      `/w/${recording.activeWorkspaceId ?? workspaceId}/notes/${noteId}?view=side&tab=details`
    );

  const recordingNoteId = recording.activeNoteId ?? recording.session?.noteId;
  const isRecordingOtherNote =
    isActive && recordingNoteId && recordingNoteId !== activeNoteId;

  return (
    <>
      <div
        inert={covered}
        className="sticky top-0 z-20 border-b border-[var(--el-hairline)] bg-[var(--el-surface-card)]"
      >
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <SidebarTrigger className="md:hidden" />
          <nav
            aria-label={t("location")}
            className="flex min-w-0 flex-1 items-baseline gap-2"
          >
            <span className="shrink-0 text-lg font-light tracking-[-0.03em] text-[var(--el-ink)]">
              {siteConfig.name}
            </span>
            <span className="text-[var(--el-hairline-strong)]">/</span>
            <span className="shrink-0 truncate text-xs font-medium text-[var(--el-muted)]">
              {currentLabel}
            </span>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              aria-label={t("newNote")}
              className="h-8 shrink-0 rounded-full px-3"
              onClick={requestNewMeeting}
            >
              <Plus className="size-3.5" />
              <span>{t("newNote")}</span>
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isRecordingOtherNote ? (
          <WorkspaceRecordingIndicator
            noteId={recordingNoteId}
            phase={recording.phase}
            elapsedMs={recording.elapsedMs}
            onOpen={openRecordingNote}
            onStop={() => void recording.stop()}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
