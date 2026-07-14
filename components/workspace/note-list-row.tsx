"use client";

import Link from "next/link";
import { Expand, MoreHorizontal, Waves } from "lucide-react";

import { useRecording } from "@/components/transcription/recording-provider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import { useGetProject } from "@/lib/api/generated/projects/projects";

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
  note: NoteListResponseDataNotesItem;
}) {
  const { session, elapsedMs, levelHistory } = useRecording();
  const projectQuery = useGetProject(workspaceId, note.projectId);
  const project =
    projectQuery.data?.status === 200 && projectQuery.data.data.success
      ? projectQuery.data.data.data
      : undefined;

  const isRecording =
    session?.noteId === note.noteId &&
    ["CONNECTING", "STREAMING", "PAUSED", "FINALIZING"].includes(
      session.status
    );

  // Fallback to elapsed duration while recording; duration is not retrieved for saved notes
  const displayDurationMs = isRecording ? elapsedMs : 0;

  const sideHref = `/w/${workspaceId}/notes/${note.noteId}?view=side&tab=transcript`;
  const fullHref = `/w/${workspaceId}/notes/${note.noteId}?view=full&tab=transcript`;
  const timestamp = new Date(note.updatedAt);

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
            {isRecording ? formatDuration(displayDurationMs) : "--:--"}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-medium tracking-[-0.01em] text-[var(--el-ink)] sm:text-base">
            {note.title}
          </h3>
          {(project || isRecording) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {isRecording && (
                <span className="mr-1 text-[11px] font-semibold text-destructive">
                  기록 중
                </span>
              )}
              {project && (
                <Badge variant="secondary">
                  {project.name}
                </Badge>
              )}
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
          {project && <p className="mt-1 truncate">{project.name}</p>}
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
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );
}
