import type { TranscriptResponseDataTranscriptGapsItem } from "@/lib/api/generated/models";
import { getAppDateKey } from "@/lib/format/date";
import type { AppT } from "@/lib/i18n/translator";

export type TranscriptGap = {
  gapId: string;
  kind: string;
  startedAtMs: number;
  endedAtMs: number;
  startedAt: string;
  endedAt?: string | null;
  reason?: string | null;
};

export type UntranscribedGap = TranscriptResponseDataTranscriptGapsItem;

export type GapRow = {
  gapId: string;
  kind: "PAUSE" | "LOST" | "UNTRANSCRIBED";
  startedAtMs: number;
  endedAtMs: number;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number;
};

function wallClockMs(startedAt: string, endedAt: string | null) {
  if (!endedAt) return 0;
  return Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
}

export function isGapOpen(row: GapRow) {
  return row.kind !== "UNTRANSCRIBED" && row.endedAt === null;
}

export function spansVisibleClockMinutes(row: GapRow) {
  if (!row.startedAt || !row.endedAt) return false;
  return (
    Math.floor(Date.parse(row.startedAt) / 60_000) !==
    Math.floor(Date.parse(row.endedAt) / 60_000)
  );
}

export function toGapRows(
  gaps: TranscriptGap[],
  untranscribed: UntranscribedGap[] = []
): GapRow[] {
  const rows: GapRow[] = [];

  const ordered = [...gaps].sort((a, b) => a.startedAtMs - b.startedAtMs);
  for (const gap of ordered) {
    const endedAt = gap.endedAt ?? null;
    if (gap.kind === "PAUSE") {
      rows.push({
        gapId: gap.gapId,
        kind: "PAUSE",
        startedAtMs: gap.startedAtMs,
        endedAtMs: gap.endedAtMs,
        startedAt: gap.startedAt,
        endedAt,
        durationMs: wallClockMs(gap.startedAt, endedAt),
      });
      continue;
    }

    const previous = rows.at(-1);
    if (
      previous &&
      previous.kind === "LOST" &&
      gap.startedAtMs <= previous.endedAtMs
    ) {
      previous.endedAtMs = Math.max(previous.endedAtMs, gap.endedAtMs);
      previous.durationMs = previous.endedAtMs - previous.startedAtMs;
      previous.endedAt = previous.endedAt && endedAt ? endedAt : null;
      continue;
    }

    rows.push({
      gapId: gap.gapId,
      kind: "LOST",
      startedAtMs: gap.startedAtMs,
      endedAtMs: gap.endedAtMs,
      startedAt: gap.startedAt,
      endedAt,
      durationMs: gap.endedAtMs - gap.startedAtMs,
    });
  }

  const lost = rows.filter((row) => row.kind === "LOST");
  for (const span of mergeSpans(untranscribed)) {
    subtractSpans(span, lost).forEach(([startedAtMs, endedAtMs], index) => {
      if (endedAtMs - startedAtMs < MIN_UNTRANSCRIBED_MS) return;
      rows.push({
        gapId: index === 0 ? span.gapId : `${span.gapId}-${startedAtMs}`,
        kind: "UNTRANSCRIBED",
        startedAtMs,
        endedAtMs,
        startedAt: null,
        endedAt: null,
        durationMs: endedAtMs - startedAtMs,
      });
    });
  }

  return rows.sort((a, b) => a.startedAtMs - b.startedAtMs);
}

const MIN_UNTRANSCRIBED_MS = 1_000;

type Span = { gapId: string; startedAtMs: number; endedAtMs: number };

function mergeSpans(gaps: UntranscribedGap[]): Span[] {
  const spans: Span[] = [];
  const ordered = [...gaps].sort((a, b) => a.startedAtMs - b.startedAtMs);
  for (const { gapId, startedAtMs, endedAtMs } of ordered) {
    const previous = spans.at(-1);
    if (previous && startedAtMs <= previous.endedAtMs) {
      previous.endedAtMs = Math.max(previous.endedAtMs, endedAtMs);
      continue;
    }
    spans.push({ gapId, startedAtMs, endedAtMs });
  }
  return spans;
}

function subtractSpans(span: Span, lost: GapRow[]): [number, number][] {
  let pieces: [number, number][] = [[span.startedAtMs, span.endedAtMs]];
  for (const { startedAtMs, endedAtMs } of lost) {
    pieces = pieces.flatMap(([start, end]): [number, number][] => {
      if (endedAtMs <= start || startedAtMs >= end) return [[start, end]];
      return [
        [start, Math.min(end, startedAtMs)],
        [Math.max(start, endedAtMs), end],
      ].filter(([from, to]) => to > from) as [number, number][];
    });
  }
  return pieces;
}

export function gapDurationOf(milliseconds: number): GapDuration {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return { unit: "brief", value: 0 };

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return { unit: "minutes", value: minutes };

  const hours = Math.round(minutes / 60);
  if (hours < 24) return { unit: "hours", value: hours };

  return { unit: "days", value: Math.round(hours / 24) };
}

export type GapDuration = {
  unit: "brief" | "minutes" | "hours" | "days";
  value: number;
};

export function formatGapDuration(milliseconds: number, t: AppT) {
  return t("notes.transcript.gap.duration", gapDurationOf(milliseconds));
}

export function spansCalendarDays(row: GapRow) {
  if (!row.startedAt || !row.endedAt) return false;
  return getAppDateKey(row.startedAt) !== getAppDateKey(row.endedAt);
}

export function gapHeadline(row: GapRow, t: AppT) {
  const duration = isGapOpen(row) ? null : formatGapDuration(row.durationMs, t);
  if (row.kind === "PAUSE") {
    return duration
      ? t("notes.transcript.gap.pause", { duration })
      : t("notes.transcript.gap.pauseOpen");
  }
  if (row.kind === "UNTRANSCRIBED") {
    return t("notes.transcript.gap.untranscribed", {
      duration: duration ?? "",
    });
  }
  return duration
    ? t("notes.transcript.gap.lost", { duration })
    : t("notes.transcript.gap.lostOpen");
}
