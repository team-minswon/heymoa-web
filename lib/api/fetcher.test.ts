import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch, AuthRefreshError, isAuthError } from "@/lib/api/fetcher";
import { resetSessionGate, SessionExpiredError } from "@/lib/auth/session-gate";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 만료 판정은 상태 코드가 아니라 계약 코드로 한다 (APP-347). */
function invalidRefreshTokenResponse() {
  return jsonResponse(401, {
    success: false,
    data: null,
    error: { code: "INVALID_REFRESH_TOKEN", message: "세션이 만료되었습니다." },
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
      .mockResolvedValueOnce(invalidRefreshTokenResponse());

    await expect(apiFetch("/v1/notes")).rejects.toBeInstanceOf(AuthRefreshError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("게이트가 열린 뒤에는 네트워크를 타지 않는다", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false }))
      .mockResolvedValueOnce(invalidRefreshTokenResponse());

    await expect(apiFetch("/v1/notes")).rejects.toBeInstanceOf(AuthRefreshError);
    fetchMock.mockClear();

    await expect(apiFetch("/v1/notes")).rejects.toBeInstanceOf(
      SessionExpiredError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("서버가 만료라고 말하지 않은 4xx에는 게이트를 열지 않는다", async () => {
    // 만료 판정은 계약 코드로만 한다. 상태 코드로 넘겨짚으면 일시 실패에 로그아웃한다.
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false }))
      .mockResolvedValueOnce(
        jsonResponse(400, {
          success: false,
          data: null,
          error: { code: "BAD_REQUEST", message: "잘못된 요청입니다." },
        })
      );

    await expect(apiFetch("/v1/notes")).rejects.toBeInstanceOf(AuthRefreshError);

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { success: true, data: [] })
    );
    await apiFetch("/v1/notes");
    expect(fetchMock).toHaveBeenCalled();
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

  it("SSR에서는 컨테이너 내부 API_BASE_URL을 사용한다", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:18080");
    vi.stubEnv("API_BASE_URL", "http://server:8080");
    vi.stubGlobal("window", undefined);
    vi.resetModules();

    const { buildUrl } = await import("@/lib/api/fetcher");

    expect(buildUrl("/v1/notes")).toBe("http://server:8080/v1/notes");
    vi.unstubAllEnvs();
  });
});

describe("isAuthError", () => {
  it("만료된 갱신 실패와 세션 만료를 참으로 본다", () => {
    expect(isAuthError(new AuthRefreshError(true))).toBe(true);
    expect(isAuthError(new SessionExpiredError())).toBe(true);
  });

  it("네트워크 갱신 실패와 일반 오류는 거짓으로 본다", () => {
    expect(isAuthError(new AuthRefreshError(false))).toBe(false);
    expect(isAuthError(new Error("boom"))).toBe(false);
  });
});

describe("prerender 문서", () => {
  beforeEach(() => {
    resetSessionGate();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, "prerendering");
  });

  // prerender는 폐기될 수 있다. 거기서 회전시키면 새 쿠키를 아무도 못 받는다 (APP-347).
  it("활성화 전에는 갱신 요청을 보내지 않는다", async () => {
    Object.defineProperty(document, "prerendering", {
      value: true,
      configurable: true,
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false })) // 최초 요청
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: null })) // 갱신
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: [] })); // 재시도

    const pending = apiFetch("/v1/notes");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // 401은 이미 돌아왔지만 갱신은 아직 나가지 않았다.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "prerendering", {
      value: false,
      configurable: true,
    });
    document.dispatchEvent(new Event("prerenderingchange"));

    await pending;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
