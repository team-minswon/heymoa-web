import { useLocale } from "next-intl";

import { displayLocale } from "./display-locale";
import { DEFAULT_LOCALE, isLocale } from "./locales";

/**
 * 지금 화면 언어의 날짜·숫자 표시 locale(`ko-KR`·`en-US`). `formatAppDate` 의 셋째 인자와 `toLocaleString` 에 넘긴다.
 * 언어는 next-intl 이 SSR 과 같은 값을 주므로 hydration 이 갈리지 않는다(렌더 중 `navigator.language` 를 읽지 않는다).
 */
export function useDisplayLocale() {
  const locale = useLocale();
  return displayLocale(isLocale(locale) ? locale : DEFAULT_LOCALE);
}
