import { cookies, headers } from "next/headers";

import { localeFromAcceptLanguage } from "./accept-language";
import { isLocale, LANG_COOKIE, type Locale } from "./locales";

/**
 * 계정을 모를 때의 요청 언어: `heymoa-lang` 쿠키 → 브라우저 언어(`Accept-Language`) → ko.
 *
 * SSR 세션 조회(`getCurrentUserForSsr`)가 계정을 알기 전에 서버에 보낼 언어로도 쓴다. 그래서 계정을 읽는
 * `productLocale()`(`current.ts`)과 파일을 나눈다 — 합치면 `lib/auth/server.ts` 와 서로를 import 한다.
 */
export async function requestLocale(): Promise<Locale> {
  const cookie = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
}
