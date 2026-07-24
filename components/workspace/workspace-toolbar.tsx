"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ExternalLink, Plus, Square } from "lucide-react";

import {
  type RecordingPhase,
  useRecording,
  useRecordingMeter,
} from "@/components/transcription/recording-provider";
import { RecordingPendingSpinner } from "@/components/transcription/recording-pending-spinner";
import { MeetingControls } from "@/components/notes/meeting-controls";
import { NotificationBell } from "@/components/notification/notification-bell";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";
import { useCreateMeeting } from "@/lib/workspace/use-create-meeting";

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
      className="fixed left-1/2 top-5 z-50 flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] px-3 py-1.5 shadow-e2 backdrop-blur-xl"
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

/**
 * full 노트에서 상단바가 그리는 노트 액션 슬롯 — 회의 조작(회의 종료·중지/재개) + 패널 토글(닫기).
 * 2단이던 셸 브레드크럼 바 + 노트 헤더를 한 줄로 합친다(CHROME SPEC). 녹음 중지는 여기 없다 —
 * 레코더 독이 단독으로 맡는다(MOTION SPEC drift #7).
 */
function NoteActionSlot({
  workspaceId,
  noteId,
}: {
  workspaceId: string;
  noteId: string;
}) {
  const router = useRouter();
  const noteQuery = useGetNote(noteId);
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;

  return (
    <div className="flex items-center gap-2">
      {note ? (
        <MeetingControls
          note={note}
          onMeetingEnded={() =>
            router.replace(
              `/w/${workspaceId}/notes/${noteId}?view=full&tab=summary`
            )
          }
        />
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="rounded-full"
        aria-label="노트 닫기"
        onClick={() => router.push(`/w/${workspaceId}`)}
      >
        <ChevronLeft />
      </Button>
    </div>
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
  const searchParams = useSearchParams();
  const recording = useRecording();
  const createMeeting = useCreateMeeting(workspaceId);

  // full 노트일 때만 상단바가 노트-aware가 된다. side는 시트가 자체 헤더를 가지므로 허브 모드 유지.
  const isFullNote = Boolean(activeNoteId) && searchParams.get("view") !== "side";
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
          <nav
            aria-label="현재 위치"
            className="flex min-w-0 flex-1 items-baseline gap-2"
          >
            {/* 좁은 화면(full 노트)에서는 앞 세그먼트를 접어 노트 제목·우측 액션을 확보한다. */}
            <span
              className={cn(
                "shrink-0 font-serif text-lg font-light tracking-[-0.03em] text-[var(--el-ink)]",
                isFullNote && "hidden sm:inline"
              )}
            >
              {siteConfig.name}
            </span>
            <span
              className={cn(
                "text-[var(--el-hairline-strong)]",
                isFullNote && "hidden sm:inline"
              )}
            >
              /
            </span>
            <span
              className={cn(
                "shrink-0 truncate text-xs font-medium text-[var(--el-muted)]",
                isFullNote && "hidden sm:inline"
              )}
            >
              {currentLabel}
            </span>
            {isFullNote ? (
              <>
                <span className="hidden text-[var(--el-hairline-strong)] sm:inline">
                  /
                </span>
                <h1 className="truncate text-xs font-medium text-[var(--el-ink)]">
                  {noteTitle ?? "회의 노트"}
                </h1>
              </>
            ) : null}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {isFullNote && activeNoteId ? (
              <NoteActionSlot
                workspaceId={workspaceId}
                noteId={activeNoteId}
              />
            ) : null}
            <Button
              type="button"
              size="sm"
              aria-label={createMeeting.isRecordingCurrent ? "현재 녹음" : "새 노트"}
              className="h-8 shrink-0 rounded-full px-3"
              disabled={createMeeting.disabled}
              loading={createMeeting.isPending}
              onClick={() => void createMeeting.createMeeting()}
            >
              {createMeeting.isRecordingCurrent ? (
                <ExternalLink className="size-3.5" />
              ) : (
                <Plus className="size-3.5" />
              )}
              {/* 좁은 화면에서는 아이콘만 — 노트 액션·벨이 잘리지 않게. */}
              <span className={cn(isFullNote && "hidden sm:inline")}>
                {createMeeting.isRecordingCurrent ? "현재 녹음" : "새 노트"}
              </span>
            </Button>
            <NotificationBell />
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
