import { describe, expect, it } from "vitest";

import { dividerLabel, threadDividers } from "@/lib/chat/time-divider";

const TZ = "UTC";
const NOW = new Date("2026-08-25T12:00:00Z");

describe("구분선은 날짜가 바뀔 때만 선다", () => {
  it("첫 메시지에는 언제나 선다 — 앞이 없으므로 바뀐 것이다", () => {
    expect(threadDividers(["2026-08-25T01:00:00Z"], TZ)).toEqual([true]);
  });

  // 그 30분은 잰 값이 아니라 감이었다
  it("같은 날 안에서는 몇 시간을 비워도 안 선다", () => {
    expect(
      threadDividers(["2026-08-25T01:00:00Z", "2026-08-25T09:00:00Z"], TZ)
    ).toEqual([true, false]);
  });

  it("날이 바뀌면 선다", () => {
    expect(
      threadDividers(["2026-08-24T23:00:00Z", "2026-08-25T01:00:00Z"], TZ)
    ).toEqual([true, true]);
  });

  // UTC로 자르면 자정 근처 대화가 하루 밀린다
  it("보는 사람의 시간대로 자른다", () => {
    // 서울에서는 08-24 23:00 과 08-25 01:00 — 날이 갈린다. UTC 로는 둘 다 08-24 다.
    const times = ["2026-08-24T14:00:00Z", "2026-08-24T16:00:00Z"];
    expect(threadDividers(times, "UTC")).toEqual([true, false]);
    expect(threadDividers(times, "Asia/Seoul")).toEqual([true, true]);
  });

  it("빈 목록은 빈 배열이다", () => {
    expect(threadDividers([], TZ)).toEqual([]);
  });
});

describe("구분선 라벨", () => {
  it("오늘과 어제는 이 화면의 말이다", () => {
    expect(dividerLabel("2026-08-25T01:00:00Z", NOW, "ko", TZ)).toMatch(/^오늘 /);
    expect(dividerLabel("2026-08-24T01:00:00Z", NOW, "ko", TZ)).toMatch(/^어제 /);
  });

  it("그 이전은 날짜로 적는다", () => {
    const label = dividerLabel("2026-08-20T01:00:00Z", NOW, "ko", TZ);
    expect(label).not.toMatch(/^오늘|^어제/);
    expect(label).toContain("20");
  });

  // 「1월 3일」만 있으면 올해인지 재작년인지 알 수 없다
  it("해가 바뀌면 연도를 함께 적는다", () => {
    expect(dividerLabel("2025-01-03T01:00:00Z", NOW, "ko", TZ)).toContain("2025");
    expect(dividerLabel("2026-01-03T01:00:00Z", NOW, "ko", TZ)).not.toContain("2026년");
  });
});
