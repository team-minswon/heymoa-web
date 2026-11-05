import { describe, expect, it } from "vitest";

import {
  formatAppDate,
  formatPromiseTime,
  getAppDateKey,
} from "@/lib/format/date";

describe("formatAppDate", () => {
  // Node 22·24 의 ICU 78 은 ko-KR 오전·오후를 「AM」「PM」으로 내고 브라우저는 「오전」「오후」를
  // 낸다. 서버 HTML 과 첫 클라이언트 렌더가 갈려 노트 화면이 React #418 을 던졌다.
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
    expect(formatPromiseTime("2026-10-23T07:20:00Z")).toBe(
      "10월 23일(금) 오후 4시 20분"
    );
    expect(formatPromiseTime("2026-10-26T01:00:00Z")).toBe(
      "10월 26일(월) 오전 10시"
    );
  });
});

describe("영어 화면의 날짜 (APP-1285)", () => {
  // 서울 2026-10-31 23:30 = UTC 14:30. 보는 사람이 어디 있든 서울 날짜로 그린다.
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
    ).toBe("11:30\u202fPM");
    expect(getAppDateKey(lateNightSeoul)).toBe("2026-10-31");
  });

  it("한국어 화면은 지금처럼 오전·오후로 쓴다", () => {
    expect(
      formatAppDate(lateNightSeoul, { hour: "numeric", minute: "2-digit" })
    ).toContain("오후");
  });
});
