"use client";

import { useSyncExternalStore } from "react";
import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/fetcher";
import { chunk, BATCH_MAX } from "@/lib/terms/term-bulk";
import {
  applyOps,
  isTempId,
  nextTempId,
  normalizeTerm,
  type RejectReason,
  type Term,
  type TermOp,
} from "@/lib/terms/term-list";

/** 조회 캐시의 모양(생성 응답 `{status, data: 봉투}`). */
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

/** 서버 일괄 추가 응답을 화면이 쓰는 모양으로. */
export type BatchResult = {
  added: Term[];
  existing: Term[];
  rejected: { term: string; reason: RejectReason }[];
};

/** 한 번의 「추가」가 끝난 결과. 편집기가 이것으로 안내 문구를 만든다. */
export type AddManyOutcome = {
  added: number;
  existing: number;
  rejected: { term: string; reason: RejectReason }[];
  /** 네트워크·서버 오류로 못 보낸 용어. 입력란에 돌려놓아 다시 누르게 한다. */
  failed: string[];
};

type Callbacks = {
  onDone?: (outcome: AddManyOutcome) => void;
  /** 하나도 못 넣고 실패했다 — 보낸 용어 전부. */
  onFailed?: (terms: string[]) => void;
};

/**
 * 사전의 진행 중 변경. **컴포넌트 밖에 둔다** — 설정 창을 닫았다 열면 훅이 다시 마운트되는데, `scope` 는 앞 요청을 계속
 * 줄 세우므로 새 훅도 같은 장부를 봐야 확인된 목록과 임시 id 가 어긋나지 않는다.
 */
type Ledger = {
  /** 서버가 확인한 목록. 응답이 올 때마다 고친다. */
  confirmed: Term[];
  /** 아직 응답이 안 온 변경, 누른 차례대로. */
  ops: TermOp[];
  /** 임시 id → 실제 id. 응답 전에 지운 임시 칩의 삭제가 실제 id 로 나가게 한다. */
  resolved: Map<string, string>;
  /** 409·한도 거절처럼 화면과 서버가 달라졌다고 확인됐다 — 줄이 다 빠지면 한 번 다시 받는다. */
  refetch: boolean;
};
const ledgers = new Map<string, Ledger>();
/** 추가 결과를 돌려줄 콜백(첫 임시 id 별). `mutate` 의 호출별 콜백은 연달아 누르면 마지막만 남는다. */
const callbacks = new Map<string, Callbacks>();

/**
 * 서버가 일괄 추가를 아직 모른다고 확인됐는가(배포 전). `false` 면 항목 추가를 직렬로 부른다.
 * 모르면 `null` — 처음 한 번은 일괄로 시도한다.
 */
let batchSupported: boolean | null = null;
/** 시험용. */
export const resetBatchSupport = () => {
  batchSupported = null;
};

/** 직렬 대체 경로의 진행. 「12 / 40 추가 중」. 일괄 API 는 한 번에 끝나 보이지 않는다. */
type Progress = { done: number; total: number };
const progress = new Map<string, Progress>();
const listeners = new Set<() => void>();
const setProgress = (scopeId: string, value: Progress | null) => {
  if (value) progress.set(scopeId, value);
  else progress.delete(scopeId);
  listeners.forEach((listener) => listener());
};
export function useTermProgress(scopeId: string): Progress | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => progress.get(scopeId) ?? null,
    () => null
  );
}

/**
 * 아직 응답이 안 온 변경이 있는가. 있으면 탭을 다시 열어도 목록을 다시 받지 않는다 — 받은 목록이 얹어 둔 칩을 지우고,
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

/** 일괄 추가 경로가 아직 없는 서버의 응답인가 — 405, 또는 앱 오류 코드 없는 404(라우트 없음). */
const isMissingBatchRoute = (error: unknown) =>
  error instanceof ApiError &&
  (error.status === 405 ||
    (error.status === 404 && !/_NOT_FOUND$/.test(error.error.code)));

/**
 * 용어 사전 칩을 **낙관적으로** 더하고 지운다 (APP-1189 · APP-1227).
 *
 * - 누르는 순간 칩이 생기고 사라진다. 응답은 캐시에 직접 쓴다 — `invalidateQueries` 로 다시 받지 않는다.
 * - 추가는 한 번에 여러 개다. 칩마다 임시 id 를 세우고 응답의 항목으로 바꾼다. 서버가 거절한 것(한도·길이)은 칩이 사라진다.
 * - 같은 사전의 요청은 `scope` 로 한 줄에 세운다. 응답이 올 때마다 **확인된 목록 위에 남은 변경을 다시 얹어** 쓰므로
 *   뒤에 서 있는 칩이 깜빡이지 않는다. 실패한 변경은 장부에서 빠지는 것으로 되돌아간다(토스트는 전역 핸들러).
 * - 서버가 일괄 API 를 모르면(배포 전) 항목 추가를 직렬로 부른다 — 진행은 `useTermProgress`.
 */
export function useTermDictionary({
  scopeId,
  queryKey,
  addKey,
  removeKey,
  addOne,
  addBatch,
  removeTerm,
}: {
  scopeId: string;
  queryKey: QueryKey;
  addKey: readonly unknown[];
  removeKey: readonly unknown[];
  addOne: (term: string) => Promise<Term>;
  addBatch: (terms: string[]) => Promise<BatchResult>;
  removeTerm: (termId: string) => Promise<unknown>;
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
    if (ledger.refetch) void queryClient.refetchQueries({ queryKey });
  };

  /** 용어 목록을 서버로 보낸다. 한 개면 항목 추가, 여럿이면 일괄(없으면 직렬). */
  const send = async (terms: string[]) => {
    const entries: Term[] = [];
    const out: AddManyOutcome = {
      added: 0,
      existing: 0,
      rejected: [],
      failed: [],
    };
    let firstError: unknown = null;

    const serial = async (list: string[]) => {
      const total = list.length;
      if (total > 1) setProgress(scopeId, { done: 0, total });
      try {
        for (const [index, term] of list.entries()) {
          if (firstError) {
            out.failed.push(term);
            continue;
          }
          try {
            entries.push(await addOne(term));
            out.added += 1;
          } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
              out.rejected.push({ term, reason: "LIMIT" });
            } else {
              firstError = error;
              out.failed.push(term);
            }
          }
          if (total > 1) setProgress(scopeId, { done: index + 1, total });
        }
      } finally {
        setProgress(scopeId, null);
      }
    };

    if (terms.length === 1 || batchSupported === false) {
      await serial(terms);
    } else {
      for (const part of chunk(terms, BATCH_MAX)) {
        if (firstError) {
          out.failed.push(...part);
          continue;
        }
        if (batchSupported === false) {
          await serial(part);
          continue;
        }
        try {
          const result = await addBatch(part);
          batchSupported = true;
          entries.push(...result.added, ...result.existing);
          out.added += result.added.length;
          out.existing += result.existing.length;
          out.rejected.push(...result.rejected);
        } catch (error) {
          if (isMissingBatchRoute(error)) {
            batchSupported = false;
            await serial(part);
          } else {
            firstError = error;
            out.failed.push(...part);
          }
        }
      }
    }
    // 하나도 못 넣고 실패했다 — 호출한 쪽이 실패로 되돌리고 전역 핸들러가 토스트를 띄운다.
    if (firstError && entries.length === 0 && out.rejected.length === 0)
      throw firstError;
    return { entries, outcome: out };
  };

  const addMany = useMutation({
    mutationKey: addKey,
    scope: { id: scopeId },
    mutationFn: (op: Extract<TermOp, { kind: "addMany" }>) =>
      send(op.items.map((item) => item.term)),
    onMutate: enqueue,
    onError: (_error, op) =>
      callbacks
        .get(op.items[0].tempId)
        ?.onFailed?.(op.items.map((item) => item.term)),
    onSuccess: ({ entries, outcome }, op) => {
      callbacks.get(op.items[0].tempId)?.onDone?.(outcome);
      const ledger = ledgers.get(scopeId);
      if (!ledger) return;
      const byKey = new Map(
        entries.map((item) => [normalizeTerm(item.term), item])
      );
      for (const item of op.items) {
        const found = byKey.get(normalizeTerm(item.term));
        if (found) ledger.resolved.set(item.tempId, found.termId);
      }
      for (const entry of entries) {
        ledger.confirmed = ledger.confirmed.some(
          (term) => term.termId === entry.termId
        )
          ? ledger.confirmed.map((term) =>
              term.termId === entry.termId ? entry : term
            )
          : [...ledger.confirmed, entry];
      }
      // 서버가 한도라고 했다 — 우리가 아는 목록이 낡았다.
      if (outcome.rejected.some((item) => item.reason === "LIMIT"))
        ledger.refetch = true;
    },
    onSettled: (_data, error, op) => {
      callbacks.delete(op.items[0].tempId);
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
    /** 새 용어를 한꺼번에 더한다. 호출한 쪽이 이미 중복·길이·한도를 걸렀다(서버도 다시 거른다). */
    addMany: (terms: string[], handlers: Callbacks = {}) => {
      if (terms.length === 0) return;
      const items = terms.map((term) => ({ tempId: nextTempId(), term }));
      callbacks.set(items[0].tempId, handlers);
      addMany.mutate({ kind: "addMany", items });
    },
    remove: (termId: string) => remove.mutate({ kind: "remove", termId }),
  };
}
