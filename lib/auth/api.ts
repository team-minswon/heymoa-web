import { notifyAuthStateChanged } from "@/lib/auth/events";
import { buildApiUrl, isAuthApiConfigured } from "@/lib/auth/paths";
import type { AppResponse, AuthUser } from "@/lib/auth/types";
import { AuthRefreshError, refreshAuthOnce } from "@/lib/api/fetcher";
import { parseAuthSession } from "@/lib/auth/session-probe";
import {
  isSessionExpired,
  openSessionGateQuietly,
  SessionExpiredError,
} from "@/lib/auth/session-gate";

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

async function fetchMe(hasRetried = false): Promise<AuthUser | null> {
  // apiFetch를 안 거치는 경로라 게이트를 따로 확인한다.
  if (isSessionExpired()) {
    throw new SessionExpiredError();
  }

  const url = buildApiUrl("/v1/auth/session");
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const session = parseAuthSession(await parseAppResponse<unknown>(response));
  if (session.state === "authenticated") return session.user;
  if (session.state === "anonymous") return null;
  if (hasRetried) {
    throw new AuthApiError(
      "Session recovery did not authenticate the user.",
      401
    );
  }

  try {
    await refreshAuthOnce();
    return fetchMe(true);
  } catch (error) {
    // A login probe never expires the product session gate. Only a server
    // assertion that the refresh token is dead proves an anonymous result.
    if (error instanceof AuthRefreshError && error.expired) return null;
    throw error;
  }
}

export async function getMe(): Promise<AuthUser | null> {
  return fetchMe();
}

export async function logout() {
  await postAuth<void>("/v1/auth/logout", true);

  // **알리기 전에 막는다.** 쿠키는 이 줄 위에서 이미 사라졌고, 새 문서가 뜨기까지 폴링
  // 타이머와 이미 예약된 조회는 계속 깨어난다. 막지 않으면 그 401들이 갱신을 시도하고
  // 실패해 만료 경로를 깨운다 — 스스로 누른 로그아웃에 "세션이 만료되었습니다"가 뜬다.
  openSessionGateQuietly();
  notifyAuthStateChanged({ reason: "logout" });
}

export { AuthApiError, isAuthApiConfigured };
