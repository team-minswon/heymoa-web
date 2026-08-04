import { describe, expect, it } from "vitest";

import { normalizeReturnTo } from "@/lib/auth/paths";

describe("normalizeReturnTo", () => {
  it("초대 랜딩은 토큰 쿼리를 보존한 채 돌아올 수 있다", () => {
    expect(normalizeReturnTo("/invite?token=abc")).toBe("/invite?token=abc");
  });

  it("허용 목록 밖 경로는 홈으로 떨어진다", () => {
    expect(normalizeReturnTo("/evil")).toBe("/");
  });

  it("절대 URL은 홈으로 떨어진다", () => {
    expect(normalizeReturnTo("https://evil.example/invite")).toBe("/");
  });
});
