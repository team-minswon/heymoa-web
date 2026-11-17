export const ACCESS_TOKEN_COOKIE_NAME = "access_token";
export const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

export const AUTH_COOKIE_NAMES = [
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
] as const;

export type AuthCookieName = (typeof AUTH_COOKIE_NAMES)[number];

export function isAuthCookieName(name: string): name is AuthCookieName {
  return (AUTH_COOKIE_NAMES as readonly string[]).includes(name);
}

/** 원본은 heymoa-server `application-prod.yml`(`auth.*.cookie.domain`)입니다. RFC 6265 상 지울 때 Domain 을 빼면 `.heymoa.app` 쿠키가 남습니다. 빈 문자열은 host-only 삭제라 `??` 여야 합니다. */
export const AUTH_COOKIE_DOMAIN =
  process.env.AUTH_COOKIE_DOMAIN ?? ".heymoa.app";
