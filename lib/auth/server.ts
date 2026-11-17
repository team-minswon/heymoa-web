import { cookies } from "next/headers";
import { cache } from "react";

import type { AppResponse, AuthUser } from "@/lib/auth/types";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import * as enHelpDemoPeople from "@/lib/mocks/help-demo/en/people";
import * as helpDemoPeople from "@/lib/mocks/help-demo/people";
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
      // 목 계정 언어는 브라우저 MSW 가 쿠키에 남깁니다. 서버가 그린 첫 화면과 같아야 hydration 이 갈리지 않습니다.
      const stored = cookieStore.get(MOCK_ACCOUNT_LANGUAGE_COOKIE)?.value;
      const language = isLocale(stored) ? stored : null;
      if (cookieStore.get("heymoa-help-demo")?.value === "1") {
        const people = language === "en" ? enHelpDemoPeople : helpDemoPeople;
        return { ...MOCK_USER, name: people.HD_ME_NAME, email: people.HD_ME_EMAIL, language };
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
