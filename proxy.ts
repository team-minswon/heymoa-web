import { NextRequest, NextResponse } from "next/server";

import {
  ACCESS_TOKEN_COOKIE_NAME,
  AUTH_COOKIE_DOMAIN,
  AUTH_COOKIE_NAMES,
  isAuthCookieName,
  REFRESH_TOKEN_COOKIE_NAME,
} from "@/lib/auth/cookies";
import { fetchWithRefreshTimeout } from "@/lib/api/refresh-timeout";
import { isRefreshTokenDead } from "@/lib/auth/refresh-failure";
import {
  cardEntryCsp,
  cardEntryFrameAncestors,
} from "@/lib/billing/card-entry-csp";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function parseAuthCookie(setCookie: string) {
  const [name, ...valueParts] = setCookie.split(";", 1)[0].trim().split("=");

  if (!name || !isAuthCookieName(name)) {
    return null;
  }

  return { name, value: valueParts.join("=") };
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );

  return atob(padded);
}

function isJwtExpired(token: string, skewSeconds = 30) {
  try {
    const [, payload] = token.split(".");

    if (!payload) {
      return true;
    }

    const decoded = JSON.parse(decodeBase64Url(payload)) as { exp?: unknown };

    if (typeof decoded.exp !== "number") {
      return true;
    }

    return decoded.exp <= Math.floor(Date.now() / 1000) + skewSeconds;
  } catch {
    return true;
  }
}

function shouldRefreshBeforeSsr(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;

  if (!apiBaseUrl || !refreshToken) {
    return false;
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;

  return !accessToken || isJwtExpired(accessToken);
}

function clearAuthCookies(request: NextRequest) {
  AUTH_COOKIE_NAMES.forEach((name) => request.cookies.delete(name));
  const response = NextResponse.next({ request });

  AUTH_COOKIE_NAMES.forEach((name) => {
    response.cookies.delete({
      name,
      domain: AUTH_COOKIE_DOMAIN || undefined,
      path: "/",
    });
  });

  return response;
}

/**
 * 카드를 받는 두 면에만 CSP 를 겁니다. Next 16 은 요청 헤더에도 nonce 를 실어야 프레임워크 스크립트에 붙입니다.
 */
export async function proxy(request: NextRequest) {
  const frameAncestors = cardEntryFrameAncestors(request.nextUrl.pathname);
  if (!frameAncestors) return refreshForSsr(request);
  const csp = cardEntryCsp({
    nonce: Buffer.from(crypto.randomUUID()).toString("base64"),
    apiBaseUrl,
    dev: process.env.NODE_ENV === "development",
    frameAncestors,
  });
  const headers = new Headers(request.headers);
  headers.set("content-security-policy", csp);
  const response = await refreshForSsr(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

async function refreshForSsr(request: NextRequest) {
  if (
    process.env.NEXT_PUBLIC_API_MOCKING === "enabled" ||
    !shouldRefreshBeforeSsr(request)
  ) {
    return NextResponse.next({ request });
  }

  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return NextResponse.next({ request });
  }

  let refreshResponse: Response;

  try {
    refreshResponse = await fetchWithRefreshTimeout(
      new URL("/v1/auth/refresh", apiBaseUrl),
      {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
        },
        cache: "no-store",
      }
    );
  } catch {
    return NextResponse.next({ request });
  }

  if (!refreshResponse.ok) {
    // 상태 코드만 보고 쿠키를 지우지 않습니다. 회전 경쟁에서 진 요청까지 지우면 이긴 쪽이 막 심은 쿠키가 날아갑니다.
    return (await isRefreshTokenDead(refreshResponse))
      ? clearAuthCookies(request)
      : NextResponse.next({ request });
  }

  const setCookieHeaders = refreshResponse.headers.getSetCookie();
  const authCookies = setCookieHeaders
    .map(parseAuthCookie)
    .filter((cookie) => cookie !== null);

  if (authCookies.length === 0) {
    return NextResponse.next({ request });
  }

  // 이번 요청의 SSR 이 새 토큰을 보게 하는 Next 16 proxy 패턴입니다(`request.cookies.set` → `NextResponse.next({ request })`).
  authCookies.forEach(({ name, value }) => request.cookies.set(name, value));

  const response = NextResponse.next({ request });

  // 서버가 준 `Set-Cookie` 를 그대로 넘깁니다. web 이 속성을 다시 만들면 서버와 두 벌이 갈라집니다.
  setCookieHeaders.forEach((setCookie) => {
    response.headers.append("set-cookie", setCookie);
  });

  return response;
}

/**
 * 투기적 요청(prefetch·prerender)에서는 proxy 가 돌지 않습니다. 버려질 수 있는 응답에서 토큰을 돌리면 새 쿠키는 못 닿고
 * 옛 토큰만 죽습니다. `sec-purpose` 는 브라우저가 보내 앱이 끌 수 없어 키 유무만 봅니다.
 * 마케팅 면과 정적 자산도 뺍니다. 목록은 `lib/i18n/marketing-routes.ts` 의 `MARKETING_PAGES` 와 같아야 합니다(`proxy.test.ts`).
 * Next 가 `config` 를 정적으로 읽어 목록을 상수로 빼면 빌드가 깨집니다.
 */
export const config = {
  matcher: [
    {
      source:
        "/((?!$|(?:en|pricing|help|download|terms|privacy)(?:/|$)|_next/static|_next/image|favicon.ico|.*opengraph-image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|json|webmanifest|woff2|ttf|mp4|webm)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
        { type: "header", key: "next-instant-navigation-testing-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        { type: "header", key: "sec-purpose" },
      ],
    },
  ],
};
