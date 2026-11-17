import type { Locale } from "@/lib/i18n/locales";
import { archivedVersions, type LegalDoc } from "@/lib/legal-archive";
import { SESSION_REPLAY_EFFECTIVE } from "@/lib/analytics/session-replay";

/** PAGE_MODIFIED 는 보이는 내용을 고친 날입니다. 구글은 `lastmod` 가 실제 수정과 맞을 때만 써서 배포 시각(`new Date()`)을 쓰지 않습니다. */

type LegalDates = { announced: string | null; effective: string | null };

export const LEGAL_CURRENT: Record<LegalDoc, LegalDates> = {
  privacy: { announced: "2026-11-11", effective: SESSION_REPLAY_EFFECTIVE },
  terms: { announced: "2026-11-14", effective: "2026-11-14" },
};

const lastEffective = (doc: LegalDoc) =>
  LEGAL_CURRENT[doc].announced ??
  LEGAL_CURRENT[doc].effective ??
  archivedVersions(doc).at(-1)!;
export const TERMS_EFFECTIVE = lastEffective("terms");
export const PRIVACY_EFFECTIVE = lastEffective("privacy");

export const PAGE_MODIFIED = {
  "/": { ko: "2026-11-12", en: "2026-11-12" },
  "/pricing": { ko: "2026-11-12", en: "2026-11-12" },
  "/download": { ko: "2026-10-21", en: "2026-10-21" },
  "/terms": { ko: TERMS_EFFECTIVE, en: TERMS_EFFECTIVE },
  "/privacy": { ko: PRIVACY_EFFECTIVE, en: PRIVACY_EFFECTIVE },
} as const satisfies Record<string, Record<Locale, string>>;
