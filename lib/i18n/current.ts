import { cookies } from "next/headers";
import { lang } from "next/root-params";

import { DEFAULT_LOCALE, isLocale, LANG_COOKIE, type Locale } from "./locales";

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
