/**
 * 용어 사전의 순수 규칙 (APP-1189). 서버와 같은 기준으로 같은 용어를 가른다 — 대소문자와 앞뒤 공백을 무시한다.
 */
export const TERM_MAX_LENGTH = 40;

export type Term = { termId: string; term: string };

/** 일괄 추가에서 서버가 항목마다 돌려주는 거절 사유. */
export type RejectReason = "LIMIT" | "TOO_LONG" | "BLANK";

/** 한 용어의 모양: 앞뒤 공백을 지우고 안쪽 공백·줄바꿈은 한 칸으로. 보낼 때와 비교할 때 모두 이것을 쓴다. */
export const cleanTerm = (term: string) => term.replace(/\s+/g, " ").trim();

/** 같은 용어인지 가르는 키. 서버 `TermText.key` 와 같이 대문자로 접은 뒤 소문자로 바꿔 Σ·σ·ς 도 하나로 본다. */
export const normalizeTerm = (term: string) =>
  cleanTerm(term).toUpperCase().toLowerCase();

/** 낙관적으로 얹은 변경. 추가는 임시 id 로 칩을 세우고, 응답이 오면 그 id 를 실제 값으로 바꾼다. */
export type TermOp =
  | { kind: "add"; tempId: string; term: string }
  /** 여러 개를 한 번에. 칩은 항목마다 임시 id 를 가지고 응답으로 실제 id 를 받는다. */
  | { kind: "addMany"; items: { tempId: string; term: string }[] }
  | { kind: "remove"; termId: string };

const TEMP_PREFIX = "temp:";
let tempCounter = 0;
export const nextTempId = () => `${TEMP_PREFIX}${(tempCounter += 1)}`;
export const isTempId = (termId: string) => termId.startsWith(TEMP_PREFIX);

/**
 * 서버가 확인한 목록 위에 아직 응답이 안 온 변경을 차례로 얹는다. 응답이 올 때마다 확인된 목록이 바뀌고 이 함수로
 * 다시 얹으므로, 뒤에 서 있는 변경이 잠깐 사라졌다 돌아오는 깜빡임이 없다.
 *
 * `resolved` 는 임시 id → 실제 id. 아직 응답이 안 온 추가 칩을 지우면 그 삭제는 임시 id 를 들고 있다.
 */
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

/** 추가 응답(200 이미 있음 · 201 새로)에서 항목을 꺼낸다. 비-2xx 는 `apiFetch` 가 이미 던졌다. */
export function termOfResponse(response: {
  status: number;
  data: { success: boolean; data?: Term | null };
}): Term {
  if (
    (response.status === 200 || response.status === 201) &&
    response.data.success &&
    response.data.data
  )
    return response.data.data;
  throw new Error("용어를 더하지 못했습니다.");
}

/** 조회는 창(탭)을 열 때 한 번이다. 열려 있는 동안 포커스·재연결로 다시 받지 않는다 — 다른 멤버의 편집은 다음에 열 때 보인다. */
export const termQueryOptions = (busy: () => boolean) =>
  ({
    refetchOnMount: () => (busy() ? false : "always"),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  }) as const;
