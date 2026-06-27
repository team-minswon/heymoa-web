import { cookies } from "next/headers";
import { buildApiUrl, isAuthApiConfigured } from "@/lib/auth/paths";
import type { AppResponse, AuthUser } from "@/lib/auth/types";

export async function getCurrentUserForSsr(): Promise<AuthUser | null> {
  if (!isAuthApiConfigured) {
    return null;
  }

  const cookieHeader = (await cookies()).toString();

  try {
    const response = await fetch(buildApiUrl("/v1/users/me"), {
      method: "GET",
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as AppResponse<AuthUser>;

    return body.success ? body.data : null;
  } catch {
    return null;
  }
}
