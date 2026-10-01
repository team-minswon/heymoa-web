import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  ApiError,
  apiFetch,
  AuthRefreshError,
  isAuthError,
} from "@/lib/api/fetcher";
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

// 실패 응답은 상태를 잃지 않고, 봉투가 아니어도 사용자에게 내부 문구를 흘리지 않는다 (APP-783).
describe("apiFetch 실패 응답", () => {
  beforeEach(() => {
    resetSessionGate();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function rejectionOf(response: Response) {
    vi.mocked(fetch).mockResolvedValueOnce(response);
    return apiFetch("/v1/notes").then(
      () => {
        throw new Error("거절돼야 한다");
      },
      (error: unknown) => error
    );
  }

  it("봉투가 있는 409는 상태와 서버 문구를 그대로 싣는다", async () => {
    const error = await rejectionOf(
      jsonResponse(409, {
        success: false,
        data: null,
        error: { code: "LAST_WORKSPACE_ADMIN", message: "관리자가 한 명은 있어야 합니다." },
      })
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    // 호출부 61곳이 쓰는 판정이 그대로 통한다
    expect(errorCodeOf(error)).toBe("LAST_WORKSPACE_ADMIN");
    expect(errorMessageOf(error, "기본")).toBe("관리자가 한 명은 있어야 합니다.");
  });

  it("HTML 502 는 파싱 오류 대신 한국어 문구로 올린다", async () => {
    const error = await rejectionOf(
      new Response("<html><body>502 Bad Gateway</body></html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      })
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    const message = errorMessageOf(error, "기본");
    expect(message).not.toMatch(/Unexpected token|JSON/);
    expect(message).toMatch(/서버/);
  });

  it("본문 없는 429 는 Retry-After 를 ms 로 싣는다", async () => {
    const error = await rejectionOf(
      new Response(null, { status: 429, headers: { "Retry-After": "7" } })
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(429);
    expect((error as ApiError).retryAfterMs).toBe(7_000);
    expect(errorMessageOf(error, "기본")).toMatch(/잠시 후/);
  });

  it("봉투 있는 429 는 서버 문구를 쓰고, Retry-After 가 없으면 기다릴 시간을 모른다고 둔다", async () => {
    const error = await rejectionOf(
      jsonResponse(429, {
        success: false,
        data: null,
        error: {
          code: "INVITATION_RATE_LIMITED",
          message: "지금은 초대를 보낼 수 없습니다. 잠시 후 다시 시도해 주세요.",
        },
      })
    );

    expect(errorCodeOf(error)).toBe("INVITATION_RATE_LIMITED");
    expect((error as ApiError).retryAfterMs).toBeNull();
  });
});
