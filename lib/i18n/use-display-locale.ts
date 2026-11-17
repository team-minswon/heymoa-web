import { useLocale } from "next-intl";

import { displayLocale } from "./display-locale";
import { DEFAULT_LOCALE, isLocale } from "./locales";

export function useDisplayLocale() {
  const locale = useLocale();
  return displayLocale(isLocale(locale) ? locale : DEFAULT_LOCALE);
}
