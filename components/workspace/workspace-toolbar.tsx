"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ExternalLink,
  Mic,
  Plus,
  Scissors,
  Square,
} from "lucide-react";

import { useRecording } from "@/components/transcription/recording-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { useCreateNote } from "@/lib/api/generated/notes/notes";
import { useGetProjects } from "@/lib/api/generated/projects/projects";

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
  const createNote = useCreateNote();
  const { selectedProjectId } = useWorkspaceShell();
  const projectsQuery = useGetProjects(workspaceId);
  const projects =
    projectsQuery.data?.status === 200 && projectsQuery.data.data.success
      ? (projectsQuery.data.data.data.projects ?? [])
      : [];
  const targetProjectId = selectedProjectId ?? projects[0]?.projectId;
  const recording = useRecording();
  const isActive = [
    "requesting-permission",
    "connecting",
    "recording",
    "stopping",
  ].includes(recording.phase);

  const openNote = (noteId: string) =>
    router.push(`/w/${workspaceId}/notes/${noteId}?view=side&tab=transcript`);

  const createFreshNote = async (title: string) => {
    if (!targetProjectId) return null;
    const response = await createNote.mutateAsync({
      projectId: targetProjectId,
      data: { title },
    });
    if (
      response.status !== 201 ||
      !response.data.success ||
      !response.data.data
    ) {
      return null;
    }
    return response.data.data.noteId;
  };

  const handleCreateMeeting = async () => {
    const noteId = await createFreshNote("실시간 기록 노트");
    if (!noteId) return;
    openNote(noteId);
    await recording.start(noteId);
  };

  const handleCreateNote = async () => {
    const noteId = await createFreshNote("새 노트");
    if (noteId) openNote(noteId);
  };

  const isRecordingOtherNote =
    isActive &&
    recording.session &&
    recording.session.noteId !== activeNoteId;

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-[var(--el-hairline)] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <SidebarTrigger className="md:hidden" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--el-muted)]">
              Workspace
            </p>
            <h1 className="truncate text-base font-semibold">{currentLabel}</h1>
          </div>

          {!isActive && activeNoteId ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className="rounded-full"
                onClick={() => void handleCreateMeeting()}
                loading={createNote.isPending}
                disabled={!targetProjectId}
              >
                <Mic /> 새 회의
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-full"
                disabled={!targetProjectId}
                aria-label="새 노트"
                onClick={() => void handleCreateNote()}
              >
                <Plus />
              </Button>
            </div>
          ) : null}
        </div>
        {recording.error ? (
          <Alert variant="destructive" className="mx-4 mb-3 sm:mx-6 lg:mx-8">
            <AlertDescription>{recording.error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <AnimatePresence>
        {isRecordingOtherNote ? (
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
              onClick={() => openNote(recording.session!.noteId)}
              className="h-7 rounded-full px-2.5 text-[13px] font-medium text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)]"
            >
              <ExternalLink className="size-3.5" /> 현재 녹음
            </Button>
            <div className="h-4 w-px bg-[var(--el-hairline)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--el-muted)]">
              {recording.phase === "recording"
                ? "녹음 중"
                : recording.phase === "stopping"
                  ? "마무리 중"
                  : "연결 중"}
            </span>
            <span
              role="meter"
              aria-label="마이크 입력"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(recording.level * 100)}
              className="flex h-4 items-center gap-[3px] rounded-full bg-[var(--el-ink)] px-2"
            >
              {recording.levelHistory.slice(-4).map((sample, index) => (
                <span
                  key={index}
                  className="h-2.5 w-[2px] origin-center rounded-full bg-white transition-transform duration-75"
                  style={{ transform: `scaleY(${Math.max(0.12, sample)})` }}
                />
              ))}
            </span>
            <span className="font-mono text-[13px] font-medium tabular-nums text-[var(--el-ink)]">
              {formatElapsed(recording.elapsedMs)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-full"
              disabled={recording.phase !== "recording"}
              onClick={recording.commit}
            >
              <Scissors className="size-3.5" /> 구간 확정
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="size-7 rounded-full text-destructive"
              aria-label="녹음 종료"
              disabled={recording.phase === "stopping"}
              onClick={() => void recording.stop()}
            >
              <Square className="size-3.5" />
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
