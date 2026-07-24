"use client";

import Link, { useLinkStatus } from "next/link";
import { Expand, FileText, Loader2, MoreHorizontal } from "lucide-react";

import {
  useRecording,
  useRecordingMeter,
} from "@/components/transcription/recording-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import { formatAppDate } from "@/lib/format/date";
import { formatRelativeTime } from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";

function ActiveRecordingMeter({ title }: { title: string }) {
  const meter = useRecordingMeter();

  return (
    <div
      role="meter"
      aria-label={`${title} 마이크 입력`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(
        Math.max(...meter.levelHistory.slice(-5), 0) * 100
      )}
      className="flex h-4 w-5 items-center justify-center gap-[2px]"
    >
      {meter.levelHistory.slice(-4).map((sample, index) => (
        <span
          key={index}
          className="h-3.5 w-[2px] origin-center rounded-full bg-destructive transition-transform duration-75"
          style={{ transform: `scaleY(${Math.max(0.16, sample)})` }}
        />
      ))}
    </div>
  );
}

function NoteRowIcon({
  title,
  isRecording,
}: {
  title: string;
  isRecording: boolean;
}) {
  const { pending } = useLinkStatus();

  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center",
        isRecording ? "text-destructive" : "text-[var(--el-muted-soft)]"
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : isRecording ? (
        <ActiveRecordingMeter title={title} />
      ) : (
        <FileText className="size-4" aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * 상대 시각("방금/14분 전/어제"). `now`는 목록이 단일 시계로 내려준다 — 행마다 타이머를 두면
 * 노트가 많을 때 렌더가 폭증한다. `now`가 없으면(SSR·첫 렌더·미해결) 짧은 절대 날짜로 두어
 * 하이드레이션을 맞추고, 채워지면 상대 시각으로 교체한다.
 */
function RelativeTime({ iso, now }: { iso: string; now: number | null }) {
  return (
    <span className="shrink-0 text-xs text-[var(--el-muted)] tabular-nums">
      {now === null
        ? formatAppDate(iso, { month: "long", day: "numeric" })
        : formatRelativeTime(iso, now)}
    </span>
  );
}

export function NoteListRow({
  workspaceId,
  note,
  now = null,
}: {
  workspaceId: string;
  note: NoteListResponseDataNotesItem;
  /** 목록이 내려주는 공용 시계. 없으면 절대 날짜 fallback. */
  now?: number | null;
}) {
  const recording = useRecording();
  const isRecording =
    (recording.activeNoteId ?? recording.session?.noteId) === note.noteId &&
    ["requesting-permission", "connecting", "recording", "stopping"].includes(
      recording.phase
    );
  const sideHref = `/w/${workspaceId}/notes/${note.noteId}?view=side&tab=transcript`;
  const fullHref = `/w/${workspaceId}/notes/${note.noteId}?view=full&tab=transcript`;

  // v5 목록 행 정본: 높이 52 · 한 줄 · r8 · 배경 없음 · 아이콘 + 제목 15 + 상대 시각.
  // 카드·그림자·배지·녹음시간은 없다(FORM SPEC).
  return (
    <article className="group flex h-[52px] items-center gap-2 rounded-control px-3 transition-colors hover:bg-[var(--el-canvas-soft)] focus-within:bg-[var(--el-canvas-soft)]">
      <Link
        href={sideHref}
        aria-label={`${note.title} 노트 열기`}
        // self-stretch로 52px 전체를 클릭·포커스 영역으로 채운다(빈 위아래도 노트가 열리게).
        className="flex min-w-0 flex-1 items-center gap-[14px] self-stretch rounded-control outline-none focus-visible:ring-2 focus-visible:ring-[var(--el-ink)]"
      >
        <NoteRowIcon title={note.title} isRecording={isRecording} />
        <h3 className="min-w-0 flex-1 truncate text-read font-medium text-[var(--el-ink)]">
          {note.title}
        </h3>
        <RelativeTime iso={note.updatedAt} now={now} />
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
