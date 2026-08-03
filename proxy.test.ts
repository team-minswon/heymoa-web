import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config } from "@/proxy";

function requestWithRefreshToken() {
  return new NextRequest("http://web.example.test/w/01K0000000000", {
    headers: { cookie: "refresh_token=refresh-value" },
  });
}

async function loadProxy() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://api.example.test");
  return (await import("@/proxy")).proxy;
}

describe("proxy matcher", () => {
  it.each([
    { "next-router-prefetch": "1" },
    { purpose: "prefetch" },
  ])("skips Next.js prefetch headers: %o", (headers) => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: "/w/01K0000000000",
        headers,
      })
    ).toBe(false);
  });

  it("keeps normal document requests matched", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: "/w/01K0000000000",
      })
    ).toBe(true);
  });
});

describe("proxy token refresh", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("keeps refresh cookies during a transient API outage", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));
    const proxy = await loadProxy();

    const response = await proxy(requestWithRefreshToken());

    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("keeps refresh cookies when the API returns a server error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }));
    const proxy = await loadProxy();

    const response = await proxy(requestWithRefreshToken());

    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("clears auth cookies when the refresh token is invalid", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 400 }));
    const proxy = await loadProxy();

    const response = await proxy(requestWithRefreshToken());
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(setCookie).toContain("access_token=");
    expect(setCookie).toContain("refresh_token=");
  });

  // 서버가 심은 쿠키와 (name, domain, path)가 같아야 지워진다. Domain이 빠지면 host-only
  // 쿠키만 지우고 도메인 쿠키는 남아, 무효해진 refresh token으로 재발급을 무한히 재시도한다.
  it("deletes auth cookies with the domain the server set them on", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 400 }));
    const proxy = await loadProxy();

    const response = await proxy(requestWithRefreshToken());
    const setCookies = response.headers.getSetCookie();

    expect(setCookies).toHaveLength(2);
    setCookies.forEach((setCookie) => {
      expect(setCookie).toContain("Domain=.heymoa.app");
      expect(setCookie).toContain("Path=/");
    });
  });
});
