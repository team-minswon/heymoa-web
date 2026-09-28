import { formatViewerDate, viewerDateKey } from "@/lib/format/date";

/**
 * 메시지마다 그 앞에 구분선을 세울지. 기준은 날짜가 바뀌었나 하나이고 첫 메시지도 여기
 * 걸린다. 날짜는 보는 사람의 시간대로 자른다 — UTC 로 자르면 자정 근처 대화가 하루 밀린다.
 */
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

/**
 * 「오늘 오후 3:40」·「어제 오후 6:16」, 그 이전은 날짜로. 해가 바뀌면 연도를 붙인다.
 * 숫자와 월 이름은 `Intl` 이 낸다.
 */
export function dividerLabel(
  at: string,
  now: Date,
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

  if (day === today) return `오늘 ${time}`;
  if (day === previousDayKey(today)) return `어제 ${time}`;

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

/** `2026-08-24`의 전날. 날짜만 있는 값이라 UTC 자정 위에서 계산해도 DST에 안 흔들린다. */
function previousDayKey(key: string) {
  return new Date(Date.parse(`${key}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
}
