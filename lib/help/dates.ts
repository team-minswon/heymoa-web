import type { Locale } from "@/lib/i18n/locales";

/**
 * 가이드 JSON-LD `datePublished` — 그 언어판이 처음 공개된 날이다(영어판은 2026-10-21 에 처음 생겼다).
 *
 * 최종 수정일은 여기 두지 않는다. 페이지마다 frontmatter `modified` 가 원본이고(`content/help/README.md`),
 * sitemap `lastmod` 와 JSON-LD `dateModified` 가 같은 값을 읽는다. 화면에는 표시하지 않는다.
 */
export const HELP_PUBLISHED = {
  ko: "2026-10-13",
  en: "2026-10-21",
} as const satisfies Record<Locale, string>;
