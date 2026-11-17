"use client";

import { track } from "@/lib/analytics/track";

import { memo, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Expand,
  FileText,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

import {
  useRecordingMeter,
  useRecordingNoteId,
} from "@/components/transcription/recording-provider";
import { NoteDeleteDialog } from "@/components/notes/note-delete-dialog";
import {
  NoteParticipantAvatars,
  ParticipantAvatar,
} from "@/components/notes/note-participants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import {
  getRecordedDurationMs,
  MEETING_STATUS_KEY,
  pausedDayCount,
} from "@/lib/notes/meeting-state";
import { cn } from "@/lib/utils";
import { useIsWorkspaceAdmin } from "@/lib/workspace/use-is-workspace-admin";

const SHIFT_WHEN_OPEN =
  "group-hover/row:-translate-x-9 group-has-[:focus-visible]/row:-translate-x-9 group-has-[[aria-expanded=true]]/row:-translate-x-9 group-has-[[data-popup-open]]/row:-translate-x-9 [@media(hover:none)]:-translate-x-9";
const REVEAL_WHEN_OPEN =
  "group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-has-[:focus-visible]/row:pointer-events-auto group-has-[:focus-visible]/row:opacity-100 group-has-[[aria-expanded=true]]/row:pointer-events-auto group-has-[[aria-expanded=true]]/row:opacity-100 group-has-[[data-popup-open]]/row:pointer-events-auto group-has-[[data-popup-open]]/row:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100";

function ActiveRecordingMeter({ title }: { title: string }) {
  const meter = useRecordingMeter();
  const t = useTranslations("workspace.noteRow");

  return (
    <div
      role="meter"
      aria-label={t("micInput", { title })}
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
  forcePending = false,
}: {
  title: string;
  isRecording: boolean;
  forcePending?: boolean;
}) {
  const { pending } = useLinkStatus();
  const isPending = pending || forcePending;

  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center",
        isRecording ? "text-destructive" : "text-[var(--el-muted-soft)]"
      )}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : isRecording ? (
        <ActiveRecordingMeter title={title} />
      ) : (
        <FileText className="size-4" aria-hidden="true" />
      )}
    </span>
  );
}

function MeetingMeta({
  note,
  now,
}: {
  note: NoteListResponseDataNotesItem;
  now: number | null;
}) {
  const t = useTranslations("workspace.noteRow");
  const tStatus = useTranslations("common.meetingStatus");
  const status = note.meetingStatus;
  const minutes = Math.floor(getRecordedDurationMs(note, now ?? 0) / 60_000);
  const participantCount = note.participants?.length ?? 0;
  const pausedDays = pausedDayCount(note.pausedAt, now);

  return (
    <span className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-[var(--el-muted)]">
      {status === "IN_PROGRESS" ? (
        <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
      ) : null}
      <span
        className={cn(
          "shrink-0 font-medium",
          status === "IN_PROGRESS" && "text-destructive"
        )}
      >
        {status === "PAUSED" && pausedDays !== null
          ? t("pausedDays", { count: pausedDays })
          : tStatus(MEETING_STATUS_KEY[status])}
      </span>
      {status !== "NOT_STARTED" ? (
        <>
          <span aria-hidden="true" className="shrink-0">
            ·
          </span>
          <span className="shrink-0 tabular-nums">
            {t("recordedMinutes", {
              hours: Math.floor(minutes / 60),
              count: minutes % 60,
            })}
          </span>
        </>
      ) : null}
      {participantCount > 0 ? (
        <>
          <span aria-hidden="true" className="shrink-0">
            ·
          </span>
          <span className="shrink-0 tabular-nums">
            {t("participants", { count: participantCount })}
          </span>
        </>
      ) : null}
    </span>
  );
}

export const NoteListRow = memo(function NoteListRow({
  workspaceId,
  note,
  now = null,
  arrived = false,
}: {
  workspaceId: string;
  note: NoteListResponseDataNotesItem;
  now?: number | null;
  arrived?: boolean;
}) {
  const t = useTranslations("workspace.noteRow");
  const tActions = useTranslations("common.actions");
  const isRecording = useRecordingNoteId() === note.noteId;
  const routeKey = `${usePathname()}?${useSearchParams()?.toString() ?? ""}`;
  const [openedFullViewFrom, setOpenedFullViewFrom] = useState<string | null>(
    null
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canDelete = useIsWorkspaceAdmin(workspaceId);
  if (openedFullViewFrom !== null && openedFullViewFrom !== routeKey) {
    setOpenedFullViewFrom(null);
  }
  const openingFullView = openedFullViewFrom === routeKey;

  const sideHref = `/w/${workspaceId}/notes/${note.noteId}?view=side&tab=details`;
  const fullHref = `/w/${workspaceId}/notes/${note.noteId}?view=full&tab=details`;

  return (
    <article
      className={cn(
        "group/row relative flex h-16 items-center gap-2 rounded-control px-3 transition-colors hover:bg-[var(--el-canvas-soft)] focus-within:bg-[var(--el-canvas-soft)] has-[[data-popup-open]]:bg-[var(--el-canvas-soft)] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-[var(--el-ink)] has-[a:focus-visible]:ring-inset",
        arrived &&
          "animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none"
      )}
    >
      <Link
        href={sideHref}
        onClick={() =>
          track("note_opened", {
            workspace_id: workspaceId,
            view: "side",
            source: "list",
          })
        }
        aria-label={t("open", { title: note.title })}
        className="flex min-w-0 flex-1 items-center gap-[14px] self-stretch rounded-control outline-none"
      >
        <NoteRowIcon
          title={note.title}
          isRecording={isRecording}
          forcePending={openingFullView}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="min-w-16 truncate text-read font-medium text-[var(--el-ink)]">
            {note.title}
          </h3>
          <MeetingMeta note={note} now={now} />
        </span>
        <span
          data-slot="note-row-people"
          className={cn(
            "ml-9 flex shrink-0 items-center gap-2 transition-transform duration-200 ease-out motion-reduce:transition-none",
            SHIFT_WHEN_OPEN
          )}
        >
          {note.meetingStartedBy ? (
            <>
              <ParticipantAvatar
                participant={note.meetingStartedBy}
                size="sm"
                isStarter
              />
              <span
                aria-hidden="true"
                className="h-5 w-px bg-[var(--el-hairline-strong)]"
              />
            </>
          ) : null}
          <NoteParticipantAvatars
            participants={note.participants}
            max={4}
            size="sm"
          />
        </span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("menu", { title: note.title })}
              data-slot="note-row-menu"
              className={cn(
                "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-full opacity-0 transition-opacity duration-200 ease-out motion-reduce:transition-none",
                REVEAL_WHEN_OPEN
              )}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLinkItem
            href={fullHref}
            onClick={() =>
              track("note_opened", {
                workspace_id: workspaceId,
                view: "full",
                source: "list",
              })
            }
            onNavigate={() => setOpenedFullViewFrom(routeKey)}
          >
            <Expand /> {t("fullScreen")}
          </DropdownMenuLinkItem>
          {canDelete ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 /> {tActions("delete")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canDelete ? (
        <NoteDeleteDialog
          workspaceId={workspaceId}
          noteId={note.noteId}
          projectId={note.projectId}
          title={note.title}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      ) : null}
    </article>
  );
});
