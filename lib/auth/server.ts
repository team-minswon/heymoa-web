import { cookies } from "next/headers";
import { cache } from "react";

import type { AppResponse, AuthUser } from "@/lib/auth/types";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { MOCK_USER } from "@/lib/mocks/mock-user";
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
      return MOCK_USER;
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
