import { useTranslations } from "next-intl";

import {
  gapDurationOf,
  isGapOpen,
  spansCalendarDays,
  spansVisibleClockMinutes,
  type GapRow,
} from "@/lib/transcription/gaps";
import { formatAppClock, getAppDateKey } from "@/lib/format/date";
import { formatOffset } from "@/lib/transcription/presentation";

function clockTime(iso: string, withDate: boolean) {
  const time = formatAppClock(iso);
  if (!withDate) return time;
  const [, month, day] = getAppDateKey(iso).split("-").map(Number);
  return `${month}/${day} ${time}`;
}

export function TranscriptGapRow({ row }: { row: GapRow }) {
  const t = useTranslations("notes.transcript.gap");
  const paused = row.kind === "PAUSE";
  const open = isGapOpen(row);
  const withDate = spansCalendarDays(row);

  const offsetLabel = paused
    ? formatOffset(row.startedAtMs)
    : `${formatOffset(row.startedAtMs)} – ${
        open ? t("ongoing") : formatOffset(row.endedAtMs)
      }`;

  const duration = open ? null : t("duration", gapDurationOf(row.durationMs));
  const kind =
    row.kind === "PAUSE"
      ? "pause"
      : row.kind === "UNTRANSCRIBED"
        ? "untranscribed"
        : "lost";
  const headline = duration
    ? t(kind, { duration })
    : t(`${kind}Open` as "pauseOpen" | "lostOpen");

  return (
    <div
      data-testid="transcript-gap"
      data-gap-kind={row.kind}
      data-gap-open={open || undefined}
      className="grid grid-cols-1 gap-2 border-b border-dashed border-[var(--el-hairline)] py-4 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-5"
    >
      <time className="pt-1 font-mono text-[11px] tabular-nums text-[var(--el-muted-soft)] sm:w-32">
        {offsetLabel}
      </time>
      <p className="min-w-0 text-read leading-7 text-[var(--el-muted-soft)]">
        {headline}
        {paused && spansVisibleClockMinutes(row) ? (
          <span className="ml-2 text-[13px] text-[var(--el-muted-soft)]">
            {t("pausedBetween", {
              start: clockTime(row.startedAt!, withDate),
              end: clockTime(row.endedAt!, withDate),
            })}
          </span>
        ) : null}
      </p>
    </div>
  );
}
