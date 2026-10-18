import {
  TERM_MAX_LENGTH,
  cleanTerm,
  normalizeTerm,
  type Term,
} from "@/lib/terms/term-list";

/** 서버 일괄 추가가 한 번에 받는 최대 개수. 이보다 많으면 나눠 보낸다. */
export const BATCH_MAX = 100;

/** 용어를 가르는 글자: 쉼표 · 세미콜론 · 탭 · 줄바꿈(전각 쉼표·세미콜론 포함). 용어 안에 쓰는 글자가 아니다. */
const SEPARATORS = /[,;\t\r\n、，；]+/;

/** 입력 글을 용어 조각으로 나눈다. 안쪽 공백은 한 칸으로, 빈 조각은 뺀다. 중복은 그대로 둔다 — 세는 쪽이 가른다. */
export function splitTerms(text: string): string[] {
  return text
    .split(SEPARATORS)
    .map(cleanTerm)
    .filter((term) => term !== "");
}

export type PlanStatus = "fresh" | "duplicate" | "tooLong" | "overLimit";

export type BulkPlan = {
  /** 입력 순서 그대로 항목마다 판정. 미리보기 칩이 이것을 그린다. */
  items: { term: string; status: PlanStatus }[];
  /** 입력의 용어 조각 수(중복 포함). 0이면 미리보기를 그리지 않는다. */
  total: number;
  /** 실제로 넣을 새 용어. 입력 순서. */
  fresh: string[];
  /** 이미 사전에 있거나 입력 안에서 앞에 같은 용어가 있다. */
  duplicates: string[];
  /** 40자를 넘어 제외. */
  tooLong: string[];
  /** 한도를 채워 못 넣는 새 용어. */
  overLimit: string[];
};

/**
 * 입력 글 하나를 항목마다 가른다. 서버 일괄 추가와 같은 차례다 — 길이 → 중복(이 사전 · 입력 안) → 한도.
 * 판단은 받아 둔 목록(캐시)만 본다.
 */
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
    // 서버는 UTF-16 코드 유닛 수로 잰다 — JS `length` 도 같다(이모지 하나는 2).
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
  text: string;
  /** warn 은 사용자가 고쳐야 할 것(잘리거나 못 들어가는 것), 나머지는 담담히. */
  tone: "ink" | "muted" | "warn";
};

/** 미리보기 요약. 0인 항목은 말하지 않는다 — 「새로 n개 · 이미 있어요 m개 · …」. */
export function summaryParts(plan: BulkPlan): SummaryPart[] {
  const parts: SummaryPart[] = [];
  if (plan.fresh.length > 0)
    parts.push({
      key: "fresh",
      text: `새로 ${plan.fresh.length}개`,
      tone: "ink",
    });
  if (plan.duplicates.length > 0)
    parts.push({
      key: "duplicates",
      text: `이미 있어요 ${plan.duplicates.length}개`,
      tone: "muted",
    });
  if (plan.tooLong.length > 0)
    parts.push({
      key: "tooLong",
      text: `${TERM_MAX_LENGTH}자를 넘어 제외 ${plan.tooLong.length}개`,
      tone: "warn",
    });
  if (plan.overLimit.length > 0)
    parts.push({
      key: "overLimit",
      text: `한도를 넘어 못 넣어요 ${plan.overLimit.length}개`,
      tone: "warn",
    });
  return parts;
}

/** 목록을 n개씩 나눈다. */
export function chunk<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
