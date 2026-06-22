import { notifyAuthStateChanged } from "@/lib/auth/events";
import { buildApiUrl, isAuthApiConfigured } from "@/lib/auth/paths";
import type { AppResponse, AuthUser } from "@/lib/auth/types";

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
  allowEmptyData = false,
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
      body.error?.code,
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

export async function getMe() {
  const response = await fetch(buildApiUrl("/api/v1/users/me"), {
    method: "GET",
    credentials: "include",
  });

  return parseAppResponse<AuthUser>(response);
}

export async function refreshAuth() {
  await postAuth<void>("/api/v1/auth/refresh", true);
}

export async function logout() {
  try {
    await postAuth<void>("/api/v1/auth/logout", true);
  } finally {
    notifyAuthStateChanged({ reason: "logout" });
  }
}

export { AuthApiError, isAuthApiConfigured };
