import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from "@/lib/auth/cookies";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

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

    // If refresh fails, clear auth cookies to prevent loops
    if (!refreshResponse.ok) {
      const response = NextResponse.next();
      response.cookies.delete(ACCESS_TOKEN_COOKIE_NAME);
      response.cookies.delete(REFRESH_TOKEN_COOKIE_NAME);
      return response;
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
    // On network failure, clear cookies or proceed silently
    const response = NextResponse.next();
    response.cookies.delete(ACCESS_TOKEN_COOKIE_NAME);
    response.cookies.delete(REFRESH_TOKEN_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|webmanifest)$).*)",
  ],
};
