import { notifyAuthStateChanged } from "@/lib/auth/events";
import { buildApiUrl, isAuthApiConfigured } from "@/lib/auth/paths";
import type { AppResponse, AuthUser } from "@/lib/auth/types";
import { refreshAuthOnce } from "@/lib/api/fetcher";

class AuthApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.code = code;
  }
}

async function parseAppResponse<T>(
  response: Response,
  allowEmptyData = false
): Promise<T> {
  if (response.status === 204 && allowEmptyData) {
    return undefined as T;
  }

  const body = (await response.json()) as AppResponse<T>;

  if (!response.ok || !body.success || body.data === null) {
    if (response.ok && body.success && allowEmptyData) {
      return undefined as T;
    }

    throw new AuthApiError(
      body.error?.message ?? "Authentication request failed.",
      response.status,
      body.error?.code
    );
  }

  return body.data;
}

async function postAuth<T>(path: string, allowEmptyData = false) {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    credentials: "include",
  });

  return parseAppResponse<T>(response, allowEmptyData);
}

async function fetchMe(hasRetried = false): Promise<AuthUser> {
  const url = buildApiUrl("/v1/users/me");
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (response.status === 401 && !hasRetried) {
    try {
      await refreshAuthOnce();
      return fetchMe(true);
    } catch {
      notifyAuthStateChanged({ reason: "unauthenticated" });
      throw new Error("Authentication refresh failed.");
    }
  }

  return parseAppResponse<AuthUser>(response);
}

export async function getMe(): Promise<AuthUser> {
  return fetchMe();
}

export async function logout() {
  await postAuth<void>("/v1/auth/logout", true);
  notifyAuthStateChanged({ reason: "logout" });
}

export { AuthApiError, isAuthApiConfigured };
