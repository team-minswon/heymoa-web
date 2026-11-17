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

export type BatchResult = {
  added: Term[];
  existing: Term[];
  rejected: { term: string; reason: RejectReason }[];
};

export type AddManyOutcome = {
  added: number;
  existing: number;
  rejected: { term: string; reason: RejectReason }[];
  failed: string[];
};

type Callbacks = {
  onDone?: (outcome: AddManyOutcome) => void;
  onFailed?: (terms: string[]) => void;
};

type Ledger = {
  confirmed: Term[];
  ops: TermOp[];
  resolved: Map<string, string>;
  refetch: boolean;
};
const ledgers = new Map<string, Ledger>();
/** `mutate` 의 호출별 콜백은 연달아 누르면 마지막만 남아 첫 임시 id 별로 따로 둡니다. */
const callbacks = new Map<string, Callbacks>();

let batchSupported: boolean | null = null;
export const resetBatchSupport = () => {
  batchSupported = null;
};

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

export const isDictionaryBusy = (scopeId: string) =>
  (ledgers.get(scopeId)?.ops.length ?? 0) > 0;

function write(queryClient: QueryClient, queryKey: QueryKey, terms: Term[]) {
  queryClient.setQueryData<TermListCache>(queryKey, (old) =>
    old && old.status === 200 && old.data.success && old.data.data
      ? { ...old, data: { ...old.data, data: { ...old.data.data, terms } } }
      : old
  );
}

const isMissingBatchRoute = (error: unknown) =>
  error instanceof ApiError &&
  (error.status === 405 ||
    (error.status === 404 && !/_NOT_FOUND$/.test(error.error.code)));

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
    ledger.ops.push(op);
    // 끊긴 조회는 캐시를 그 전 값으로 되돌리므로 캐시 쓰기는 이 뒤에 합니다.
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
    addMany: (terms: string[], handlers: Callbacks = {}) => {
      if (terms.length === 0) return;
      const items = terms.map((term) => ({ tempId: nextTempId(), term }));
      callbacks.set(items[0].tempId, handlers);
      addMany.mutate({ kind: "addMany", items });
    },
    remove: (termId: string) => remove.mutate({ kind: "remove", termId }),
  };
}
