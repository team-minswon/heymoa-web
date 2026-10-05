import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMe, logout, LOGOUT_TIMEOUT_MS } from "@/lib/auth/api";
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

  const user = {
    userId: "user",
    name: "사용자",
    email: "user@example.com",
    image: null,
  };
  function session(state: string, currentUser?: unknown) {
    return jsonResponse(200, {
      success: true,
      data: {
        state,
        ...(currentUser === undefined ? {} : { user: currentUser }),
      },
      error: null,
    });
  }

  it("첫 익명 방문은 한 번 읽고 refresh 없이 null을 반환한다", async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(session("anonymous"));
    await expect(getMe()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/auth/session");
    expect(isSessionExpired()).toBe(false);
  });

  it("유효 세션은 추가 갱신 없이 현재 사용자를 반환한다", async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(session("authenticated", user));
    await expect(getMe()).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("만료 access와 refresh 후보는 단일 갱신 뒤 사용자로 복구된다", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(session("refresh_required"))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }))
      .mockResolvedValueOnce(session("authenticated", user));
    await expect(getMe()).resolves.toEqual(user);
    expect(
      fetchMock.mock.calls.map(([url, options]) => [
        String(url).split("/v1")[1],
        options?.method,
      ])
    ).toEqual([
      ["/auth/session", "GET"],
      ["/auth/refresh", "POST"],
      ["/auth/session", "GET"],
    ]);
    expect(
      fetchMock.mock.calls.every(
        ([, options]) => options?.credentials === "include"
      )
    ).toBe(true);
  });

  it("확정된 invalid refresh는 한 번만 시도하고 익명으로 끝난다", async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(session("refresh_required"))
      .mockResolvedValueOnce(
        jsonResponse(401, {
          success: false,
          error: { code: "INVALID_REFRESH_TOKEN", message: "invalid" },
        })
      );
    await expect(getMe()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(isSessionExpired()).toBe(false);
  });

  it("refresh 네트워크 실패는 익명으로 숨기거나 만료 게이트를 열지 않는다", async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(session("refresh_required"))
      .mockRejectedValueOnce(new TypeError("network unavailable"));
    await expect(getMe()).rejects.toMatchObject({ expired: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(isSessionExpired()).toBe(false);
  });

  it("서버 장애는 익명 성공으로 바꾸거나 refresh를 시작하지 않는다", async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(503, { success: false }));
    await expect(getMe()).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([503, 401])(
    "갱신의 %i 오류는 dead-token 근거 없이 세션을 비우지 않는다",
    async (status) => {
      const fetchMock = vi
        .mocked(fetch)
        .mockResolvedValueOnce(session("refresh_required"))
        .mockResolvedValueOnce(
          jsonResponse(status, {
            success: false,
            error: { code: "TEMPORARY_FAILURE", message: "retry later" },
          })
        );
      await expect(getMe()).rejects.toMatchObject({ expired: false });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(isSessionExpired()).toBe(false);
    }
  );

  it("갱신 뒤에도 후보이면 무한 갱신 없이 실패한다", async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(session("refresh_required"))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }))
      .mockResolvedValueOnce(session("refresh_required"));
    await expect(getMe()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    { state: "authenticated" },
    { state: "anonymous", user },
    { state: "unknown" },
    { state: "authenticated", user: { ...user, userId: null } },
  ])(
    "잘못된 세션 응답을 로그인이나 익명 성공으로 받지 않는다: %j",
    async (data) => {
      const fetchMock = vi
        .mocked(fetch)
        .mockResolvedValueOnce(jsonResponse(200, { success: true, data }));
      await expect(getMe()).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );
});

describe("logout", () => {
  beforeEach(() => {
    resetSessionGate();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(["headers", "body"])(
    "%s 대기가 끝나지 않으면 요청을 중단하고 성공으로 처리하지 않는다",
    async (stage) => {
      vi.mocked(fetch).mockImplementationOnce(async (_input, init) => {
        const waiting = () =>
          new Promise<never>((_resolve, reject) => {
            init!.signal!.addEventListener(
              "abort",
              () => reject(init!.signal!.reason),
              { once: true }
            );
          });
        if (stage === "headers") return waiting();
        const response = jsonResponse(200, { success: true, data: null });
        vi.spyOn(response, "json").mockImplementationOnce(waiting);
        return response;
      });
      const assertion = expect(logout()).rejects.toMatchObject({
        name: "TimeoutError",
      });
      await vi.advanceTimersByTimeAsync(LOGOUT_TIMEOUT_MS);
      await assertion;
      expect(isSessionExpired()).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      expect(fetch).toHaveBeenCalledOnce();
    }
  );

  it("쿠키 삭제 응답이 성공하면 게이트를 막고 요청 시한을 해제한다", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await logout();
    expect(isSessionExpired()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/auth/logout"),
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        signal: expect.any(AbortSignal),
      })
    );
  });
});
