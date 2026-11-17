import { describe, expect, it } from "vitest";

import { dividerLabel, threadDividers } from "@/lib/chat/time-divider";
import { testDatesT } from "@/components/help/test-intl";

const tKo = testDatesT();
const tEn = testDatesT("en");

const TZ = "UTC";
const NOW = new Date("2026-08-25T12:00:00Z");

describe("구분선은 날짜가 바뀔 때만 선다", () => {
  it("첫 메시지에는 언제나 선다 — 앞이 없으므로 바뀐 것이다", () => {
    expect(threadDividers(["2026-08-25T01:00:00Z"], TZ)).toEqual([true]);
  });

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

  it("보는 사람의 시간대로 자른다", () => {
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
    expect(dividerLabel("2026-08-25T01:00:00Z", NOW, tKo, "ko", TZ)).toMatch(
      /^오늘 /
    );
    expect(dividerLabel("2026-08-24T01:00:00Z", NOW, tKo, "ko", TZ)).toMatch(
      /^어제 /
    );
  });

  it("그 이전은 날짜로 적는다", () => {
    const label = dividerLabel("2026-08-20T01:00:00Z", NOW, tKo, "ko", TZ);
    expect(label).not.toMatch(/^오늘|^어제/);
    expect(label).toContain("20");
  });

  it("해가 바뀌면 연도를 함께 적는다", () => {
    expect(dividerLabel("2025-01-03T01:00:00Z", NOW, tKo, "ko", TZ)).toContain(
      "2025"
    );
    expect(
      dividerLabel("2026-01-03T01:00:00Z", NOW, tKo, "ko", TZ)
    ).not.toContain("2026년");
  });
});

describe("앱 언어로 적는다", () => {
  const NOW_EN = new Date("2026-08-25T12:00:00Z");
  it("영어 화면에서는 Today·Yesterday 다", () => {
    expect(
      dividerLabel("2026-08-25T01:00:00Z", NOW_EN, tEn, "en", "UTC")
    ).toMatch(/^Today /);
    expect(
      dividerLabel("2026-08-24T01:00:00Z", NOW_EN, tEn, "en", "UTC")
    ).toMatch(/^Yesterday /);
  });
});
