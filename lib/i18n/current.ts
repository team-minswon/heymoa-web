import { cookies } from "next/headers";
import { lang } from "next/root-params";

import { getCurrentUserForSsr } from "@/lib/auth/server";

import { DEFAULT_LOCALE, isLocale, LANG_COOKIE, type Locale } from "./locales";
import { requestLocale } from "./request-locale";

/** 사용자가 직접 고른 언어(`heymoa-lang` 쿠키). 없으면 한국어. 주소로 언어를 알 수 없는 404 가 쓴다. */
export async function cookieLocale(): Promise<Locale> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * 마케팅 루트(`app/[lang]`) 안 서버 컴포넌트의 언어. 첫 세그먼트가 언어가 아닌 주소(`/wp-admin/x`)는
 * 404 로만 오므로 그때는 쿠키 언어다.
 */
export async function marketingLocale(): Promise<Locale> {
  const value = await lang();
  return isLocale(value) ? value : cookieLocale();
}

/**
 * 제품 면(`app/(product)`)의 언어: 계정 → `heymoa-lang` 쿠키 → 브라우저 언어 → ko (APP-1285).
 *
 * 계정 값은 요청마다 이미 부르는 `getCurrentUserForSsr()`(React `cache`)에서 읽어 API 호출이 늘지 않는다. 루트 레이아웃과
 * `i18n/request.ts` 가 같이 불러 서버 컴포넌트의 `getTranslations` 와 클라이언트의 `useTranslations` 가 같은 언어를 본다.
 */
export async function productLocale(): Promise<Locale> {
  const user = await getCurrentUserForSsr();
  if (user?.language) return user.language;
  return requestLocale();
}
