import privacy20260717 from "@/content/legal/privacy/2026-07-17.json";
import privacy20260904 from "@/content/legal/privacy/2026-09-04.json";
import privacy20261012 from "@/content/legal/privacy/2026-10-12.json";
import privacy20261018 from "@/content/legal/privacy/2026-10-18.json";
import privacy20261022 from "@/content/legal/privacy/2026-10-22.json";
import terms20260717 from "@/content/legal/terms/2026-07-17.json";
import terms20260904 from "@/content/legal/terms/2026-09-04.json";
import terms20261018 from "@/content/legal/terms/2026-10-18.json";
import terms20261022 from "@/content/legal/terms/2026-10-22.json";

export type LegalDoc = "privacy" | "terms";

/** 처리방침 위탁 사업자 카드(라벨·값 줄). */
export type LegalProcessor = { vendor: string; role: string; rows: readonly (readonly string[])[] };
/** 표(첫 줄이 머리). */
export type LegalTable = { columns: readonly string[]; rows: readonly (readonly string[])[] };
/** 조항 본문 한 덩이: 문단, 사업자 카드, 표. */
export type LegalBlock = string | LegalProcessor | LegalTable;
export type LegalText = {
  title: string;
  description: string;
  sections: readonly { title: string; body: readonly LegalBlock[] }[];
};

/**
 * 이전 판 원문(한국어만). 키는 그 판의 시행일이고, server 동의 버전(`ConsentProperties`)과 같은 날짜 문자열이다.
 * 주소는 `/privacy/<키>`·`/terms/<키>` 로 고정이다 — 키를 바꾸지 않는다.
 *
 * 2026-06-18 판은 넣지 않았다: 이름을 HeyMoa 로 바꾸기 전(진짜그림) 서비스의 문서다. 07-17 이후 판은 git 에서 그 시행일이
 * 화면에 걸려 있던 마지막 커밋의 문장을 그대로 옮겼다(APP-1385). 새 판을 시행하면 그때까지의 본문(`messages/ko/legal.json`)을
 * 여기 한 파일로 얼려 넣는다.
 */
export const LEGAL_ARCHIVE = {
  privacy: {
    "2026-07-17": privacy20260717,
    "2026-09-04": privacy20260904,
    "2026-10-12": privacy20261012,
    "2026-10-18": privacy20261018,
    "2026-10-22": privacy20261022,
  },
  terms: {
    "2026-07-17": terms20260717,
    "2026-09-04": terms20260904,
    "2026-10-18": terms20261018,
    "2026-10-22": terms20261022,
  },
} as const;

/** 오래된 판부터. */
export const archivedVersions = (doc: LegalDoc): string[] =>
  Object.keys(LEGAL_ARCHIVE[doc]).sort();

export const archivedDocument = (doc: LegalDoc, version: string): LegalText | undefined =>
  (LEGAL_ARCHIVE[doc] as Record<string, LegalText>)[version];

const dayBefore = (iso: string) =>
  new Date(Date.parse(iso) - 86_400_000).toISOString().slice(0, 10);

/**
 * 이전 판마다 적용 기간. 다음 판 시행 전날까지이고, 가장 최근 판은 지금 판 시행 전날까지다(지금 판 시행일이 미정이면 끝이 없다).
 * 최근 판이 먼저 온다.
 */
export function versionPeriods(doc: LegalDoc, currentEffective: string | null) {
  const versions = archivedVersions(doc);
  return versions
    .map((version, index) => {
      const next = versions[index + 1] ?? currentEffective;
      return { version, from: version, to: next ? dayBefore(next) : null };
    })
    .reverse();
}
