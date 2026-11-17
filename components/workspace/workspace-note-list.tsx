"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/ui/toast";

import { NoteListRow } from "@/components/workspace/note-list-row";
import { WorkspaceOnboarding } from "@/components/workspace/workspace-onboarding";
import { Button } from "@/components/ui/button";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { Skeleton } from "@/components/ui/skeleton";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import {
  isMeetingActive,
  recordingClockOriginMs,
} from "@/lib/notes/meeting-state";
import { useAlignedNow } from "@/lib/notes/use-aligned-now";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";
import { groupNotesByRecency } from "@/lib/workspace/note-groups";
import { cn } from "@/lib/utils";

export function WorkspaceNoteList({
  workspaceId,
  notes,
  isPending,
  isError,
  onRetry,
  onNewMeeting,
  hasMore = false,
  isLoadingMore = false,
  stale = false,
  onLoadMore,
}: {
  workspaceId: string;
  notes: NoteListResponseDataNotesItem[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onNewMeeting: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  stale?: boolean;
  onLoadMore?: () => void;
}) {
  const t = useTranslations("workspace.noteList");
  const tActions = useTranslations("common.actions");
  const tDates = useTranslations("dates");
  const dateLocale = useDisplayLocale();
  const retryRef = useRef(onRetry);
  const activeMeetingStarts = notes
    .filter(isMeetingActive)
    .flatMap((note) => recordingClockOriginMs(note) ?? []);
  const now = useAlignedNow(60_000, true, activeMeetingStarts);

  const ids = notes.map((note) => note.noteId).join(",");
  const [shown, setShown] = useState<{
    ids: string;
    loadingMore: boolean;
    before: Set<string> | null;
  }>({ ids, loadingMore: isLoadingMore, before: null });
  if (shown.ids !== ids || shown.loadingMore !== isLoadingMore) {
    setShown({
      ids,
      loadingMore: isLoadingMore,
      before:
        shown.ids === ids
          ? shown.before
          : shown.loadingMore && ids.startsWith(shown.ids)
            ? new Set(shown.ids.split(","))
            : null,
    });
  }

  useEffect(() => {
    retryRef.current = onRetry;
  }, [onRetry]);

  useEffect(() => {
    if (!isError) return;

    toast.error(t("loadFailed"), {
      id: `workspace-notes-${workspaceId}`,
      action: {
        label: tActions("retry"),
        onClick: () => retryRef.current(),
      },
    });
  }, [isError, workspaceId, t, tActions]);

  if (isPending && notes.length === 0) {
    return (
      <div aria-label={t("loading")}>
        <div className="px-3 pt-5 pb-2">
          <Skeleton className="h-4 w-12" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex h-16 items-center gap-[14px] px-3">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (isError && !notes.length) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={onRetry}
        >
          <RefreshCcw /> {tActions("retry")}
        </Button>
      </div>
    );
  }

  if (!notes.length) {
    return (
      <WorkspaceOnboarding
        stage="no-note"
        onNewMeeting={onNewMeeting}
        onCreateProject={onNewMeeting}
      />
    );
  }

  return (
    <div
      data-testid="workspace-note-list"
      aria-busy={stale || undefined}
      inert={stale}
      className={cn(
        "transition-opacity duration-150 ease-out motion-reduce:transition-none",
        stale && "opacity-60"
      )}
    >
      {groupNotesByRecency(notes, dateLocale, tDates).map((group) => (
        <section key={group.key}>
          <h2 className="px-3 pt-5 pb-2 text-xs font-medium text-[var(--el-muted)]">
            {group.label}
          </h2>
          <div>
            {group.notes.map((note) => (
              <NoteListRow
                key={note.noteId}
                workspaceId={workspaceId}
                note={note}
                now={now}
                arrived={
                  shown.before !== null && !shown.before.has(note.noteId)
                }
              />
            ))}
          </div>
        </section>
      ))}
      {hasMore && onLoadMore ? (
        <div className="flex justify-center pt-6">
          <LoadMoreButton
            loading={isLoadingMore}
            loadingLabel={t("loadingMore")}
            onClick={onLoadMore}
          >
            {t("loadMore")}
          </LoadMoreButton>
        </div>
      ) : null}
    </div>
  );
}
