"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Square } from "lucide-react";

import {
  type RecordingPhase,
  useRecording,
  useRecordingMeter,
} from "@/components/transcription/recording-provider";
import { RecordingPendingSpinner } from "@/components/transcription/recording-pending-spinner";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

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

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      exit={{ opacity: 0, y: -12, x: "-50%" }}
      className="fixed left-1/2 top-5 z-50 flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] px-3 py-1.5 shadow-[0_8px_32px_rgba(28,25,23,0.12)] backdrop-blur-xl"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onOpen(noteId)}
        className="h-7 rounded-full px-2.5 text-[13px] font-medium text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)]"
      >
        <ExternalLink className="size-3.5" /> 현재 녹음
      </Button>
      <div className="h-4 w-px bg-[var(--el-hairline)]" />
      {phase === "recording" ? (
        <span
          role="meter"
          aria-label="마이크 입력"
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
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="size-7 rounded-full text-destructive"
        aria-label="녹음 종료"
        disabled={phase === "stopping"}
        onClick={onStop}
      >
        <Square className="size-3.5" />
      </Button>
    </motion.div>
  );
}

export function WorkspaceToolbar({
  workspaceId,
  currentLabel,
  activeNoteId,
}: {
  workspaceId: string;
  currentLabel: string;
  activeNoteId?: string;
}) {
  const router = useRouter();
  const recording = useRecording();
  const isActive = [
    "requesting-permission",
    "connecting",
    "recording",
    "stopping",
  ].includes(recording.phase);

  const openNote = (noteId: string) =>
    router.push(`/w/${workspaceId}/notes/${noteId}?view=side&tab=transcript`);

  const recordingNoteId = recording.activeNoteId ?? recording.session?.noteId;
  const isRecordingOtherNote =
    isActive && recordingNoteId && recordingNoteId !== activeNoteId;

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-[var(--el-hairline)] bg-[color-mix(in_srgb,var(--el-canvas)_88%,transparent)] backdrop-blur-xl">
        <div className="flex min-h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <SidebarTrigger className="md:hidden" />
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="font-serif text-lg font-light tracking-[-0.03em] text-[var(--el-ink)]">
              heymoa
            </span>
            <span className="text-[var(--el-hairline-strong)]">/</span>
            <h1 className="truncate text-xs font-medium text-[var(--el-muted)]">
              {currentLabel}
            </h1>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isRecordingOtherNote ? (
          <WorkspaceRecordingIndicator
            noteId={recordingNoteId}
            phase={recording.phase}
            elapsedMs={recording.elapsedMs}
            onOpen={openNote}
            onStop={() => void recording.stop()}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
