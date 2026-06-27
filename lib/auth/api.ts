import { ApiClientError } from "@/lib/api/client";
import { getMeApi, logoutAuthApi, refreshAuthApi } from "@/lib/api/endpoints";
import { notifyAuthStateChanged } from "@/lib/auth/events";
import { isAuthApiConfigured } from "@/lib/auth/paths";
import type { AuthUser } from "@/lib/auth/types";

class AuthApiError extends ApiClientError {}

export async function refreshAuth() {
  await refreshAuthApi();
}

async function fetchMe(hasRetried = false): Promise<AuthUser> {
  if (!isAuthApiConfigured) {
    throw new AuthApiError(
      "API URL is not configured.",
      0,
      "API_NOT_CONFIGURED"
    );
  }

  try {
    return await getMeApi();
  } catch (error) {
    if (!(error instanceof ApiClientError)) {
      throw error;
    }

    if (error.status !== 401 || hasRetried) {
      throw new AuthApiError(error.message, error.status, error.code);
    }

    try {
      await refreshAuth();
      return fetchMe(true);
    } catch {
      notifyAuthStateChanged({ reason: "unauthenticated" });
      throw new AuthApiError("Authentication refresh failed.", 401);
    }
  }
}

export async function getMe(): Promise<AuthUser> {
  return fetchMe();
}

export async function logout() {
  try {
    await logoutAuthApi();
  } finally {
    notifyAuthStateChanged({ reason: "logout" });
  }
}

export { AuthApiError, isAuthApiConfigured };
