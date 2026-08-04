import { notifyAuthStateChanged } from "@/lib/auth/events";
import { buildApiUrl, isAuthApiConfigured } from "@/lib/auth/paths";
import type { AppResponse, AuthUser } from "@/lib/auth/types";
import { refreshAuthOnce } from "@/lib/api/fetcher";
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

async function fetchMe(hasRetried = false): Promise<AuthUser> {
  // apiFetch를 안 거치는 경로라 게이트를 따로 확인한다.
  if (isSessionExpired()) {
    throw new SessionExpiredError();
  }

  const url = buildApiUrl("/v1/users/me");
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (response.status === 401 && !hasRetried) {
    try {
      await refreshAuthOnce();
      return fetchMe(true);
    } catch (error) {
      // **여기서는 게이트를 열지 않는다.** 이 함수는 "로그인했나"를 묻는 탐침이고,
      // 비로그인 방문자가 홈에 처음 와도 401 → 갱신 400을 그대로 겪는다. 게이트를 열면
      // 로그인한 적 없는 사람에게 "세션이 만료되었습니다" 토스트가 뜨고 로그아웃 요청이
      // 나간다. 401이 이 경로에서는 정상 답이다.
      //
      // 만료를 선언하는 것은 앱이 이미 로그인 상태라고 믿고 부르는 경로다 —
      // `lib/api/fetcher.ts`(제품 쿼리)와 `lib/api/sse.ts`(스트림).
      throw error;
    }
  }

  return parseAppResponse<AuthUser>(response);
}

export async function getMe(): Promise<AuthUser> {
  return fetchMe();
}

export async function logout() {
  await postAuth<void>("/v1/auth/logout", true);

  // **알리기 전에 막는다.** 아래 이벤트를 받은 AuthProvider가 캐시를 비우면 남은 제품
  // 쿼리들이 그 자리에서 다시 조회하는데, 쿠키는 이 줄 위에서 이미 사라졌다. 막지 않으면
  // 그 401들이 갱신을 시도하고 실패해 만료 경로를 깨운다 — "세션이 만료되었습니다"가 뜬다.
  openSessionGateQuietly();
  notifyAuthStateChanged({ reason: "logout" });
}

export { AuthApiError, isAuthApiConfigured };
