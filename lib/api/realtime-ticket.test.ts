import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ticketedSocketUrl } from "@/lib/api/realtime-ticket";
import { isSessionExpired, resetSessionGate } from "@/lib/auth/session-gate";

const URL = "ws://localhost/ws/transcriptions";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ticketResponse = (ticket: string) =>
  jsonResponse(200, {
    success: true,
    data: { ticket, expiresAt: "2026-11-10T00:00:30Z" },
    error: null,
  });

describe("ticketedSocketUrl (APP-1547)", () => {
  beforeEach(() => {
    resetSessionGate();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("★ 부를 때마다 새 티켓을 받아 주소에 붙인다", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(ticketResponse("a.b+c/="))
      .mockResolvedValueOnce(ticketResponse("second"));

    await expect(ticketedSocketUrl(URL, 3_000)).resolves.toBe(
      `${URL}?ticket=a.b%2Bc%2F%3D`
    );
    await expect(ticketedSocketUrl(URL, 3_000)).resolves.toBe(
      `${URL}?ticket=second`
    );
    const [path, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(path)).toContain("/v1/realtime/tickets");
    expect(init?.method).toBe("POST");
  });

  it("★ 401 이면 접근 토큰을 갱신하고 다시 받은 티켓을 붙인다", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { success: false }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }))
      .mockResolvedValueOnce(ticketResponse("fresh"));

    await expect(ticketedSocketUrl(URL, 3_000)).resolves.toBe(
      `${URL}?ticket=fresh`
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain("refresh");
  });

  it("★ 갱신 토큰까지 죽었으면 세션 게이트를 열고 null", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { success: false }))
      .mockResolvedValueOnce(
        jsonResponse(401, {
          success: false,
          data: null,
          error: { code: "INVALID_REFRESH_TOKEN", message: "만료" },
        })
      );

    await expect(ticketedSocketUrl(URL, 3_000)).resolves.toBeNull();
    expect(isSessionExpired()).toBe(true);
  });

  it.each([
    ["5xx", () => Promise.resolve(jsonResponse(503, { success: false }))],
    ["404", () => Promise.resolve(jsonResponse(404, { success: false }))],
    ["망 오류", () => Promise.reject(new TypeError("Failed to fetch"))],
  ])("★ %s 면 티켓 없는 주소로 붙는다 (쿠키 이행 경로)", async (_, respond) => {
    vi.mocked(fetch).mockImplementationOnce(respond);

    await expect(ticketedSocketUrl(URL, 3_000)).resolves.toBe(URL);
    expect(isSessionExpired()).toBe(false);
  });

  it("★ 시한을 넘기면 티켓 없는 주소로 붙는다", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementationOnce(
      (_, init) =>
        new Promise((_, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason)
          )
        )
    );

    const url = ticketedSocketUrl(URL, 3_000);
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(url).resolves.toBe(URL);
  });

  it("★ 401 뒤 갱신이 멈춰도 시한 안에 티켓 없는 주소로 붙는다", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockImplementationOnce(async () => new Response(null, { status: 401 }))
      .mockImplementation(() => new Promise<Response>(() => {}));

    const url = ticketedSocketUrl(URL, 3_000);
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(url).resolves.toBe(URL);
  });
});
