import type { DatesT } from "@/lib/i18n/translator";

export const APP_TIME_ZONE = "Asia/Seoul";

export function getAppDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${byType.year}-${byType.month}-${byType.day}`;
}

// 보는 사람의 시간대·로케일로 포맷합니다. SSR 을 지나는 자리에 쓰면 hydration 이 갈리므로 서버를 안 지나는 표면에서만 씁니다.
export function formatViewerDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions,
  locale?: string
) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function viewerDateKey(value: string | Date, timeZone?: string) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// ICU 78(Node 22·24)은 ko 의 오전·오후를 AM·PM 으로 내고 브라우저는 오전·오후를 내서 hydration 이 갈립니다(React #418).
const KO_DAY_PERIOD: Record<string, string> = { AM: "오전", PM: "오후" };

export function formatAppDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions,
  locale = "ko-KR"
) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).formatToParts(date);
  const korean = locale.startsWith("ko");

  return (
    parts
      .map((part) =>
        korean && part.type === "dayPeriod"
          ? (KO_DAY_PERIOD[part.value] ?? part.value)
          : part.value
      )
      .join("")
      // Node \uc758 ICU \ub294 en \uc758 \u300c9:00 AM\u300d \uc0ac\uc774\uc5d0 \uc881\uc740 \uacf5\ubc31(U+202F)\uc744 \ub123\uace0 \ube0c\ub77c\uc6b0\uc800\ub294 \ubcf4\ud1b5 \uacf5\ubc31\uc744 \ub123\uc2b5\ub2c8\ub2e4. \uac19\uc740 \uc774\uc720\ub85c \ub9de\ucda5\ub2c8\ub2e4
      .replace(/\u202f/g, " ")
  );
}

export function formatAppClock(value: string | Date) {
  return formatAppDate(value, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export function formatDueDate(value: string, locale?: string) {
  return formatAppDate(
    `${value}T00:00:00+09:00`,
    { month: "long", day: "numeric", weekday: "short" },
    locale
  );
}

export function formatPromiseTime(
  value: string | Date,
  locale: string,
  t: DatesT
) {
  const date = typeof value === "string" ? new Date(value) : value;
  const korean = locale.startsWith("ko");
  const part = Object.fromEntries(
    new Intl.DateTimeFormat(locale, {
      timeZone: APP_TIME_ZONE,
      month: korean ? "numeric" : "short",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    })
      .formatToParts(date)
      .map((item) => [item.type, item.value])
  );
  const minute = Number(part.minute);
  return t("promiseTime", {
    month: part.month,
    day: part.day,
    weekday: part.weekday,
    period: korean
      ? (KO_DAY_PERIOD[part.dayPeriod] ?? part.dayPeriod)
      : part.dayPeriod,
    hour: part.hour,
    minute,
    minutePadded: String(minute).padStart(2, "0"),
  });
}
