import { describe, expect, it } from "vitest";

import { testDatesT } from "@/components/help/test-intl";
import {
  formatAppDate,
  formatPromiseTime,
  getAppDateKey,
} from "@/lib/format/date";

describe("formatAppDate", () => {
  it("오전·오후는 런타임 ICU 와 상관없이 한국어로 쓴다", () => {
    expect(
      formatAppDate("2026-09-26T07:25:20Z", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    ).toBe("2026. 9. 26. 오후 4:25");
    expect(
      formatAppDate("2026-07-30T00:00:00Z", {
        dateStyle: "long",
        timeStyle: "short",
      })
    ).toBe("2026년 7월 30일 오전 9:00");
  });
});

describe("formatPromiseTime", () => {
  it("메일과 같은 꼴로 서울 시각을 적는다", () => {
    expect(
      formatPromiseTime("2026-10-23T07:20:00Z", "ko-KR", testDatesT())
    ).toBe("10월 23일(금) 오후 4시 20분");
    expect(
      formatPromiseTime("2026-10-26T01:00:00Z", "ko-KR", testDatesT())
    ).toBe("10월 26일(월) 오전 10시");
  });

  it("영어 화면은 영어 어순이고 시각은 서울 기준 그대로다", () => {
    const t = testDatesT("en");
    expect(formatPromiseTime("2026-10-23T07:20:00Z", "en-US", t)).toBe(
      "Fri, Oct 23 at 4:20 PM"
    );
    expect(formatPromiseTime("2026-10-26T01:05:00Z", "en-US", t)).toBe(
      "Mon, Oct 26 at 10:05 AM"
    );
    expect(formatPromiseTime("2026-10-26T01:00:00Z", "en-US", t)).toBe(
      "Mon, Oct 26 at 10 AM"
    );
  });
});

describe("영어 화면의 날짜 (APP-1285)", () => {
  const lateNightSeoul = "2026-10-31T14:30:00Z";

  it("en-US 형식으로 쓰되 날짜 경계는 서울 기준 그대로다", () => {
    expect(
      formatAppDate(lateNightSeoul, { month: "long", day: "numeric" }, "en-US")
    ).toBe("October 31");
    expect(
      formatAppDate(
        lateNightSeoul,
        { hour: "numeric", minute: "2-digit" },
        "en-US"
      )
    ).toBe("11:30 PM");
    expect(getAppDateKey(lateNightSeoul)).toBe("2026-10-31");
  });

  it("한국어 화면은 지금처럼 오전·오후로 쓴다", () => {
    expect(
      formatAppDate(lateNightSeoul, { hour: "numeric", minute: "2-digit" })
    ).toContain("오후");
  });
});
