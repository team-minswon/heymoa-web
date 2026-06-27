import { cookies } from "next/headers";
import { ApiClientError } from "@/lib/api/client";
import { getMeApi } from "@/lib/api/endpoints";
import { isAuthApiConfigured } from "@/lib/auth/paths";
import type { AuthUser } from "@/lib/auth/types";

export async function getCurrentUserForSsr(): Promise<AuthUser | null> {
  if (!isAuthApiConfigured) {
    return null;
  }

  const cookieHeader = (await cookies()).toString();

  try {
    return await getMeApi({
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof ApiClientError) {
      return null;
    }

    return null;
  }
}
