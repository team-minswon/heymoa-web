import { describe, expect, it } from "vitest";

import { formatAppDate } from "@/lib/format/date";

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
