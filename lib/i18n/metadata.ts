import type { Metadata } from "next";

import { DEFAULT_LOCALE, LOCALES, localePath, type Locale } from "./locales";

/**
 * 마케팅 페이지의 canonical·hreflang 을 한 곳에서 만든다(architecture.md 8절).
 *
 * - 언어판은 늘 자기 주소를 canonical 로 낸다. 영어판이 한국어 주소를 물려받지 않게.
 * - hreflang 에는 모든 언어판을 싣고, `x-default` 는 한국어 주소다. 번역된 언어판은 따로 설정하지 않아도 검색에 공개된다.
 * - 운영이 아닌 배포의 noindex 는 루트 레이아웃(`robotsDirective`)이 그대로 건다 — 여기서 robots 를 덮지 않는다.
 *
 * `path` 는 무접두 경로(`/help`)다.
 */
export function localizedMetadata(
  locale: Locale,
  path: string
): Pick<Metadata, "alternates"> {
  const canonical = localePath(locale, path);

  return {
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(
          LOCALES.map((each) => [each, localePath(each, path)])
        ),
        "x-default": localePath(DEFAULT_LOCALE, path),
      },
    },
  };
}
