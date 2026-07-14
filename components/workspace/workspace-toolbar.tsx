"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CircleStop, ExternalLink, Mic, Pause, Play, Plus } from "lucide-react";

import { useRecording } from "@/components/transcription/recording-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCreateNote } from "@/lib/api/generated/notes/notes";
import { useGetProjects } from "@/lib/api/generated/projects/projects";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";

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

  const {
    session,
    elapsedMs,
    level,
    levelHistory,
    microphoneState,
    error,
    start,
    pause,
    resume,
    stop,
  } = useRecording();
  const isActive =
    session &&
    ["CONNECTING", "STREAMING", "PAUSED", "FINALIZING"].includes(
      session.status
    );
  const paused = session?.status === "PAUSED";

  const openNote = (noteId: string) =>
    router.push(`/w/${workspaceId}/notes/${noteId}?view=side&tab=transcript`);

  const handleStart = async () => {
    let noteId = activeNoteId;
    if (!noteId) {
      if (!targetProjectId) return;
      const response = await createNote.mutateAsync({
        projectId: targetProjectId,
        data: { title: "실시간 기록 노트" },
      });
      if (
        response.status !== 201 ||
        !response.data.success ||
        !response.data.data
      )
        return;
      noteId = response.data.data.noteId;
    }
    openNote(noteId);
    await start(noteId);
  };

  const isRecordingOtherNote = isActive && !activeNoteId;

  return (
    <>
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <SidebarTrigger className="md:hidden" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              Workspace
            </p>
            <h1 className="truncate text-base font-semibold">{currentLabel}</h1>
          </div>

          {!isActive && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => void handleStart()}
                loading={createNote.isPending}
                disabled={!targetProjectId}
                aria-label="실시간 기록 시작"
              >
                <Mic className="mr-1" />
                <span className="hidden sm:inline">실시간 기록 시작</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!targetProjectId}
                aria-label="새 노트"
                onClick={async () => {
                  if (!targetProjectId) return;
                  const response = await createNote.mutateAsync({
                    projectId: targetProjectId,
                    data: { title: "새 노트" },
                  });
                  if (
                    response.status === 201 &&
                    response.data.success &&
                    response.data.data
                  ) {
                    openNote(response.data.data.noteId);
                  }
                }}
              >
                <Plus />
              </Button>
            </div>
          )}
        </div>
        {error ? (
          <Alert variant="destructive" className="mx-4 mb-3 sm:mx-6 lg:mx-8">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <AnimatePresence>
        {isRecordingOtherNote && (
          <motion.div
            initial={{ opacity: 0, y: -12, x: "-50%" }}
            animate={{
              opacity: 1,
              y: 0,
              x: "-50%",
              transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
            }}
            exit={{
              opacity: 0,
              y: -12,
              x: "-50%",
              transition: { duration: 0.12, ease: [0.4, 0, 0.2, 1] },
            }}
            className="fixed left-1/2 top-5 z-50 flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] px-3 py-1.5 shadow-[0_8px_32px_rgba(28,25,23,0.12)] backdrop-blur-xl"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openNote(session.noteId)}
              className="h-7 rounded-full px-2.5 text-[13px] font-medium text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)]"
            >
              <ExternalLink className="mr-1.5 size-3.5" />
              현재 녹음
            </Button>
            <div className="h-4 w-px bg-[var(--el-hairline)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--el-muted)]">
              {paused
                ? "일시정지"
                : microphoneState === "recording"
                  ? "녹음 중"
                  : "마이크 대기 중"}
            </span>
            <span
              role="meter"
              aria-label="마이크 입력"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(level * 100)}
              className="flex h-4 items-center gap-[3px] rounded-full bg-[var(--el-ink)] px-2"
            >
              {levelHistory.slice(-4).map((sample, index) => (
                <span
                  key={index}
                  className="h-2.5 w-[2px] origin-center rounded-full bg-white transition-transform duration-75"
                  style={{
                    transform: `scaleY(${Math.max(0.12, sample)})`,
                  }}
                />
              ))}
            </span>
            <span className="font-mono text-[13px] font-medium tabular-nums text-[var(--el-ink)]">
              {formatElapsed(elapsedMs)}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 rounded-full text-[var(--el-muted)] hover:text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)]"
                aria-label={paused ? "녹음 재개" : "녹음 일시 정지"}
                onClick={() => void (paused ? resume() : pause())}
              >
                {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 rounded-full text-destructive hover:text-destructive hover:bg-destructive/8"
                aria-label="녹음 종료"
                onClick={() => void stop()}
              >
                <CircleStop className="size-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
