import type { Locale } from "@/lib/i18n/locales";
import { archivedVersions, type LegalDoc } from "@/lib/legal-archive";
import { SESSION_REPLAY_EFFECTIVE } from "@/lib/analytics/session-replay";

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

type LegalDates = { announced: string | null; effective: string | null };

/**
 * 지금 본문(`messages/<언어>/legal.json`)의 공고일·시행일(`YYYY-MM-DD`). 페이지 머리에 보이고, null 이면 「미정」이다.
 * **시행일이 곧 판의 키다** — server 동의 버전(`CONSENT_PRIVACY_VERSION`·`CONSENT_TERMS_VERSION`)을 같은 날 같은 문자열로
 * 올린다. 약관은 공고일과 시행일 사이를 7일(불리하면 30일) 이상 둔다(약관 제15조·처리방침 제12조).
 * 시행하고 나서 본문을 다시 고치면, 그 전에 지금 본문을 `lib/legal-archive.ts` 에 얼려 넣고 여기 날짜를 새로 쓴다.
 */
export const LEGAL_CURRENT: Record<LegalDoc, LegalDates> = {
  // APP-1548: 내용이 가려진 화면 흐름을 녹화합니다. 기존 11/3 판은 보존합니다.
  privacy: { announced: "2026-11-11", effective: SESSION_REPLAY_EFFECTIVE },
  terms: { announced: "2026-10-23", effective: "2026-10-23" },
};

/** sitemap·JSON-LD는 공고한 본문의 수정일입니다. 미래 시행일을 lastmod로 쓰지 않습니다. */
const lastEffective = (doc: LegalDoc) =>
  LEGAL_CURRENT[doc].announced ??
  LEGAL_CURRENT[doc].effective ??
  archivedVersions(doc).at(-1)!;
export const TERMS_EFFECTIVE = lastEffective("terms");
export const PRIVACY_EFFECTIVE = lastEffective("privacy");

export const PAGE_MODIFIED = {
  // APP-1598: 상단 바·푸터에 「가격 안내」, 푸터에 사업자 정보
  "/": { ko: "2026-11-12", en: "2026-11-12" },
  "/pricing": { ko: "2026-11-12", en: "2026-11-12" },
  "/download": { ko: "2026-10-21", en: "2026-10-21" },
  "/terms": { ko: TERMS_EFFECTIVE, en: TERMS_EFFECTIVE },
  "/privacy": { ko: PRIVACY_EFFECTIVE, en: PRIVACY_EFFECTIVE },
} as const satisfies Record<string, Record<Locale, string>>;
