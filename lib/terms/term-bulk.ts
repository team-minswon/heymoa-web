import {
  TERM_MAX_LENGTH,
  cleanTerm,
  normalizeTerm,
  type Term,
} from "@/lib/terms/term-list";

export const BATCH_MAX = 100;

const SEPARATORS = /[,;\t\r\n、，；]+/;

export function splitTerms(text: string): string[] {
  return text
    .split(SEPARATORS)
    .map(cleanTerm)
    .filter((term) => term !== "");
}

export type PlanStatus = "fresh" | "duplicate" | "tooLong" | "overLimit";

export type BulkPlan = {
  items: { term: string; status: PlanStatus }[];
  total: number;
  fresh: string[];
  duplicates: string[];
  tooLong: string[];
  overLimit: string[];
};

export function planBulk({
  text,
  terms,
  limit,
}: {
  text: string;
  terms: readonly Term[];
  limit: number;
}): BulkPlan {
  const parts = splitTerms(text);
  const seen = new Set(terms.map((item) => normalizeTerm(item.term)));
  const plan: BulkPlan = {
    items: [],
    total: parts.length,
    fresh: [],
    duplicates: [],
    tooLong: [],
    overLimit: [],
  };
  const room = Math.max(0, limit - terms.length);
  for (const term of parts) {
    // 서버는 UTF-16 코드 유닛 수로 잽니다. JS `length` 도 같습니다(이모지 하나는 2).
    if (term.length > TERM_MAX_LENGTH) {
      plan.tooLong.push(term);
      plan.items.push({ term, status: "tooLong" });
      continue;
    }
    const key = normalizeTerm(term);
    if (seen.has(key)) {
      plan.duplicates.push(term);
      plan.items.push({ term, status: "duplicate" });
      continue;
    }
    seen.add(key);
    if (plan.fresh.length >= room) {
      plan.overLimit.push(term);
      plan.items.push({ term, status: "overLimit" });
    } else {
      plan.fresh.push(term);
      plan.items.push({ term, status: "fresh" });
    }
  }
  return plan;
}

export type SummaryPart = {
  key: "fresh" | "duplicates" | "tooLong" | "overLimit";
  count: number;
  tone: "ink" | "muted" | "warn";
};

export function summaryParts(plan: BulkPlan): SummaryPart[] {
  const parts: SummaryPart[] = [];
  if (plan.fresh.length > 0)
    parts.push({
      key: "fresh",
      count: plan.fresh.length,
      tone: "ink",
    });
  if (plan.duplicates.length > 0)
    parts.push({
      key: "duplicates",
      count: plan.duplicates.length,
      tone: "muted",
    });
  if (plan.tooLong.length > 0)
    parts.push({
      key: "tooLong",
      count: plan.tooLong.length,
      tone: "warn",
    });
  if (plan.overLimit.length > 0)
    parts.push({
      key: "overLimit",
      count: plan.overLimit.length,
      tone: "warn",
    });
  return parts;
}

export function chunk<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
