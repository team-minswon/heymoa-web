import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/lib/format/relative-time";

// 고정 기준 시각. 결정적이라 테스트가 흔들리지 않는다.
const NOW = Date.parse("2026-07-24T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  it.each([
    [ago(10_000), "방금"],
    [ago(30 * MIN), "30분 전"],
    [ago(3 * HOUR), "3시간 전"],
    [ago(1 * DAY), "어제"],
    [ago(3 * DAY), "3일 전"],
    [ago(9 * DAY), "지난주"],
    [ago(20 * DAY), "2주 전"],
    [ago(45 * DAY), "1개월 전"],
    [ago(400 * DAY), "1년 전"],
  ])("formats %s as %s", (iso, expected) => {
    expect(formatRelativeTime(iso, NOW)).toBe(expected);
  });

  it("treats future/skewed timestamps as 방금 (no negative)", () => {
    expect(formatRelativeTime(ago(-5_000), NOW)).toBe("방금");
  });
});
