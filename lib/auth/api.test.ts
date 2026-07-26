import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMe } from "@/lib/auth/api";
import { isSessionExpired, resetSessionGate } from "@/lib/auth/session-gate";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("getMe", () => {
  beforeEach(() => {
    resetSessionGate();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // 비로그인 방문자가 홈에 처음 와도 AuthProvider가 getMe()를 부른다. 그 401을 만료로
  // 보면 로그인한 적 없는 사람에게 "세션이 만료되었습니다" 토스트가 뜬다.
  it("익명 방문자의 401은 만료가 아니다 — 게이트를 열지 않는다", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false }))
      .mockResolvedValueOnce(jsonResponse(400, { success: false }));

    await expect(getMe()).rejects.toThrow();
    expect(isSessionExpired()).toBe(false);
  });
});
