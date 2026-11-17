import type { Locale } from "./locales";

const DISPLAY_LOCALES = { ko: "ko-KR", en: "en-US" } as const satisfies Record<
  Locale,
  string
>;

export function displayLocale(locale: Locale) {
  return DISPLAY_LOCALES[locale];
}
