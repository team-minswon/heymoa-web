import { cookies } from "next/headers";
import { cache } from "react";

import type { AppResponse, AuthUser } from "@/lib/auth/types";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { HD_ME_EMAIL, HD_ME_NAME } from "@/lib/mocks/help-demo/people";
import { MOCK_ACCOUNT_LANGUAGE_COOKIE, MOCK_USER } from "@/lib/mocks/mock-user";
import { requestLocale } from "@/lib/i18n/request-locale";
import { isLocale } from "@/lib/i18n/locales";
import { parseAuthSession } from "@/lib/auth/session-probe";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function buildServerApiUrl(path: string) {
  if (!apiBaseUrl) {
    return null;
  }

  return new URL(path, apiBaseUrl).toString();
}

function serializeCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

export const getCurrentUserForSsr = cache(
  async (): Promise<AuthUser | null> => {
    if (shouldEnableMocking()) {
      const cookieStore = await cookies();
      // 목 계정의 언어는 브라우저 MSW 가 쿠키에 남긴다(`lib/mocks/db.ts`). 서버가 그린 첫 화면과 MSW 의 사용자가
      // 같은 언어여야 hydration 이 갈리지 않는다.
      const stored = cookieStore.get(MOCK_ACCOUNT_LANGUAGE_COOKIE)?.value;
      const language = isLocale(stored) ? stored : null;
      // 가이드 캡처용 목 프리셋(`lib/mocks/help-demo`)은 사용자 이름도 가상이다. 캡처 스크립트가 심는 쿠키가 있을 때만
      // 서버가 그린 첫 화면의 사용자도 같은 이름으로 맞춘다. 목 모드에서만 이 분기를 지난다.
      if (cookieStore.get("heymoa-help-demo")?.value === "1") {
        return { ...MOCK_USER, name: HD_ME_NAME, email: HD_ME_EMAIL, language };
      }
      return { ...MOCK_USER, language };
    }

    const url = buildServerApiUrl("/v1/auth/session");

    if (!url) {
      return null;
    }

    const cookieHeader = serializeCookies(await cookies());

    if (!cookieHeader) {
      return null;
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Cookie: cookieHeader,
          // 계정을 알기 전이라 쿠키 → 브라우저 언어다. 오류 문구만 이 값을 따른다(server `ApiLocaleResolver`).
          "Accept-Language": await requestLocale(),
        },
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        return null;
      }

      const body = (await response.json()) as AppResponse<unknown>;

      if (!body.success || !body.data) {
        return null;
      }

      const session = parseAuthSession(body.data);
      return session.state === "authenticated" ? session.user : null;
    } catch {
      return null;
    }
  }
);
