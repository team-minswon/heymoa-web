"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Info, Pause } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  isAutoEnded,
  NoteAutoEndNotice,
} from "@/components/notes/note-auto-end-notice";
import type {
  NoteListResponseData,
  NoteResponseData,
} from "@/lib/api/generated/models";
import { formatPromiseTime } from "@/lib/format/date";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";
import { pausedDayCount } from "@/lib/notes/meeting-state";
import { isNoteListQueryKey } from "@/lib/notes/query-keys";
import { useAlignedNow } from "@/lib/notes/use-aligned-now";

function cachedPausedAt(queryClient: QueryClient, noteId: string) {
  for (const [, response] of queryClient.getQueriesData<{
    status: number;
    data: { success: boolean; data: NoteListResponseData };
  }>({ predicate: (query) => isNoteListQueryKey(query.queryKey) })) {
    if (response?.status !== 200 || !response.data.success) continue;
    const row = response.data.data.notes.find((note) => note.noteId === noteId);
    if (row?.pausedAt) return row.pausedAt;
  }
  return null;
}

export function NoteStatusBand({
  note,
  fromMail = false,
}: {
  note: NoteResponseData;
  fromMail?: boolean;
}) {
  const t = useTranslations("notes.statusBand");
  const tDates = useTranslations("dates");
  const dateLocale = useDisplayLocale();
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (notify: () => void) => queryClient.getQueryCache().subscribe(notify),
    [queryClient]
  );
  const cachedPaused = useSyncExternalStore(
    subscribe,
    () => cachedPausedAt(queryClient, note.noteId),
    () => null
  );
  const pausedAt = note.pausedAt ?? cachedPaused;
  const now = useAlignedNow(60_000);
  const [arrival, setArrival] = useState<{
    noteId: string;
    status: NoteResponseData["meetingStatus"];
  } | null>(null);
  if (fromMail && arrival?.noteId !== note.noteId) {
    setArrival({ noteId: note.noteId, status: note.meetingStatus });
  }
  const landed =
    fromMail &&
    arrival?.noteId === note.noteId &&
    arrival.status === note.meetingStatus;

  if (isAutoEnded(note)) return <NoteAutoEndNotice note={note} />;

  let lead: string | null = null;
  let rest: string | null = null;
  if (note.meetingStatus === "PAUSED") {
    const days = pausedDayCount(pausedAt, now);
    const scheduledAt = note.autoEnd?.scheduledAt;
    if (scheduledAt)
      lead = t("autoEndScheduled", {
        time: formatPromiseTime(scheduledAt, dateLocale, tDates),
      });
    else if (days !== null) lead = t("pausedDays", { count: days });
    else if (landed) lead = t("paused");
    if (landed) rest = t("pausedActions");
  } else if (landed && note.meetingStatus === "IN_PROGRESS") {
    lead = t("resumedSinceMail");
  } else if (landed && note.meetingStatus === "ENDED") {
    lead = t("endedSinceMail");
  }
  if (lead === null) return null;
  const Icon = note.meetingStatus === "PAUSED" ? Pause : Info;

  return (
    <div
      role="status"
      data-testid="note-status-band"
      className="shrink-0 border-b border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-[var(--note-gutter)] py-2.5"
    >
      <p className="mx-auto flex w-full max-w-[820px] items-start gap-2 text-[13px] leading-5 text-[var(--el-body)]">
        <Icon
          aria-hidden
          className="mt-[3px] size-3.5 shrink-0 text-[var(--el-muted)]"
        />
        <span className="text-pretty">
          <span className="font-medium text-[var(--el-ink)]">{lead}</span>
          {rest ? ` ${rest}` : null}
        </span>
      </p>
    </div>
  );
}
