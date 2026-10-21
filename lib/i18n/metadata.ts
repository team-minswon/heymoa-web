import type { Metadata } from "next";

import { noindexDirective } from "@/lib/site";

import {
  DEFAULT_LOCALE,
  localePath,
  type Locale,
  publishedLocales,
} from "./locales";

/**
 * 마케팅 페이지의 canonical·hreflang·robots 를 한 곳에서 만든다(architecture.md 8절).
 *
 * - 언어판은 늘 자기 주소를 canonical 로 낸다. 영어판이 한국어 주소를 물려받지 않게.
 * - hreflang 에는 **공개한 언어만** 싣고, `x-default` 는 한국어 주소다.
 * - 공개하지 않은 언어판은 noindex 이고 hreflang 이 없다.
 * - 운영이 아닌 배포의 noindex 는 루트 레이아웃(`robotsDirective`)이 그대로 건다 — 여기서 robots 를 덮지 않는다.
 *
 * `path` 는 무접두 경로(`/help`)다.
 */
export function localizedMetadata(
  locale: Locale,
  path: string,
  published = publishedLocales()
): Pick<Metadata, "alternates" | "robots"> {
  const canonical = localePath(locale, path);

  if (!published.includes(locale)) {
    return { alternates: { canonical }, robots: noindexDirective };
  }

  return {
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(
          published.map((each) => [each, localePath(each, path)])
        ),
        "x-default": localePath(DEFAULT_LOCALE, path),
      },
    },
  };
}
