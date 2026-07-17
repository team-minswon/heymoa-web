"use client";

import { Database, Loader2, Mic, RotateCcw, Square } from "lucide-react";

import { useRecording } from "@/components/transcription/recording-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function RecordingDock({ noteId }: { noteId: string }) {
  const recording = useRecording();
  const hasActiveSession = [
    "requesting-permission",
    "connecting",
    "recording",
    "stopping",
  ].includes(recording.phase);
  const isThisNote = recording.activeNoteId === noteId;
  const isOtherNote = hasActiveSession && !isThisNote;

  if (isThisNote && recording.phase === "recording") {
    return (
      <div className="grid min-h-[68px] grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-white/10 bg-[var(--el-ink)] px-3 py-2.5 text-white shadow-[0_18px_50px_rgba(12,10,9,0.24)] sm:px-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
            <span className="size-2 animate-pulse rounded-full bg-red-400" />
            REC
          </span>
          <span className="min-w-[54px] font-mono text-base font-medium tabular-nums">
            {formatElapsed(recording.elapsedMs)}
          </span>
        </div>
        <span
          role="meter"
          data-testid="note-recording-waveform"
          aria-label="마이크 입력"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(recording.level * 100)}
          className="flex h-8 min-w-12 items-center justify-center gap-[4px]"
        >
          {recording.levelHistory.slice(-9).map((sample, index) => (
            <span
              key={index}
              className="h-6 w-[3px] origin-center rounded-full bg-white/75 transition-transform duration-75"
              style={{ transform: `scaleY(${Math.max(0.12, sample)})` }}
            />
          ))}
        </span>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "hidden items-center gap-1.5 text-[10px] text-white/45 md:flex",
              recording.isReconciling && "text-white/75"
            )}
          >
            {recording.isReconciling ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Database className="size-3" />
            )}
            {recording.isReconciling ? "저장 중" : "자동 저장"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label="녹음 종료"
            onClick={() => void recording.stop()}
            className="size-11 rounded-xl bg-white text-[var(--el-ink)] hover:bg-white/90"
          >
            <Square className="size-3.5 fill-current" />
          </Button>
        </div>
      </div>
    );
  }

  if (isThisNote && recording.phase === "stopping") {
    return (
      <div className="flex min-h-[68px] items-center justify-center gap-3 rounded-2xl border border-[var(--el-hairline)] bg-white px-6 text-sm text-[var(--el-body)] shadow-[0_12px_36px_rgba(28,25,23,0.10)]">
        <Loader2 className="size-4 animate-spin" />
        마지막 문장을 저장하고 있습니다
      </div>
    );
  }

  if (
    isThisNote &&
    ["requesting-permission", "connecting"].includes(recording.phase)
  ) {
    return (
      <div className="flex min-h-[68px] items-center justify-center gap-3 rounded-2xl border border-[var(--el-hairline)] bg-white px-6 text-sm text-[var(--el-body)] shadow-[0_12px_36px_rgba(28,25,23,0.10)]">
        <Loader2 className="size-4 animate-spin" />
        {recording.phase === "requesting-permission"
          ? "마이크 권한을 확인하고 있습니다"
          : "실시간 전사를 연결하고 있습니다"}
      </div>
    );
  }

  const retry = isThisNote && recording.phase === "failed";
  return (
    <div className="flex min-h-[68px] items-center justify-between gap-4 rounded-2xl border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] py-2.5 pl-5 pr-2.5 shadow-[0_12px_36px_rgba(28,25,23,0.10)] backdrop-blur-xl">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--el-ink)]">
          {isOtherNote
            ? "다른 회의를 기록하고 있습니다"
            : retry
              ? "연결을 다시 시도할 수 있습니다"
              : "이 회의를 실시간으로 기록하세요"}
        </p>
        <p className="mt-0.5 hidden text-xs text-[var(--el-muted)] sm:block">
          {isOtherNote
            ? "진행 중인 기록을 먼저 종료해 주세요."
            : "중간 조작 없이 말하는 내용이 자동으로 저장됩니다."}
        </p>
      </div>
      <Button
        type="button"
        size="xl"
        className="h-11 rounded-xl px-5"
        aria-label={isOtherNote ? "다른 노트에서 녹음 중" : "기록 시작"}
        disabled={isOtherNote}
        onClick={() => void recording.start(noteId)}
      >
        {retry ? <RotateCcw /> : <Mic />}
        {retry ? "다시 시작" : "기록 시작"}
      </Button>
    </div>
  );
}
