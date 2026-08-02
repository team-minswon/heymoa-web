"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";

import { usePersonalChat } from "@/components/chat/personal-chat";
import { useRecording } from "@/components/transcription/recording-provider";
import { RecordingPill } from "@/components/transcription/recording-pill";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import { cn } from "@/lib/utils";

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
            noteTitle={recordingNoteTitle}
            phase={recording.phase}
            elapsedMs={recording.elapsedMs}
            onOpen={() =>
              router.push(
                `/w/${workspaceId}/meetings/${recordingNoteId}?view=full&tab=transcript`
              )
            }
            onStop={() => void recording.stop()}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
