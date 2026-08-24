import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_TOKEN_COOKIE_NAME,
  AUTH_COOKIE_DOMAIN,
  AUTH_COOKIE_NAMES,
  isAuthCookieName,
  REFRESH_TOKEN_COOKIE_NAME,
} from "@/lib/auth/cookies";
import { isRefreshTokenDead } from "@/lib/auth/refresh-failure";
import { serverApiBaseUrl } from "@/lib/api/server-base-url";

// 브라우저가 부를 주소와 다를 수 있다 — `lib/api/server-base-url.ts` 주석 참조.
const apiBaseUrl = serverApiBaseUrl();

/** `Set-Cookie` 한 줄에서 이름과 값만 뽑는다. 속성은 서버 것을 그대로 흘려보낸다. */
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

function clearAuthCookies() {
  const response = NextResponse.next();

  AUTH_COOKIE_NAMES.forEach((name) => {
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

  let refreshResponse: Response;

  try {
    refreshResponse = await fetch(new URL("/v1/auth/refresh", apiBaseUrl), {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
      },
      cache: "no-store",
    });
  } catch {
    // 네트워크 실패는 일시적이다. 쿠키를 건드리지 않고 다음 요청에 맡긴다.
    return NextResponse.next();
  }

  if (!refreshResponse.ok) {
    // **상태 코드만 보고 지우지 않는다.** 서버가 INVALID_REFRESH_TOKEN이라고 말할 때만
    // 지운다. 회전 경쟁에서 진 요청은 정상 동작이고, 그때 지우면 경쟁에서 이긴 쪽이 방금
    // 심은 유효한 리프레시 쿠키까지 날아가 로그인이 풀린다 (APP-347).
    return (await isRefreshTokenDead(refreshResponse))
      ? clearAuthCookies()
      : NextResponse.next();
  }

  const setCookieHeaders = refreshResponse.headers.getSetCookie();
  const authCookies = setCookieHeaders
    .map(parseAuthCookie)
    .filter((cookie) => cookie !== null);

  if (authCookies.length === 0) {
    return NextResponse.next();
  }

  // 이번 요청의 SSR(`cookies()`)이 새 토큰을 보게 한다. Next 16 proxy 문서의
  // `request.cookies.set()` → `NextResponse.next({ request })` 패턴이다.
  authCookies.forEach(({ name, value }) => request.cookies.set(name, value));

  const response = NextResponse.next({ request });

  // 브라우저에는 서버가 준 `Set-Cookie`를 **그대로** 넘긴다. Domain·Secure·SameSite·Max-Age를
  // web이 다시 만들면 서버가 바꿀 때마다 두 벌이 갈라진다.
  setCookieHeaders.forEach((setCookie) => {
    response.headers.append("set-cookie", setCookie);
  });

  return response;
}

/**
 * **투기적(speculative) 요청에서는 proxy가 돌지 않는다.**
 *
 * 투기적 요청은 응답이 **버려질 수 있는** 요청이다. 여기서 토큰을 회전시키면 새 refresh
 * 쿠키가 담긴 `Set-Cookie`가 브라우저에 도달하지 못한 채 옛 토큰만 무효가 된다. 그 뒤
 * 진짜 내비게이션은 이미 죽은 토큰으로 오고, 그때부터 모든 요청이 재발급에 실패한다
 * (APP-286에서 처음 밟았고, 목록이 불완전해 APP-347로 다시 났다).
 *
 * | 헤더 | 누가 보내나 |
 * |---|---|
 * | `next-router-prefetch` | `<Link>` prefetch |
 * | `next-router-segment-prefetch` | per-segment prefetch (PPR) |
 * | `next-instant-navigation-testing-prefetch` | instant navigation |
 * | `purpose: prefetch` | 구형 브라우저·크롤러 |
 * | `sec-purpose` | **브라우저**의 speculation rules와 주소창 prerender |
 *
 * 앞의 넷은 Next가 보내고 원본은 `next/dist/client/components/app-router-headers.js`다.
 * **`sec-purpose`는 브라우저가 보내므로 앱이 끌 수 없다** — Chrome은 주소창 자동완성만으로도
 * 페이지를 미리 렌더한다. 값이 `prefetch`이거나 `prefetch;prerender`라 값 비교를 하지 않고
 * 키 유무만 본다.
 *
 * `<Link prefetch={false}>`로 끄는 방향이 아니다. prefetch는 정상 기능이고, 브라우저가
 * 하는 prerender는 애초에 끌 수도 없다. 막아야 하는 것은 prefetch가 아니라 **투기적 요청이
 * 상태를 바꾸는 것**이다.
 *
 * 목록을 상수로 빼지 않는다 — Next는 `config`를 정적으로 읽으므로 변수 참조를 쓰면
 * "Invalid segment configuration export"로 빌드가 깨진다.
 */
export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|webmanifest)$).*)",
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
