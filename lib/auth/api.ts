import type { AppResponse, AuthTokenResponse, AuthUser } from "@/lib/auth/types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export const isAuthApiConfigured = Boolean(apiBaseUrl);

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

function buildApiUrl(path: string) {
  if (!apiBaseUrl) {
    return path;
  }

  return new URL(path, apiBaseUrl).toString();
}

async function parseAppResponse<T>(
  response: Response,
  allowEmptyData = false,
): Promise<T> {
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

async function postAuth<T>(
  path: string,
  body?: Record<string, unknown>,
  allowEmptyData = false,
) {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseAppResponse<T>(response, allowEmptyData);
}

export async function refreshToken() {
  return postAuth<AuthTokenResponse>("/api/v1/auth/refresh");
}

export async function logout() {
  await postAuth<void>("/api/v1/auth/logout", undefined, true);
}

export async function getMe(accessToken: string) {
  const response = await fetch(buildApiUrl("/api/v1/users/me"), {
    method: "GET",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return parseAppResponse<AuthUser>(response);
}

export { AuthApiError };
