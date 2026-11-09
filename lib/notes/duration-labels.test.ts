import { describe, expect, it } from "vitest";
import { testAppT } from "@/components/help/test-intl";
import { speakingTimeParts } from "@/lib/notes/speaker-stats";
import { durationLabel } from "@/lib/notes/minutes/model";

describe.each(["ko", "en"] as const)("%s 시간·분 단위", (locale) => {
  const t = testAppT(locale);
  it.each([
    [0, "0초", "0s"],
    [59, "59초", "59s"],
    [60, "1분", "1m"],
    [3600, "1시간", "1h"],
    [4680, "1시간 18분", "1h 18min"],
    [4685, "1시간 18분 5초", "1h 18min 5s"],
    [7201, "2시간 1초", "2h 1s"],
  ])("%d초 발언 시간", (seconds, ko, en) => {
    expect(
      t("notes.speakers.speakingTime", speakingTimeParts(seconds * 1000))
    ).toBe(locale === "ko" ? ko : en);
  });
  it("분석 소요 시간과 회의록 문서도 같은 시간·분을 쓴다", () => {
    const expected = locale === "ko" ? "1시간 18분" : "1h 18min";
    expect(
      t("chat.thought.duration.hours", { hours: 1, minutes: 18, seconds: 0 })
    ).toBe(expected);
    expect(
      durationLabel(78 * 60_000, {
        t,
        locale: locale === "ko" ? "ko-KR" : "en-US",
      })
    ).toBe(expected);
  });
});
