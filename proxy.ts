import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from "@/lib/auth/cookies";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/**
 * 서버가 인증 쿠키를 심을 때 쓰는 Domain. **원본은 heymoa-server의
 * `application-prod.yml`(`auth.*.cookie.domain`)이고, 거기가 바뀌면 여기도 고쳐야 한다.**
 *
 * **지울 때 이 값을 빼면 안 지워진다.** RFC 6265에서 쿠키는 `(name, domain, path)`로
 * 구분되므로, Domain 없는 Set-Cookie는 `heymoa.app` host-only 쿠키를 지울 뿐
 * `.heymoa.app` 도메인 쿠키는 그대로 남는다. 그러면 무효해진 refresh token이 브라우저에
 * 영구히 박혀 모든 내비게이션이 재발급을 다시 시도한다 (APP-344, 재발급 실패율 74%).
 *
 * 로컬 서버는 쿠키를 host-only로 심으므로 이 Domain이 안 맞아 삭제가 무시된다. 로컬
 * 기본값은 MSW(`.env.local`의 `NEXT_PUBLIC_API_MOCKING=enabled`)라 proxy가 아래에서
 * 곧바로 반환하고 이 경로를 지나지 않는다. 실서버를 로컬로 붙여 쓰다가 만료된 쿠키가
 * 안 지워지면 그때 환경별로 가른다.
 */
const AUTH_COOKIE_DOMAIN = ".heymoa.app";

function getSetCookieHeaders(headers: Headers) {
  const headersWithGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (headersWithGetSetCookie.getSetCookie) {
    return headersWithGetSetCookie.getSetCookie();
  }

  const setCookie = headers.get("set-cookie");

  if (!setCookie) {
    return [];
  }

  return setCookie.split(
    new RegExp(
      `,(?=\\s*(?:${ACCESS_TOKEN_COOKIE_NAME}|${REFRESH_TOKEN_COOKIE_NAME})=)`
    )
  );
}

function getCookiePairFromSetCookie(setCookie: string) {
  return setCookie.split(";", 1)[0]?.trim();
}

function mergeCookieHeader(cookieHeader: string, setCookieHeaders: string[]) {
  const cookies = new Map<string, string>();

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");

    if (name) {
      cookies.set(name, valueParts.join("="));
    }
  });

  setCookieHeaders.forEach((setCookie) => {
    const cookiePair = getCookiePairFromSetCookie(setCookie);

    if (!cookiePair) {
      return;
    }

    const [name, ...valueParts] = cookiePair.split("=");

    if (
      name === ACCESS_TOKEN_COOKIE_NAME ||
      name === REFRESH_TOKEN_COOKIE_NAME
    ) {
      cookies.set(name, valueParts.join("="));
    }
  });

  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
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

function clearAuthCookies() {
  const response = NextResponse.next();

  [ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME].forEach((name) => {
    response.cookies.delete({ name, domain: AUTH_COOKIE_DOMAIN, path: "/" });
  });

  return response;
}

export async function proxy(request: NextRequest) {
  // Skip during mocking or if no refresh is needed
  if (
    process.env.NEXT_PUBLIC_API_MOCKING === "enabled" ||
    !shouldRefreshBeforeSsr(request)
  ) {
    return NextResponse.next();
  }

  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return NextResponse.next();
  }

  try {
    const refreshResponse = await fetch(
      new URL("/v1/auth/refresh", apiBaseUrl),
      {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
        },
        cache: "no-store",
      }
    );

    if (!refreshResponse.ok) {
      const tokenIsInvalid =
        refreshResponse.status === 400 || refreshResponse.status === 401;
      return tokenIsInvalid ? clearAuthCookies() : NextResponse.next();
    }

    const setCookieHeaders = getSetCookieHeaders(refreshResponse.headers);

    if (setCookieHeaders.length === 0) {
      return NextResponse.next();
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(
      "cookie",
      mergeCookieHeader(cookieHeader, setCookieHeaders)
    );

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    setCookieHeaders.forEach((setCookie) => {
      response.headers.append("set-cookie", setCookie);
    });

    return response;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|webmanifest)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
