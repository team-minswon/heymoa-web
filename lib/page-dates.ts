import type { Locale } from "@/lib/i18n/locales";

/**
 * sitemap `lastmod` 와 JSON-LD `dateModified` 의 원본(`YYYY-MM-DD`).
 *
 * **배포 시각이 아니라 그 페이지의 보이는 내용을 마지막으로 고친 날이다.** 구글은 `lastmod` 가 실제 수정과 맞을 때만 쓴다
 * (https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) — 배포마다 바뀌는 값은 틀린 값이다.
 * 그래서 `new Date()` 를 쓰지 않고, 사람이 문구·구성을 고칠 때 그 줄의 날짜를 같이 올린다. 맞춤법·주석 손질은 올리지 않는다.
 * git 이력에서 뽑지 않는 이유: 빌드 환경(얕은 클론·워크트리)에 따라 값이 달라질 수 있다.
 *
 * 가이드(`/help/**`)는 여기 없다 — 페이지마다 frontmatter `modified` 가 원본이고(`content/help/README.md`), 허브·그룹은
 * 그 아래 페이지 중 가장 최근 값이다.
 */

/** 약관·개인정보처리방침 시행일. 시행일이 곧 최종 수정일이다. 조항을 고치면 같이 고친다(페이지 머리 표시도 이 값이다). */
export const TERMS_EFFECTIVE = "2026-10-18";
export const PRIVACY_EFFECTIVE = "2026-10-18";

export const PAGE_MODIFIED = {
  "/": { ko: "2026-10-21", en: "2026-10-21" },
  "/download": { ko: "2026-10-21", en: "2026-10-21" },
  "/terms": { ko: TERMS_EFFECTIVE, en: TERMS_EFFECTIVE },
  "/privacy": { ko: PRIVACY_EFFECTIVE, en: PRIVACY_EFFECTIVE },
} as const satisfies Record<string, Record<Locale, string>>;
