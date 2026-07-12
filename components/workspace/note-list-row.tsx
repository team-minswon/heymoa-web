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
  const { session, elapsedMs } = useRecording();

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
    <article className="group flex min-h-20 items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60 sm:px-4">
      <Link
        href={sideHref}
        aria-label={`${note.title} 노트 열기`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div
          className={cn(
            "flex w-14 shrink-0 flex-col items-center gap-1",
            isRecording ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {isRecording ? (
            <div className="relative flex size-4 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/40 opacity-75"></span>
              <span className="relative flex h-3 w-3 items-center justify-center gap-[2px]">
                <span className="h-full w-1 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-destructive"></span>
                <span className="h-2/3 w-1 animate-[pulse_1s_ease-in-out_infinite_0.2s] rounded-full bg-destructive"></span>
                <span className="h-full w-1 animate-[pulse_1s_ease-in-out_infinite_0.4s] rounded-full bg-destructive"></span>
              </span>
            </div>
          ) : (
            <Waves className="size-4" />
          )}
          <span className="font-mono text-[11px] tabular-nums">
            {formatDuration(displayDurationMs)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold sm:text-base">
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
        <div className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground sm:block">
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
