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
  // 응답이 버려질 수 있는 요청은 토큰을 회전시키면 안 된다. 회전만 되고 새 쿠키는 못
  // 받으면, 그 뒤 진짜 내비게이션이 이미 죽은 토큰으로 온다 (APP-286 → APP-347).
  it.each([
    { "next-router-prefetch": "1" },
    { "next-router-segment-prefetch": "/_tree" },
    { "next-instant-navigation-testing-prefetch": "1" },
    { purpose: "prefetch" },
    // 브라우저가 보낸다. Chrome은 주소창 자동완성만으로도 페이지를 미리 렌더한다.
    { "sec-purpose": "prefetch" },
    { "sec-purpose": "prefetch;prerender" },
  ])("skips speculative requests: %o", (headers) => {
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

/** 리프레시 토큰이 죽었다고 서버가 **명시**한 응답. 이때만 쿠키를 지운다. */
function invalidRefreshTokenResponse() {
  return new Response(
    JSON.stringify({
      success: false,
      data: null,
      error: { code: "INVALID_REFRESH_TOKEN", message: "세션이 만료되었습니다." },
    }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
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

  // 서버가 "이 토큰은 죽었다"고 말하지 않은 4xx다. 회전 경쟁 자체는 서버의 유예가 200으로
  // 흡수하므로 여기 오지 않지만, 그 밖의 4xx에 쿠키를 지우면 멀쩡한 세션이 날아간다.
  it("keeps refresh cookies when a 4xx is not INVALID_REFRESH_TOKEN", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: "BAD_REQUEST", message: "잘못된 요청입니다." },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    );
    const proxy = await loadProxy();

    const response = await proxy(requestWithRefreshToken());

    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("keeps refresh cookies when a failure has no contract envelope", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 400 }));
    const proxy = await loadProxy();

    const response = await proxy(requestWithRefreshToken());

    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("clears auth cookies when the server says the refresh token is dead", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(invalidRefreshTokenResponse());
    const proxy = await loadProxy();

    const response = await proxy(requestWithRefreshToken());
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(setCookie).toContain("access_token=");
    expect(setCookie).toContain("refresh_token=");
  });

  // 서버가 심은 쿠키와 (name, domain, path)가 같아야 지워진다. Domain이 빠지면 host-only
  // 쿠키만 지우고 도메인 쿠키는 남아, 무효해진 refresh token으로 재발급을 무한히 재시도한다.
  it("deletes auth cookies with the domain the server set them on", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(invalidRefreshTokenResponse());
    const proxy = await loadProxy();

    const response = await proxy(requestWithRefreshToken());
    const setCookies = response.headers.getSetCookie();

    expect(setCookies).toHaveLength(2);
    setCookies.forEach((setCookie) => {
      expect(setCookie).toContain("Domain=.heymoa.app");
      expect(setCookie).toContain("Path=/");
    });
  });

  it("forwards the server's Set-Cookie verbatim and exposes it to SSR", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: {
          "set-cookie":
            "access_token=new-access; Path=/; Domain=.heymoa.app; HttpOnly; Secure; SameSite=Lax",
        },
      })
    );
    const proxy = await loadProxy();
    const request = requestWithRefreshToken();

    const response = await proxy(request);

    // 브라우저로는 서버가 준 줄이 그대로 나간다 — web이 속성을 다시 만들지 않는다.
    expect(response.headers.getSetCookie()).toEqual([
      "access_token=new-access; Path=/; Domain=.heymoa.app; HttpOnly; Secure; SameSite=Lax",
    ]);
    // 같은 요청의 SSR(`cookies()`)도 새 토큰을 본다. **cookie 헤더까지 봐야 한다** —
    // Next가 SSR로 넘기는 것은 헤더이지 NextRequest의 쿠키 스토어가 아니다.
    expect(request.cookies.get("access_token")?.value).toBe("new-access");
    expect(request.headers.get("cookie")).toContain("access_token=new-access");
  });
});
