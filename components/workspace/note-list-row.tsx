"use client";

import { useState } from "react";
import Link from "next/link";
import { Expand, MoreHorizontal, Trash2, Waves } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NoteSummaryResponse } from "@/lib/api/generated/models";
import {
  getListWorkspaceNotesQueryKey,
  useDeleteNote,
} from "@/lib/api/generated/note/note";

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function NoteListRow({
  workspaceId,
  note,
}: {
  workspaceId: string;
  note: NoteSummaryResponse;
}) {
  const queryClient = useQueryClient();
  const deleteNote = useDeleteNote();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { session, elapsedMs, levelHistory } = useRecording();

  const isRecording =
    session?.noteId === note.noteId &&
    ["CONNECTING", "STREAMING", "PAUSED", "FINALIZING"].includes(
      session.status
    );

  const displayDurationMs = isRecording ? elapsedMs : note.recordedDurationMs;

  const sideHref = `/w/${workspaceId}/notes/${note.noteId}?view=side&tab=transcript`;
  const fullHref = `/w/${workspaceId}/notes/${note.noteId}?view=full&tab=transcript`;
  const timestamp = new Date(note.lastRecordedAt ?? note.createdAt);

  return (
    <article className="group flex min-h-[76px] items-center gap-2 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-white/70 focus-within:bg-white/70 sm:px-3">
      <Link
        href={sideHref}
        aria-label={`${note.title} 노트 열기`}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-5"
      >
        <div
          className={cn(
            "flex w-14 shrink-0 flex-col items-center gap-1",
            isRecording ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {isRecording ? (
            <div className="flex h-4 items-center gap-[2px]" aria-hidden="true">
              {levelHistory.slice(-5).map((sample, index) => (
                <span
                  key={index}
                  className="h-4 w-[2px] origin-center rounded-full bg-destructive transition-transform duration-75"
                  style={{ transform: `scaleY(${Math.max(0.16, sample)})` }}
                />
              ))}
            </div>
          ) : (
            <Waves className="size-4" />
          )}
          <span className="font-mono text-[11px] tabular-nums">
            {formatDuration(displayDurationMs)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-medium tracking-[-0.01em] text-[var(--el-ink)] sm:text-base">
            {note.title}
          </h3>
          {(note.folders.length > 0 || isRecording) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {isRecording && (
                <span className="mr-1 text-[11px] font-semibold text-destructive">
                  기록 중
                </span>
              )}
              {note.folders.map((folder) => (
                <Badge key={folder.folderId} variant="secondary">
                  {folder.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="hidden w-32 shrink-0 text-right text-xs leading-5 text-[var(--el-muted)] sm:block">
          <p>
            {new Intl.DateTimeFormat("ko-KR", {
              hour: "numeric",
              minute: "2-digit",
            }).format(timestamp)}
          </p>
          <p className="mt-1 truncate">{note.createdBy.name}</p>
        </div>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${note.title} 노트 메뉴`}
              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLinkItem href={fullHref}>
            <Expand /> 전체 화면으로 열기
          </DropdownMenuLinkItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 /> 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>노트를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {note.title} 노트와 전사 기록이 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                await deleteNote.mutateAsync({ noteId: note.noteId });
                await queryClient.invalidateQueries({
                  queryKey: getListWorkspaceNotesQueryKey(workspaceId),
                });
                setConfirmDelete(false);
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
