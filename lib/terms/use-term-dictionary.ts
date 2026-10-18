"use client";

import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/fetcher";
import {
  applyOps,
  isTempId,
  nextTempId,
  type Term,
  type TermOp,
} from "@/lib/terms/term-list";

/** 조회 캐시의 모양(생성 응답 `{status, data: 봉투}`). 두 사전이 같다. */
type TermListCache = {
  status: number;
  data: {
    success: boolean;
    data?: { terms: Term[]; limit: number } | null;
  };
};

export const termsOfCache = (cache: unknown): Term[] | undefined => {
  const value = cache as TermListCache | undefined;
  return value?.status === 200 && value.data.success
    ? value.data.data?.terms
    : undefined;
};

/**
 * 사전 하나의 진행 중 변경. **컴포넌트 밖에 둔다** — 창을 닫았다 열거나 설정 탭을 오가면 훅이 다시 마운트되는데,
 * `scope` 는 앞 요청을 계속 줄 세우므로 새 훅도 같은 장부를 봐야 확인된 목록과 임시 id 가 어긋나지 않는다.
 */
type Ledger = {
  /** 서버가 확인한 목록. 응답이 올 때마다 고친다. */
  confirmed: Term[];
  /** 아직 응답이 안 온 변경, 누른 차례대로. */
  ops: TermOp[];
  /** 임시 id → 실제 id. 응답 전에 지운 임시 칩의 삭제가 실제 id 로 나가게 한다. */
  resolved: Map<string, string>;
  /** 409 처럼 화면과 서버가 달라졌다고 확인됐다 — 줄이 다 빠지면 한 번 다시 받는다. */
  refetch: boolean;
};
const ledgers = new Map<string, Ledger>();
/**
 * 추가가 실패했을 때 입력란에 돌려놓을 콜백(임시 id 별). `mutate` 의 호출별 `onError` 는 연달아 누르면 마지막
 * 호출만 남아 앞선 실패가 조용히 사라진다 — 훅 수준 `onError` 가 여기서 꺼내 부른다.
 */
const failCallbacks = new Map<string, (term: string) => void>();

/**
 * 아직 응답이 안 온 변경이 있는가. 있으면 창을 다시 열어도 목록을 다시 받지 않는다 — 받은 목록이 얹어 둔 칩을 지우고,
 * 뒤이은 응답은 그 목록을 모르는 장부로 캐시를 덮는다. 줄이 다 빠지면 다음 열기부터 다시 받는다.
 */
export const isDictionaryBusy = (scopeId: string) =>
  (ledgers.get(scopeId)?.ops.length ?? 0) > 0;

function write(queryClient: QueryClient, queryKey: QueryKey, terms: Term[]) {
  queryClient.setQueryData<TermListCache>(queryKey, (old) =>
    old && old.status === 200 && old.data.success && old.data.data
      ? { ...old, data: { ...old.data, data: { ...old.data.data, terms } } }
      : old
  );
}

/**
 * 용어 사전 칩을 **낙관적으로** 더하고 지운다 (APP-1189).
 *
 * - 누르는 순간 칩이 생기고 사라진다. 응답은 캐시에 직접 쓴다 — `invalidateQueries` 로 다시 받지 않는다.
 * - 추가는 임시 id 칩을 먼저 세우고 응답의 항목으로 바꾼다. 서버가 이미 있던 항목을 돌려주면(200) 그 항목으로 합친다.
 * - 같은 사전의 요청은 `scope` 로 한 줄에 세운다. 응답이 올 때마다 **확인된 목록 위에 남은 변경을 다시 얹어** 쓰므로
 *   뒤에 서 있는 칩이 깜빡이지 않는다. 실패한 변경은 장부에서 빠지는 것으로 되돌아간다(토스트는 전역 핸들러).
 * - 다시 받는 것은 409 로 서버와 달라졌다고 확인된 때, 줄이 다 빠진 뒤 한 번뿐이다.
 */
export function useTermDictionary({
  scopeId,
  queryKey,
  addKey,
  removeKey,
  addTerm,
  removeTerm,
  conflictRefetch = [],
}: {
  /** 사전 하나를 가리키는 값. 요청 줄과 장부가 이것으로 갈린다. */
  scopeId: string;
  queryKey: QueryKey;
  addKey: readonly unknown[];
  removeKey: readonly unknown[];
  addTerm: (term: string) => Promise<Term>;
  removeTerm: (termId: string) => Promise<unknown>;
  /**
   * 409 때 이 사전과 함께 다시 받을 다른 사전(프로젝트 쪽: 중복 판단에 쓰는 워크스페이스 사전). 그 사전에 진행 중인
   * 변경이 있으면 지금 받지 않고 그 줄이 빈 뒤에 받게 맡긴다 — 받은 목록이 얹어 둔 칩을 지우지 않게.
   */
  conflictRefetch?: { scopeId: string; queryKey: QueryKey }[];
}) {
  const queryClient = useQueryClient();

  const ledgerOf = () => {
    let ledger = ledgers.get(scopeId);
    if (!ledger) {
      ledger = {
        confirmed: termsOfCache(queryClient.getQueryData(queryKey)) ?? [],
        ops: [],
        resolved: new Map(),
        refetch: false,
      };
      ledgers.set(scopeId, ledger);
    }
    return ledger;
  };

  const render = (ledger: Ledger) =>
    write(
      queryClient,
      queryKey,
      applyOps(ledger.confirmed, ledger.ops, ledger.resolved)
    );

  const enqueue = async (op: TermOp) => {
    const ledger = ledgerOf();
    // 차례는 누른 순간에 정한다 — 아래 await 뒤에 넣으면 연달아 누른 것끼리 순서가 섞일 수 있다.
    ledger.ops.push(op);
    // 떠 있던 조회가 늦게 도착해 얹은 칩을 덮지 않게 끊는다. 끊긴 조회는 캐시를 그 전 값으로 되돌리므로
    // 그 뒤에 쓴다.
    await queryClient.cancelQueries({ queryKey });
    render(ledger);
  };

  const settle = (op: TermOp, error: unknown) => {
    const ledger = ledgers.get(scopeId);
    if (!ledger) return;
    if (error instanceof ApiError && error.status === 409)
      ledger.refetch = true;
    ledger.ops = ledger.ops.filter((item) => item !== op);
    render(ledger);
    if (ledger.ops.length > 0) return;
    ledgers.delete(scopeId);
    if (!ledger.refetch) return;
    void queryClient.refetchQueries({ queryKey });
    for (const other of conflictRefetch) {
      const busy = ledgers.get(other.scopeId);
      if (busy && busy.ops.length > 0) busy.refetch = true;
      else void queryClient.refetchQueries({ queryKey: other.queryKey });
    }
  };

  const add = useMutation({
    mutationKey: addKey,
    scope: { id: scopeId },
    mutationFn: (op: Extract<TermOp, { kind: "add" }>) => addTerm(op.term),
    onMutate: enqueue,
    onError: (_error, op) => failCallbacks.get(op.tempId)?.(op.term),
    onSuccess: (item, op) => {
      const ledger = ledgers.get(scopeId);
      if (!ledger) return;
      ledger.resolved.set(op.tempId, item.termId);
      ledger.confirmed = ledger.confirmed.some(
        (term) => term.termId === item.termId
      )
        ? ledger.confirmed.map((term) =>
            term.termId === item.termId ? item : term
          )
        : [...ledger.confirmed, item];
    },
    onSettled: (_data, error, op) => {
      failCallbacks.delete(op.tempId);
      settle(op, error);
    },
  });

  const remove = useMutation({
    mutationKey: removeKey,
    scope: { id: scopeId },
    mutationFn: async (op: Extract<TermOp, { kind: "remove" }>) => {
      const termId = ledgers.get(scopeId)?.resolved.get(op.termId) ?? op.termId;
      // 응답 전에 지운 칩의 추가가 실패했다 — 서버에 없는 것이라 보낼 것이 없다.
      if (isTempId(termId)) return termId;
      await removeTerm(termId);
      return termId;
    },
    onMutate: enqueue,
    onSuccess: (termId) => {
      const ledger = ledgers.get(scopeId);
      if (!ledger) return;
      ledger.confirmed = ledger.confirmed.filter(
        (term) => term.termId !== termId
      );
    },
    onSettled: (_data, error, op) => settle(op, error),
  });

  return {
    add: (term: string, onFailed?: (term: string) => void) =>
      add.mutate(
        (() => {
          const tempId = nextTempId();
          if (onFailed) failCallbacks.set(tempId, onFailed);
          return { kind: "add" as const, tempId, term: term.trim() };
        })()
      ),
    remove: (termId: string) => remove.mutate({ kind: "remove", termId }),
  };
}
