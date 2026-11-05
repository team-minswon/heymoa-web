import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, type Locale } from "./locales";

/**
 * 고른 언어를 `heymoa-lang` 쿠키에 남긴다. **사람이 직접 고를 때**(푸터·설정)와, 로그인 뒤 계정 값에 맞출 때만 쓴다 —
 * `/en` 에 들어온 것만으로는 쓰지 않는다. 서버가 읽지 않으므로 호스트 전용이다.
 */
export function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LANG_COOKIE}=${locale}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`;
}

/** 브라우저의 `heymoa-lang` 쿠키. 없거나 모르는 값이면 null. */
export function readLocaleCookie(): Locale | null {
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LANG_COOKIE}=`))
    ?.slice(LANG_COOKIE.length + 1);

  return value === "ko" || value === "en" ? value : null;
}
