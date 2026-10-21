import type { Metadata } from "next";

import { messagesFor } from "@/i18n/messages";
import { siteMetadataFor } from "@/lib/site";

import { DEFAULT_LOCALE, LOCALES, localePath, type Locale } from "./locales";

/**
 * 무접두 경로(`/help`)의 언어판 대응(hreflang): 모든 언어판과 `x-default`(한국어 주소). 페이지 head(`localizedMetadata`)와
 * sitemap 이 같이 읽는다 — 두 곳이 따로 만들면 `x-default` 처럼 한쪽만 빠진다.
 */
export function localeAlternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.map((each) => [each, localePath(each, path)])),
    "x-default": localePath(DEFAULT_LOCALE, path),
  };
}

/**
 * 마케팅 페이지의 canonical·hreflang·공유 카드를 한 곳에서 만든다(architecture.md 8절).
 *
 * - 언어판은 늘 자기 주소를 canonical 로 낸다. 영어판이 한국어 주소를 물려받지 않게.
 * - hreflang 에는 모든 언어판을 싣고, `x-default` 는 한국어 주소다. 번역된 언어판은 따로 설정하지 않아도 검색에 공개된다.
 * - 공유 카드(Open Graph·Twitter)는 사이트 공통값(`siteName`·`locale`·이미지) 위에 **이 페이지의 `og:url`** 을 얹는다.
 *   안 얹으면 모든 페이지가 홈의 `og:url` 을 낸다. 제목·설명은 `share` 로 준다(안 주면 홈과 같은 사이트 값 — 랜딩).
 *   `og:title` 은 `<title>` 과 같은 `제목 | 브랜드` 꼴이다.
 * - 운영이 아닌 배포의 noindex 는 루트 레이아웃(`robotsDirective`)이 그대로 건다 — 여기서 robots 를 덮지 않는다.
 *
 * `path` 는 무접두 경로(`/help`)다.
 */
export function localizedMetadata(
  locale: Locale,
  path: string,
  share?: { title: string; description: string }
): Pick<Metadata, "alternates" | "openGraph" | "twitter"> {
  const canonical = localePath(locale, path);
  const site = siteMetadataFor(locale);
  const card = share && {
    title: `${share.title} | ${messagesFor(locale).landing.meta.brandLabel}`,
    description: share.description,
  };

  return {
    alternates: { canonical, languages: localeAlternates(path) },
    openGraph: { ...site.openGraph, url: canonical, ...card },
    twitter: { ...site.twitter, ...card },
  };
}
