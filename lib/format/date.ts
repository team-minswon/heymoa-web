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

export function formatAppDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions,
  locale = "ko-KR"
) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(date);
}
