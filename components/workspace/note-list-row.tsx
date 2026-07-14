"use client";

import Link from "next/link";
import { Expand, MoreHorizontal } from "lucide-react";

import { useRecording } from "@/components/transcription/recording-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";

export function NoteListRow({
  workspaceId,
  note,
}: {
  workspaceId: string;
  note: NoteListResponseDataNotesItem;
}) {
  const recording = useRecording();
  const isRecording =
    recording.session?.noteId === note.noteId &&
    ["requesting-permission", "connecting", "recording", "stopping"].includes(
      recording.phase
    );
  const sideHref = `/w/${workspaceId}/notes/${note.noteId}?view=side&tab=transcript`;
  const fullHref = `/w/${workspaceId}/notes/${note.noteId}?view=full&tab=transcript`;
  const timestamp = new Date(note.updatedAt);

  return (
    <article className="group flex min-h-[76px] items-center gap-2 rounded-2xl border border-transparent px-3 py-3 transition-colors duration-150 hover:border-[var(--el-hairline)] hover:bg-white hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] focus-within:bg-white">
      <Link
        href={sideHref}
        aria-label={`${note.title} 노트 열기`}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--el-ink)]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-medium tracking-[-0.01em] text-[var(--el-ink)] sm:text-base">
              {note.title}
            </h3>
            {isRecording ? (
              <span className="shrink-0 rounded-full bg-destructive/8 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                기록 중
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-[var(--el-muted)]">
            {new Intl.DateTimeFormat("ko-KR", {
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format(timestamp)}
          </p>
        </div>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${note.title} 노트 메뉴`}
              className="rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
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
