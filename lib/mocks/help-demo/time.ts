import { getAppDateKey } from "@/lib/format/date";

export const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export function appDayMs(daysAgo: number): number {
  return Date.parse(`${getAppDateKey(new Date())}T00:00:00Z`) - daysAgo * DAY_MS;
}

export function atHour(daysAgo: number, hour: number, minute = 0): number {
  return appDayMs(daysAgo) + (hour - 9) * HOUR_MS + minute * 60_000;
}

