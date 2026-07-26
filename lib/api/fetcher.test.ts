import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch, AuthRefreshError, isAuthError } from "@/lib/api/fetcher";
import { resetSessionGate, SessionExpiredError } from "@/lib/auth/session-gate";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiFetch", () => {
  beforeEach(() => {
    resetSessionGate();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("갱신이 만료로 실패하면 게이트를 열고 AuthRefreshError를 올린다", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false }))
      .mockResolvedValueOnce(jsonResponse(400, { success: false }));

    await expect(apiFetch("/v1/notes")).rejects.toBeInstanceOf(AuthRefreshError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("게이트가 열린 뒤에는 네트워크를 타지 않는다", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false }))
      .mockResolvedValueOnce(jsonResponse(400, { success: false }));

    await expect(apiFetch("/v1/notes")).rejects.toBeInstanceOf(AuthRefreshError);
    fetchMock.mockClear();

    await expect(apiFetch("/v1/notes")).rejects.toBeInstanceOf(
      SessionExpiredError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("네트워크 오류로 갱신이 실패하면 게이트를 열지 않는다", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(apiFetch("/v1/notes")).rejects.toBeInstanceOf(AuthRefreshError);

    // 게이트가 안 열렸으므로 다음 요청은 다시 네트워크를 탄다.
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { success: true, data: [] })
    );
    await apiFetch("/v1/notes");
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe("isAuthError", () => {
  it("만료된 갱신 실패와 세션 만료를 참으로 본다", () => {
    expect(isAuthError(new AuthRefreshError(400))).toBe(true);
    expect(isAuthError(new SessionExpiredError())).toBe(true);
  });

  it("네트워크 갱신 실패와 일반 오류는 거짓으로 본다", () => {
    expect(isAuthError(new AuthRefreshError(null))).toBe(false);
    expect(isAuthError(new Error("boom"))).toBe(false);
  });
});
