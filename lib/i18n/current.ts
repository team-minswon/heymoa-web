import { cookies } from "next/headers";
import { lang } from "next/root-params";

import { getCurrentUserForSsr } from "@/lib/auth/server";

import { DEFAULT_LOCALE, isLocale, LANG_COOKIE, type Locale } from "./locales";
import { requestLocale } from "./request-locale";

export async function cookieLocale(): Promise<Locale> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function marketingLocale(): Promise<Locale> {
  const value = await lang();
  return isLocale(value) ? value : cookieLocale();
}

export async function productLocale(): Promise<Locale> {
  const user = await getCurrentUserForSsr();
  if (user?.language) return user.language;
  return requestLocale();
}
