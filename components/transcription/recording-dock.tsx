"use client";

import { AnimatePresence, motion } from "motion/react";
import { Mic, RotateCcw, Square } from "lucide-react";

import {
  useRecording,
  useRecordingMeter,
} from "@/components/transcription/recording-provider";
import { RecordingPendingSpinner } from "@/components/transcription/recording-pending-spinner";
import { Button } from "@/components/ui/button";

const LAYOUT_TRANSITION = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.2,
};

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function RecordingDock({
  noteId,
  disabledReason = null,
}: {
  noteId: string;
  /**
   * 녹음을 시작할 수 없는 지속 상태의 이유(예: 종료된 회의). 있으면 시작 컨트롤 자리에
   * 이 문구가 대신 선다 — 눌러서 실패하게 두면 "지금 할 수 없음"이 오류로 읽힌다.
   */
  disabledReason?: string | null;
}) {
  const recording = useRecording();
  const meter = useRecordingMeter();
  const hasActiveSession = [
    "requesting-permission",
    "connecting",
    "recording",
    "stopping",
  ].includes(recording.phase);
  const isThisNote = recording.activeNoteId === noteId;
  const isOtherNote = hasActiveSession && !isThisNote;
  const state = isThisNote ? recording.phase : "idle";

  return (
    <motion.div
      layout
      aria-label="녹음 제어"
      className="flex min-h-10 min-w-0 max-w-full items-center overflow-hidden rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] p-1 text-[var(--el-ink)] shadow-e2 backdrop-blur-xl"
      style={{ borderRadius: 9999 }}
      transition={LAYOUT_TRANSITION}
    >
      <motion.div
        layout
        aria-hidden
        className="flex items-center"
        transition={LAYOUT_TRANSITION}
      >
        <span className="flex size-8 items-center justify-center rounded-full text-[var(--el-muted)]">
          <Mic className="size-4" />
        </span>
        <span className="mx-1 h-5 w-px bg-[var(--el-hairline)]" />
      </motion.div>

      <AnimatePresence mode="popLayout" initial={false}>
        {state === "recording" ? (
          <motion.div
            layout
            key="recording"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.15, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex w-max shrink-0 items-center gap-2 pl-2 pr-1"
          >
            <span className="min-w-12 font-mono text-[13px] font-semibold tabular-nums text-destructive">
              {formatElapsed(recording.elapsedMs)}
            </span>
            <span
              role="meter"
              data-testid="note-recording-waveform"
              aria-label="마이크 입력"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(meter.level * 100)}
              className="mx-0.5 flex h-5 w-8 items-center justify-center gap-[3px]"
            >
              {meter.levelHistory.slice(-5).map((sample, index) => (
                <span
                  key={index}
                  className="h-4 w-[3px] origin-center rounded-full bg-destructive transition-transform duration-75"
                  style={{ transform: `scaleY(${Math.max(0.12, sample)})` }}
                />
              ))}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-7 shrink-0 rounded-full text-[var(--el-muted-soft)] hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-muted)]"
              aria-label="녹음 종료"
              onClick={() => void recording.stop()}
            >
              <Square className="size-3.5" />
            </Button>
          </motion.div>
        ) : state === "requesting-permission" ||
          state === "connecting" ||
          state === "stopping" ? (
          <motion.div
            layout
            key="pending"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.15, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex h-8 shrink-0 items-center px-1"
          >
            <RecordingPendingSpinner />
          </motion.div>
        ) : disabledReason ? (
          // 녹음 중·정리 중은 위에서 먼저 걸린다 — 다른 멤버가 회의를 끝내도 내 정지 버튼은
          // 남는다. 여기 오는 것은 시작할 수 있었을 자리뿐이고, 그 자리에 이유를 대신 놓는다.
          // 잠긴 버튼 + title은 터치에서 호버가 없고 disabled는 포커스도 안 받아 이유가 사라진다.
          <motion.div
            layout
            key="blocked"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.15, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex min-w-0 items-center px-2.5 py-1"
          >
            {/* 이유는 문장이라 좁은 화면에서 잘리면 안 된다 — 다른 분기와 달리 접힌다. */}
            <span className="text-xs leading-snug text-[var(--el-muted)]">
              {disabledReason}
            </span>
          </motion.div>
        ) : state === "failed" ? (
          <motion.div
            layout
            key="failed"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.15, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex shrink-0 items-center px-1"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-2.5 text-xs"
              disabled={isOtherNote}
              onClick={() => void recording.start(noteId)}
            >
              <RotateCcw className="size-3.5" />
              다시 시도
            </Button>
          </motion.div>
        ) : (
          <motion.div
            layout
            key="idle"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.15, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex shrink-0 items-center px-1"
          >
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-full bg-destructive shadow-sm transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 disabled:cursor-not-allowed disabled:opacity-45"
              aria-label={isOtherNote ? "다른 노트에서 녹음 중" : "기록 시작"}
              disabled={isOtherNote}
              onClick={() => void recording.start(noteId)}
            >
              <span className="size-2.5 rounded-full bg-white" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
