import privacy20260717 from "@/content/legal/privacy/2026-07-17.json";
import privacy20260904 from "@/content/legal/privacy/2026-09-04.json";
import privacy20261012 from "@/content/legal/privacy/2026-10-12.json";
import privacy20261018 from "@/content/legal/privacy/2026-10-18.json";
import privacy20261022 from "@/content/legal/privacy/2026-10-22.json";
import privacy20261103 from "@/content/legal/privacy/2026-11-03.json";
import privacy20261023 from "@/content/legal/privacy/2026-10-23.json";
import terms20260717 from "@/content/legal/terms/2026-07-17.json";
import terms20260904 from "@/content/legal/terms/2026-09-04.json";
import terms20261018 from "@/content/legal/terms/2026-10-18.json";
import terms20261022 from "@/content/legal/terms/2026-10-22.json";
import terms20261023 from "@/content/legal/terms/2026-10-23.json";

export type LegalDoc = "privacy" | "terms";

export type LegalProcessor = { vendor: string; role: string; rows: readonly (readonly string[])[] };
export type LegalTable = { columns: readonly string[]; rows: readonly (readonly string[])[] };
export type LegalBlock = string | LegalProcessor | LegalTable;
type LegalText = {
  title: string;
  description: string;
  sections: readonly { title: string; body: readonly LegalBlock[] }[];
};

const LEGAL_ARCHIVE = {
  privacy: {
    "2026-07-17": privacy20260717,
    "2026-09-04": privacy20260904,
    "2026-10-12": privacy20261012,
    "2026-10-18": privacy20261018,
    "2026-10-22": privacy20261022,
    "2026-11-03": privacy20261103,
    "2026-10-23": privacy20261023,
  },
  terms: {
    "2026-07-17": terms20260717,
    "2026-09-04": terms20260904,
    "2026-10-18": terms20261018,
    "2026-10-22": terms20261022,
    "2026-10-23": terms20261023,
  },
} as const;

export const archivedVersions = (doc: LegalDoc): string[] =>
  Object.keys(LEGAL_ARCHIVE[doc]).sort();

export const archivedDocument = (doc: LegalDoc, version: string): LegalText | undefined =>
  (LEGAL_ARCHIVE[doc] as Record<string, LegalText>)[version];

const dayBefore = (iso: string) =>
  new Date(Date.parse(iso) - 86_400_000).toISOString().slice(0, 10);

export function versionPeriods(doc: LegalDoc, currentEffective: string | null) {
  const versions = archivedVersions(doc);
  return versions
    .map((version, index) => {
      const next = versions[index + 1] ?? currentEffective;
      return { version, from: version, to: next ? dayBefore(next) : null };
    })
    .reverse();
}
