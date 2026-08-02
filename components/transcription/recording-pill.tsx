"use client";

import { ArrowUpRight, Square } from "lucide-react";
import { motion } from "motion/react";

import { RecordingPendingSpinner } from "@/components/transcription/recording-pending-spinner";
import type { RecordingPhase } from "@/components/transcription/recording-provider";
import { formatElapsed } from "@/lib/transcription/format-elapsed";

export const RECORDING_PILL_EXIT_DURATION = 0.3;

/**
 * 노트 **밖**에서 뜨는 녹음 표면. 상단 중앙 고정.
 *
 * 노트 안의 dock(`recording-dock.tsx`)과 담는 것을 일부러 반대로 한다.
 * - dock 은 **제어** 표면이라 미터를 둔다 — 소리가 들어오는지가 그 자리의 질문이다.
 * - 필은 **알림** 표면이라 미터를 뺀다. 밖에서 다른 일을 하는 중에 초 단위로 움직이는 것은 방해다.
 *   빨간 점 하나면 「돌고 있다」가 전달된다.
 *
 * 회의 제목도 띄우지 않는다. 상단 중앙 고정이라 화면 공유·스크린샷에 항상 찍히는데,
 * 「성과 평가 면담」 같은 제목이면 그대로 노출이다. 제목은 「회의로」의 접근 가능한 이름으로만 준다 —
 * hover 로 미루면 키보드·터치에서 깨진다.
 *
 * 회의 종료는 여기 없다. 되돌릴 수 없는 행동이 떠다니는 오버레이에 있으면 안 된다.
 */
export function RecordingPill({
  noteTitle,
  phase,
  elapsedMs,
  onOpen,
  onStop,
}: {
  noteTitle?: string;
  phase: RecordingPhase;
  elapsedMs: number;
  /** 누르면 기록 중인 회의로. 목적지를 아직 못 만드는 상태면 생략한다 — 눌러도 안 가는 링크를 두지 않는다. */
  onOpen?: () => void;
  onStop: () => void;
}) {
  return (
    <motion.aside
      aria-label="진행 중인 녹음"
      initial={{ opacity: 0, x: "-50%", y: -12 }}
      animate={{ opacity: 1, x: "-50%", y: 0, transition: { duration: 0.15 } }}
      exit={{
        opacity: 0,
        x: "-50%",
        y: -12,
        transition: { duration: RECORDING_PILL_EXIT_DURATION },
      }}
      className="fixed top-5 left-1/2 z-50 flex h-11 items-center gap-2.5 rounded-full border border-[var(--el-hairline)] bg-card py-0 pr-1.5 pl-3.5 shadow-e2"
    >
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-[var(--el-error)]" />
        <span className="font-mono text-[13px] font-bold tabular-nums text-[var(--el-muted)]">
          {formatElapsed(elapsedMs)}
        </span>
      </span>
      {phase === "recording" ? null : <RecordingPendingSpinner />}
      <span className="h-[18px] w-px bg-[var(--el-hairline)]" />
      <span className="text-[12px] font-medium text-[var(--el-muted)]">
        기록 중인 회의
      </span>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={
            noteTitle ? `${noteTitle} 회의로 이동` : "기록 중인 회의로 이동"
          }
          className="flex h-8 items-center gap-1.5 rounded-control bg-[var(--el-primary)] px-2.5 text-[12px] font-medium text-[var(--el-canvas)]"
        >
          회의로
          <ArrowUpRight className="size-4" />
        </button>
      ) : null}
      <button
        type="button"
        aria-label="녹음 종료"
        disabled={phase !== "recording"}
        onClick={onStop}
        className="flex size-8 items-center justify-center rounded-full text-[var(--el-muted)] transition-colors hover:bg-[var(--el-surface-strong)] disabled:opacity-40"
      >
        <Square className="size-3.5" />
      </button>
    </motion.aside>
  );
}
