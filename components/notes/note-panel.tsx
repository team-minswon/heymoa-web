"use client";

import {
  Expand,
  Mic,
  PanelRightClose,
  Pause,
  Play,
  Square,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { NoteDetails } from "@/components/notes/note-details";
import { TranscriptView } from "@/components/notes/transcript-view";
import { useRecording } from "@/components/transcription/recording-provider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import { useGetProject } from "@/lib/api/generated/projects/projects";

export type NoteTab = "details" | "transcript";

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function NotePanel({
  workspaceId,
  noteId,
  tab,
  onTabChange,
  onClose,
  onExpand,
}: {
  workspaceId: string;
  noteId: string;
  tab: NoteTab;
  onTabChange: (tab: NoteTab) => void;
  onClose: () => void;
  onExpand?: () => void;
}) {
  const noteQuery = useGetNote(noteId);
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;

  const projectQuery = useGetProject(workspaceId, note?.projectId ?? "");
  const project =
    projectQuery.data?.status === 200 && projectQuery.data.data.success
      ? projectQuery.data.data.data
      : undefined;

  const recording = useRecording();
  const isThisNoteRecording = recording.session?.noteId === noteId;
  const isActive =
    isThisNoteRecording &&
    ["CONNECTING", "STREAMING", "PAUSED", "FINALIZING"].includes(
      recording.session?.status ?? ""
    );
  const isPaused = recording.session?.status === "PAUSED";

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      <header className="flex min-h-16 items-center justify-center border-b px-4 sm:px-6">
        <div className="flex w-full max-w-3xl items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="노트 닫기"
            onClick={onClose}
          >
            <PanelRightClose />
          </Button>
          {onExpand ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="전체 화면으로 보기"
              onClick={onExpand}
            >
              <Expand />
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">
              {note?.title ?? "노트"}
            </p>
            {project && (
              <div className="mt-1 flex gap-1.5 overflow-hidden">
                <Badge variant="secondary">
                  {project.name}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => value && onTabChange(value as NoteTab)}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="border-b px-4 sm:px-6 flex justify-center">
          <div className="w-full max-w-3xl">
            <TabsList variant="line" className="h-12 w-full justify-start">
              <TabsTrigger value="transcript">원본 전사</TabsTrigger>
              <TabsTrigger value="details">노트 정보</TabsTrigger>
            </TabsList>
          </div>
        </div>
        <TabsContent value="transcript" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <TranscriptView noteId={noteId} />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="details" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <NoteDetails noteId={noteId} />
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <motion.div
        layout
        className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center overflow-hidden rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] p-1 shadow-[0_8px_32px_rgba(28,25,23,0.12)] backdrop-blur-xl"
        style={{ borderRadius: 9999 }}
        transition={{ type: "spring", bounce: 0, duration: 0.2 }}
      >
        <motion.div
          layout
          transition={{ type: "spring", bounce: 0, duration: 0.2 }}
          className="flex items-center"
        >
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full text-[var(--el-muted)] hover:text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)]"
            aria-label="마이크 설정"
          >
            <Mic className="size-4" />
          </Button>
          <div className="mx-1 h-5 w-px bg-[var(--el-hairline)]" />
        </motion.div>

        <AnimatePresence mode="popLayout" initial={false}>
          {!isActive ? (
            <motion.div
              layout
              key="start"
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
                className="flex size-8 items-center justify-center rounded-full bg-destructive shadow-sm transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
                aria-label="기록 시작"
                onClick={() => void recording.start(noteId)}
              >
                <span className="sr-only">기록 시작</span>
              </button>
            </motion.div>
          ) : (
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
              <span className="min-w-[48px] font-mono text-[13px] font-semibold tabular-nums text-destructive">
                {formatElapsed(recording.elapsedMs)}
              </span>
              <span
                role="meter"
                data-testid="note-recording-waveform"
                aria-label="마이크 입력"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(recording.level * 100)}
                className="mx-0.5 flex h-5 w-8 items-center justify-center gap-[3px]"
              >
                {(recording.levelHistory ?? [0, 0, 0, 0, 0])
                  .slice(-5)
                  .map((sample, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-4 w-[3px] origin-center rounded-full bg-destructive transition-transform duration-75"
                      )}
                      style={{ transform: `scaleY(${Math.max(0.12, sample)})` }}
                    />
                  ))}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 shrink-0 rounded-full text-[var(--el-muted)] hover:text-[var(--el-ink)] hover:bg-[var(--el-surface-strong)]"
                aria-label={isPaused ? "재개" : "일시 정지"}
                onClick={() =>
                  void (isPaused ? recording.resume() : recording.pause())
                }
              >
                {isPaused ? (
                  <Play className="size-3.5 text-destructive" />
                ) : (
                  <Pause className="size-3.5" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 shrink-0 rounded-full text-[var(--el-muted-soft)] hover:text-[var(--el-muted)] hover:bg-[var(--el-surface-strong)]"
                aria-label="기록 종료"
                onClick={() => void recording.stop()}
              >
                <Square className="size-3.5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
