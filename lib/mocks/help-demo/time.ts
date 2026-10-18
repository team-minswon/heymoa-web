import { getAppDateKey } from "@/lib/format/date";

export const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** 앱 타임존(KST) 기준 `daysAgo` 일 전 날짜의 자정을 UTC 자정으로 옮긴 값. 날짜 키만 맞으면 되는 계산에 쓴다. */
export function appDayMs(daysAgo: number): number {
  return Date.parse(`${getAppDateKey(new Date())}T00:00:00Z`) - daysAgo * DAY_MS;
}

/** 앱 타임존 `daysAgo` 일 전 `hour` 시의 실제 시각(밀리초). KST 는 UTC+9 다. */
export function atHour(daysAgo: number, hour: number, minute = 0): number {
  return appDayMs(daysAgo) + (hour - 9) * HOUR_MS + minute * 60_000;
}

/** 회의 날짜 기준 `dueIn` 일 뒤의 날짜(`YYYY-MM-DD`). 검토본의 기한은 회의 날짜에서 센다. */
export function dueAfter(daysAgo: number, dueIn: number): string {
  return new Date(appDayMs(daysAgo) + dueIn * DAY_MS).toISOString().slice(0, 10);
}
