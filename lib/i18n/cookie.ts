import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, type Locale } from "./locales";

export function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LANG_COOKIE}=${locale}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`;
}

export function readLocaleCookie(): Locale | null {
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LANG_COOKIE}=`))
    ?.slice(LANG_COOKIE.length + 1);

  return value === "ko" || value === "en" ? value : null;
}
