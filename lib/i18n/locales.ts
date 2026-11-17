// next.config.ts 도 이 파일을 읽으므로 Next 서버 API 를 들이지 않습니다.
export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";

export const isLocale = (value: unknown): value is Locale =>
  LOCALES.includes(value as Locale);

export const LANG_COOKIE = "heymoa-lang";
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function localePath(locale: Locale, path: string) {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

// `/ko/...` 도 벗깁니다. SSR 의 usePathname() 이 rewrite 뒤 내부 경로(`/ko/terms`)를 돌려줍니다.
export function splitLocale(pathname: string): {
  locale: Locale;
  path: string;
} {
  const [, first, ...rest] = pathname.split("/");
  if (isLocale(first)) {
    return { locale: first, path: `/${rest.join("/")}` };
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}

export const LOCALE_NAMES: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
};
