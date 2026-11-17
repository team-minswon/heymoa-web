import { isLocale, type Locale } from "./locales";

export function documentLocale(): Locale | null {
  if (typeof document === "undefined") return null;
  const lang = document.documentElement.lang;
  return isLocale(lang) ? lang : null;
}

export function acceptLanguageHeader(): Record<string, string> {
  const locale = documentLocale();
  return locale ? { "Accept-Language": locale } : {};
}
