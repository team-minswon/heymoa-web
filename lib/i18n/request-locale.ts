import { cookies, headers } from "next/headers";

import { localeFromAcceptLanguage } from "./accept-language";
import { isLocale, LANG_COOKIE, type Locale } from "./locales";

export async function requestLocale(): Promise<Locale> {
  const cookie = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
}
