"use client";

import { useState } from "react";
import {
  Expand,
  Mic,
  MoreHorizontal,
  PanelRightClose,
  Pause,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";

import { NoteDetails } from "@/components/notes/note-details";
import { TranscriptView } from "@/components/notes/transcript-view";
import { useRecording } from "@/components/transcription/recording-provider";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getListWorkspaceNotesQueryKey,
  useDeleteNote,
  useGetNote,
} from "@/lib/api/generated/note/note";

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
  const queryClient = useQueryClient();
  const noteQuery = useGetNote(noteId);
  const deleteNote = useDeleteNote();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
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
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">
              {note?.title ?? "노트"}
            </p>
            {note?.folders.length ? (
              <div className="mt-1 flex gap-1.5 overflow-hidden">
                {note.folders.map((folder) => (
                  <Badge key={folder.folderId} variant="secondary">
                    {folder.name}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="노트 메뉴"
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 /> 노트 삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="노트 닫기"
            onClick={onClose}
          >
            <PanelRightClose />
          </Button>
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
            <NoteDetails workspaceId={workspaceId} noteId={noteId} />
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <motion.div
        layout
        className="absolute bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center overflow-hidden rounded-full border bg-background/95 p-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
        style={{ borderRadius: 9999 }}
        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      >
        <motion.div
          layout
          transition={{ type: "spring", bounce: 0, duration: 0.3 }}
          className="flex items-center"
        >
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full text-muted-foreground"
            aria-label="마이크 설정"
          >
            <Mic className="size-5" />
          </Button>
          <div className="mx-1 h-6 w-[1px] bg-border" />
        </motion.div>

        <AnimatePresence mode="popLayout" initial={false}>
          {!isActive ? (
            <motion.div
              layout
              key="start"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: { duration: 0.2, delay: 0.3 },
              }}
              exit={{ opacity: 0, transition: { duration: 0.1, delay: 0 } }}
              className="flex w-max shrink-0 items-center"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full px-2 hover:bg-transparent"
                aria-label="기록 시작"
                onClick={() => void recording.start(noteId)}
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90">
                  <span className="sr-only">기록 시작</span>
                </span>
              </Button>
            </motion.div>
          ) : (
            <motion.div
              layout
              key="recording"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: { duration: 0.2, delay: 0.3 },
              }}
              exit={{ opacity: 0, transition: { duration: 0.1, delay: 0 } }}
              className="flex w-max shrink-0 items-center gap-2 pl-2 pr-1"
            >
              <span className="min-w-[48px] font-mono text-sm font-medium tabular-nums text-destructive">
                {formatElapsed(recording.elapsedMs)}
              </span>
              <span className="mx-1 relative flex h-3 w-4 items-center justify-center gap-[2px]">
                <span
                  className={cn(
                    "h-full w-[3px] rounded-full bg-destructive transition-all",
                    !isPaused && "animate-[pulse_1s_ease-in-out_infinite]"
                  )}
                ></span>
                <span
                  className={cn(
                    "h-2/3 w-[3px] rounded-full bg-destructive transition-all",
                    !isPaused && "animate-[pulse_1s_ease-in-out_infinite_0.2s]"
                  )}
                ></span>
                <span
                  className={cn(
                    "h-full w-[3px] rounded-full bg-destructive transition-all",
                    !isPaused && "animate-[pulse_1s_ease-in-out_infinite_0.4s]"
                  )}
                ></span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 rounded-full"
                aria-label={isPaused ? "재개" : "일시 정지"}
                onClick={() =>
                  void (isPaused ? recording.resume() : recording.pause())
                }
              >
                {isPaused ? (
                  <Play className="size-4 text-destructive" />
                ) : (
                  <Pause className="size-4 text-destructive" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 rounded-full"
                aria-label="기록 종료"
                onClick={() => void recording.stop()}
              >
                <Square className="size-4 text-muted-foreground" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>노트를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              노트와 연결된 전사 기록도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                await deleteNote.mutateAsync({ noteId });
                await queryClient.invalidateQueries({
                  queryKey: getListWorkspaceNotesQueryKey(workspaceId),
                });
                onClose();
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
