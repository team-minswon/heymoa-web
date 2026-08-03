export const ACCESS_TOKEN_COOKIE_NAME = "access_token";
export const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

/** 인증 쿠키 전부. 심을 때도 지울 때도 이 목록을 돕니다. */
export const AUTH_COOKIE_NAMES = [
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
] as const;

export type AuthCookieName = (typeof AUTH_COOKIE_NAMES)[number];

export function isAuthCookieName(name: string): name is AuthCookieName {
  return (AUTH_COOKIE_NAMES as readonly string[]).includes(name);
}

/**
 * 서버가 인증 쿠키를 심을 때 쓰는 Domain. **원본은 heymoa-server의
 * `application-prod.yml`(`auth.*.cookie.domain`)이고, 거기가 바뀌면 여기도 고쳐야 합니다.**
 *
 * **지울 때 이 값을 빼면 안 지워집니다.** RFC 6265에서 쿠키는 `(name, domain, path)`로
 * 구분되므로, Domain 없는 Set-Cookie는 `heymoa.app` host-only 쿠키를 지울 뿐
 * `.heymoa.app` 도메인 쿠키는 그대로 남습니다. 그러면 무효해진 refresh token이 브라우저에
 * 영구히 박혀 모든 내비게이션이 재발급을 다시 시도합니다 (APP-344, 재발급 실패율 74%).
 *
 * 로컬 서버는 쿠키를 host-only로 심으므로 이 Domain이 안 맞아 삭제가 무시됩니다. 로컬
 * 기본값은 MSW(`.env.local`의 `NEXT_PUBLIC_API_MOCKING=enabled`)라 proxy가 곧바로 반환하고
 * 이 경로를 지나지 않습니다. 실서버를 로컬로 붙여 쓰다가 만료된 쿠키가 안 지워지면 그때
 * 환경별로 가릅니다.
 *
 * **쿠키를 새로 심을 때는 이 값을 쓰지 않습니다.** 갱신 응답의 `Set-Cookie`를 그대로
 * 흘려보내므로 Domain·Secure·SameSite·Max-Age의 원본은 서버 하나입니다. 여기가 필요한 것은
 * 서버 응답 없이 web이 혼자 지워야 하는 삭제 경로뿐입니다.
 */
export const AUTH_COOKIE_DOMAIN = ".heymoa.app";
