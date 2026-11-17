import { formatViewerDate, viewerDateKey } from "@/lib/format/date";
import type { DatesT } from "@/lib/i18n/translator";

export function threadDividers(
  times: readonly string[],
  timeZone?: string
): boolean[] {
  let previousDay: string | null = null;

  return times.map((at) => {
    const day = viewerDateKey(at, timeZone);
    const isNewDay = previousDay === null || previousDay !== day;
    previousDay = day;
    return isNewDay;
  });
}

export function dividerLabel(
  at: string,
  now: Date,
  t: DatesT,
  locale?: string,
  timeZone?: string
) {
  const time = formatViewerDate(
    at,
    { hour: "numeric", minute: "2-digit", timeZone },
    locale
  );
  const day = viewerDateKey(at, timeZone);
  const today = viewerDateKey(now, timeZone);

  if (day === today) return t("todayAt", { time });
  if (day === previousDayKey(today)) return t("yesterdayAt", { time });

  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  const date = formatViewerDate(
    at,
    {
      year: sameYear ? undefined : "numeric",
      month: "long",
      day: "numeric",
      timeZone,
    },
    locale
  );
  return `${date} ${time}`;
}

function previousDayKey(key: string) {
  return new Date(Date.parse(`${key}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
}
