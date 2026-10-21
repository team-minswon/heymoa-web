/**
 * 화면 언어. 한국어가 기준이고 주소 접두사가 없다. 영어는 `/en` 아래에 있다(PRO-66).
 *
 * `next.config.ts` 도 이 파일을 읽으므로 Next 서버 API 를 들이지 않는다.
 */
export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";

export const isLocale = (value: unknown): value is Locale =>
  LOCALES.includes(value as Locale);

/**
 * 사용자가 푸터·설정에서 **직접 고른** 언어. `/en` 에 들어온 것만으로는 쓰지 않는다.
 * 서버가 읽지 않으므로 인증 쿠키처럼 도메인을 넓히지 않는다(호스트 전용).
 */
export const LANG_COOKIE = "heymoa-lang";
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** 무접두 경로(`/help`)를 그 언어의 주소로. 한국어는 그대로다. */
export function localePath(locale: Locale, path: string) {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/**
 * 주소(`/en/help`)에서 언어와 무접두 경로(`/help`)를 가른다. 접두사가 없으면 한국어다.
 * `/ko/...` 도 벗긴다 — 브라우저 주소에는 없지만(영구 이동) 한국어 페이지를 서버에서 그릴 때 `usePathname()` 이
 * rewrite 뒤의 내부 경로(`/ko/terms`)를 돌려준다. 안 벗기면 SSR 이 랜딩 크롬 대신 범용 크롬을 그린다.
 */
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

/**
 * 검색에 공개한 언어. 빌드 때 `PUBLISHED_LOCALES`(쉼표 목록)를 읽고, 없으면 한국어만이다.
 * 공개하지 않은 언어판은 noindex 이고 sitemap·hreflang 에 오르지 않는다(rollout.md).
 */
export function publishedLocales(
  raw = process.env.PUBLISHED_LOCALES
): readonly Locale[] {
  const listed = (raw ?? "").split(",").map((value) => value.trim());
  return LOCALES.filter(
    (locale) => locale === DEFAULT_LOCALE || listed.includes(locale)
  );
}

/** 언어 선택에 보이는 이름. 어느 화면에서나 그 언어 자신의 이름으로 쓴다. */
export const LOCALE_NAMES: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
};
