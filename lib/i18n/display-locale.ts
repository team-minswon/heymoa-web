import type { Locale } from "./locales";

const DISPLAY_LOCALES = { ko: "ko-KR", en: "en-US" } as const satisfies Record<
  Locale,
  string
>;

/** 화면 언어 → 날짜·숫자 표시 locale. 시간대는 바꾸지 않는다(`lib/format/date.ts` 의 `APP_TIME_ZONE`). */
export function displayLocale(locale: Locale) {
  return DISPLAY_LOCALES[locale];
}
