"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, CircleStop, Sparkles } from "lucide-react";

import { usePersonalChat } from "@/components/chat/personal-chat";
import {
  type RecordingPhase,
  useRecording,
  useRecordingMeter,
} from "@/components/transcription/recording-provider";
import { RecordingPendingSpinner } from "@/components/transcription/recording-pending-spinner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import { cn } from "@/lib/utils";

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** 정지 상태의 미터 — 디자인의 5막대 형태를 유지한다. */
const IDLE_BARS = [16, 7, 14, 6, 11];

/**
 * 회의를 벗어나 있는 동안 상단 중앙에 뜨는 녹음 필(design.pen `Recording Pill`).
 * h44 · radius full · e2. 좌: 경과 + 미터, 우: 회의로 · 정지.
 */
function RecordingPill({
  noteId,
  noteTitle,
  phase,
  elapsedMs,
  onOpen,
  onStop,
}: {
  noteId: string;
  noteTitle?: string;
  phase: RecordingPhase;
  elapsedMs: number;
  onOpen: (noteId: string) => void;
  onStop: () => void;
}) {
  const meter = useRecordingMeter();
  const samples = meter.levelHistory.slice(-5);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      exit={{ opacity: 0, y: -12, x: "-50%" }}
      className="fixed top-5 left-1/2 z-50 flex h-11 items-center gap-2.5 rounded-full border border-[var(--el-hairline)] bg-card py-0 pr-1.5 pl-3.5 shadow-e2"
    >
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-[var(--el-error)]" />
        <span className="font-mono text-[13px] font-bold tabular-nums text-[var(--el-muted)]">
          {formatElapsed(elapsedMs)}
        </span>
      </span>
      {/* 연결·종료 중에는 미터를 흉내내지 않는다 — 안 들어오는 소리를 막대로 그리면 거짓말이다. */}
      {phase === "recording" ? (
        <span
          role="meter"
          aria-label="마이크 입력"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(meter.level * 100)}
          className="flex h-4 items-center gap-0.5"
        >
          {IDLE_BARS.map((idle, index) => (
            <span
              key={index}
              className="w-0.5 rounded-full bg-[var(--el-error)] transition-[height] duration-75"
              style={{
                height:
                  samples[index] !== undefined
                    ? `${Math.max(3, Math.round(samples[index] * 16))}px`
                    : `${idle}px`,
              }}
            />
          ))}
        </span>
      ) : (
        <RecordingPendingSpinner />
      )}
      <span className="h-[18px] w-px bg-[var(--el-hairline)]" />
      <span className="max-w-56 truncate text-[12px] font-medium text-[var(--el-muted)]">
        {noteTitle ?? "기록 중인 회의"}
      </span>
      <button
        type="button"
        onClick={() => onOpen(noteId)}
        className="flex h-8 items-center gap-1.5 rounded-control bg-[var(--el-primary)] px-2.5 text-[12px] font-medium text-[var(--el-canvas)]"
      >
        회의로
        <ArrowUpRight className="size-4" />
      </button>
      <button
        type="button"
        aria-label="녹음 종료"
        disabled={phase !== "recording"}
        onClick={onStop}
        className="flex size-8 items-center justify-center rounded-full text-[var(--el-muted)] transition-colors hover:bg-[var(--el-surface-strong)] disabled:opacity-40"
      >
        <CircleStop className="size-4" />
      </button>
    </motion.div>
  );
}

/**
 * 패널 안 상단바. h56 · px32 · 아래 hairline. 왼쪽은 지금 있는 곳 한 줄, 오른쪽은 액션.
 * 「새 회의」는 여기 없다 — 페이지 헤더가 갖는다(design.pen). 여기 두면 같은 버튼이 두 번 나온다.
 */
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
  const searchParams = useSearchParams();
  const recording = useRecording();
  const { isVisible, open, close } = usePersonalChat();

  // full 노트일 때만 상단바가 노트-aware가 된다. side는 시트가 자체 헤더를 가진다.
  const isFullNote =
    Boolean(activeNoteId) && searchParams.get("view") !== "side";
  const noteQuery = useGetNote(activeNoteId ?? "", {
    query: { enabled: isFullNote },
  });
  const noteTitle =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data.title
      : undefined;

  const isActive = [
    "requesting-permission",
    "connecting",
    "recording",
    "stopping",
  ].includes(recording.phase);

  const recordingNoteId = recording.activeNoteId ?? recording.session?.noteId;
  const isRecordingOtherNote =
    isActive && recordingNoteId && recordingNoteId !== activeNoteId;
  const recordingNoteQuery = useGetNote(recordingNoteId ?? "", {
    query: { enabled: Boolean(isRecordingOtherNote) },
  });
  const recordingNoteTitle =
    recordingNoteQuery.data?.status === 200 &&
    recordingNoteQuery.data.data.success
      ? recordingNoteQuery.data.data.data.title
      : undefined;

  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--el-hairline)] px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <span className="truncate text-[13px] font-semibold text-[var(--el-ink)]">
            {isFullNote ? (noteTitle ?? "회의") : currentLabel}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => (isVisible ? close() : open())}
            aria-pressed={isVisible}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-control border border-[var(--control-border)] px-2.5 text-[12px] font-medium text-[var(--el-ink)] transition-colors",
              isVisible
                ? "bg-[var(--el-surface-strong)]"
                : "hover:bg-[var(--el-surface-strong)]"
            )}
          >
            <Sparkles className="size-4 text-[var(--el-muted)]" />
            에이전트
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isRecordingOtherNote ? (
          <RecordingPill
            noteId={recordingNoteId}
            noteTitle={recordingNoteTitle}
            phase={recording.phase}
            elapsedMs={recording.elapsedMs}
            onOpen={(noteId) =>
              router.push(
                `/w/${workspaceId}/meetings/${noteId}?view=full&tab=transcript`
              )
            }
            onStop={() => void recording.stop()}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
