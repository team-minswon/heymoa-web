import { cookies } from "next/headers";
import { cache } from "react";

import type { AppResponse, AuthUser } from "@/lib/auth/types";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { MOCK_USER } from "@/lib/mocks/mock-user";
import { serverApiBaseUrl } from "@/lib/api/server-base-url";

// 브라우저가 부를 주소와 다를 수 있다 — `lib/api/server-base-url.ts` 주석 참조.
const apiBaseUrl = serverApiBaseUrl();

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
      return MOCK_USER;
    }

    const url = buildServerApiUrl("/v1/users/me");

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
        },
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        return null;
      }

      const body = (await response.json()) as AppResponse<AuthUser>;

      if (!body.success || !body.data) {
        return null;
      }

      return body.data;
    } catch {
      return null;
    }
  }
);
