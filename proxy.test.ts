import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
});
