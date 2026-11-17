export const TERM_MAX_LENGTH = 40;

export type Term = { termId: string; term: string };

export type RejectReason = "LIMIT" | "TOO_LONG" | "BLANK";

export const cleanTerm = (term: string) => term.replace(/\s+/g, " ").trim();

/** 서버 `TermText.key` 와 같이 대문자로 접은 뒤 소문자로 바꿔 Σ·σ·ς 도 하나로 봅니다. */
export const normalizeTerm = (term: string) =>
  cleanTerm(term).toUpperCase().toLowerCase();

export type TermOp =
  | { kind: "add"; tempId: string; term: string }
  | { kind: "addMany"; items: { tempId: string; term: string }[] }
  | { kind: "remove"; termId: string };

const TEMP_PREFIX = "temp:";
let tempCounter = 0;
export const nextTempId = () => `${TEMP_PREFIX}${(tempCounter += 1)}`;
export const isTempId = (termId: string) => termId.startsWith(TEMP_PREFIX);

export function applyOps(
  confirmed: readonly Term[],
  ops: readonly TermOp[],
  resolved: ReadonlyMap<string, string>
): Term[] {
  let list = [...confirmed];
  for (const op of ops) {
    if (op.kind === "add" || op.kind === "addMany") {
      const items =
        op.kind === "add" ? [{ tempId: op.tempId, term: op.term }] : op.items;
      const keys = new Set(list.map((item) => normalizeTerm(item.term)));
      for (const item of items) {
        const key = normalizeTerm(item.term);
        if (keys.has(key)) continue;
        keys.add(key);
        list.push({ termId: item.tempId, term: cleanTerm(item.term) });
      }
    } else {
      const target = resolved.get(op.termId) ?? op.termId;
      list = list.filter(
        (item) => item.termId !== target && item.termId !== op.termId
      );
    }
  }
  return list;
}

export function termOfResponse(
  response: {
    status: number;
    data: { success: boolean; data?: Term | null };
  },
  failed: string
): Term {
  if (
    (response.status === 200 || response.status === 201) &&
    response.data.success &&
    response.data.data
  )
    return response.data.data;
  throw new Error(failed);
}

export const termQueryOptions = (busy: () => boolean) =>
  ({
    refetchOnMount: () => (busy() ? false : "always"),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  }) as const;
