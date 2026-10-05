import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mockCookies = vi.hoisted(() => ({ getAll: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => mockCookies }));
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.heymoa.test");
  vi.stubEnv("NEXT_PUBLIC_API_MOCKING", "disabled");
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("SSR 쿠키 부재는 읽기를 생략하지만 client 탐침 권위를 만들지 않는다", async () => {
  mockCookies.getAll.mockReturnValue([]);
  const { getCurrentUserForSsr } = await import("./server");
  expect(await getCurrentUserForSsr()).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it("전달된 쿠키로 세션을 읽고 유효 사용자만 hydration에 제공한다", async () => {
  const user = {
    userId: "user",
    name: "사용자",
    email: "user@example.com",
    image: null,
  };
  mockCookies.getAll.mockReturnValue([
    { name: "access_token", value: "fixture" },
  ]);
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      success: true,
      data: { state: "authenticated", user },
      error: null,
    })
  );
  const { getCurrentUserForSsr } = await import("./server");
  expect(await getCurrentUserForSsr()).toEqual(user);
  expect(fetch).toHaveBeenCalledWith(
    "https://api.heymoa.test/v1/auth/session",
    expect.objectContaining({
      method: "GET",
      cache: "no-store",
      headers: { Cookie: "access_token=fixture" },
    })
  );
});

it("SSR 갱신 후보는 POST 없이 클라이언트 탐침으로 넘긴다", async () => {
  mockCookies.getAll.mockReturnValue([
    { name: "refresh_token", value: "fixture" },
  ]);
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      success: true,
      data: { state: "refresh_required" },
      error: null,
    })
  );
  const { getCurrentUserForSsr } = await import("./server");
  expect(await getCurrentUserForSsr()).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe("GET");
});
