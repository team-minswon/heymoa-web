/**
 * 용어 사전의 순수 규칙 (APP-1189). 서버와 같은 기준으로 같은 용어를 가른다 — 대소문자와 앞뒤 공백을 무시한다.
 */
export const TERM_MAX_LENGTH = 40;

export type Term = { termId: string; term: string; inWorkspace?: boolean };

export const normalizeTerm = (term: string) => term.trim().toLowerCase();

/** 낙관적으로 얹은 변경. 추가는 임시 id 로 칩을 세우고, 응답이 오면 그 id 를 실제 값으로 바꾼다. */
export type TermOp =
  | { kind: "add"; tempId: string; term: string }
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
    if (op.kind === "add") {
      const key = normalizeTerm(op.term);
      if (list.some((item) => normalizeTerm(item.term) === key)) continue;
      list.push({ termId: op.tempId, term: op.term.trim() });
    } else {
      const target = resolved.get(op.termId) ?? op.termId;
      list = list.filter(
        (item) => item.termId !== target && item.termId !== op.termId
      );
    }
  }
  return list;
}

/**
 * 붙여 넣은 글을 용어로 나눈다. 줄마다 하나, 빈 줄과 같은 용어는 뺀다. 40자를 넘는 줄은 서버가 거절하므로 보내지
 * 않고 개수만 돌려준다 — 화면이 「n줄은 40자를 넘어 뺐어요」로 알린다.
 */
export function splitPastedTerms(text: string, existing: readonly Term[]) {
  const seen = new Set(existing.map((item) => normalizeTerm(item.term)));
  const terms: string[] = [];
  let tooLong = 0;
  let duplicates = 0;
  for (const line of text.split(/\r?\n/)) {
    const term = line.trim();
    if (!term) continue;
    if (term.length > TERM_MAX_LENGTH) {
      tooLong += 1;
      continue;
    }
    const key = normalizeTerm(term);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    terms.push(term);
  }
  return { terms, tooLong, duplicates };
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
