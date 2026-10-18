import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/fetcher";
import type { Term } from "@/lib/terms/term-list";
import {
  resetBatchSupport,
  useTermDictionary,
  type BatchResult,
} from "@/lib/terms/use-term-dictionary";

const KEY = ["/v1/workspaces/W/terms"];
let scope = 0;

function seed(terms: Term[]) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(KEY, {
    status: 200,
    data: { success: true, data: { terms, limit: 200 } },
  });
  return client;
}

const termsOf = (client: QueryClient) =>
  (client.getQueryData(KEY) as { data: { data: { terms: Term[] } } }).data.data
    .terms;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(
  client: QueryClient,
  addOne: (term: string) => Promise<Term>,
  options: {
    addBatch?: (terms: string[]) => Promise<BatchResult>;
    removeTerm?: (termId: string) => Promise<unknown>;
  } = {}
) {
  const scopeId = `test:${(scope += 1)}`;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () =>
      useTermDictionary({
        scopeId,
        queryKey: KEY,
        addKey: ["addWorkspaceTerm"],
        removeKey: ["deleteWorkspaceTerm"],
        addOne,
        addBatch:
          options.addBatch ??
          (async () => {
            throw new Error("일괄을 쓰지 않는 시험");
          }),
        removeTerm: options.removeTerm ?? (async () => undefined),
      }),
    { wrapper }
  );
}

const apiError = (status: number, code: string) =>
  new ApiError(status, { code, message: code, details: null }, null);

beforeEach(resetBatchSupport);

describe("useTermDictionary", () => {
  it("칩을 임시 id 로 먼저 세우고 응답 id 로 바꾸며, 재조회하지 않는다", async () => {
    const client = seed([{ termId: "1", term: "HeyMoa" }]);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const refetch = vi.spyOn(client, "refetchQueries");
    const reply = deferred<Term>();
    const { result } = setup(client, () => reply.promise);

    act(() => result.current.addMany([" MCP "]));
    await waitFor(() =>
      expect(termsOf(client).map((t) => t.term)).toEqual(["HeyMoa", "MCP"])
    );
    expect(termsOf(client)[1].termId).toMatch(/^temp:/);

    await act(async () => reply.resolve({ termId: "2", term: "MCP" }));
    await waitFor(() => expect(termsOf(client)[1].termId).toBe("2"));
    expect(invalidate).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });

  it("여러 개는 일괄 한 번으로 보내고 칩을 한꺼번에 세운 뒤 응답 id 로 바꾼다", async () => {
    const client = seed([]);
    const reply = deferred<BatchResult>();
    const addBatch = vi.fn(() => reply.promise);
    const { result } = setup(
      client,
      async () => {
        throw new Error("항목 추가는 부르지 않는다");
      },
      { addBatch }
    );
    const done = vi.fn();

    act(() =>
      result.current.addMany(["kubernetes", "k8s", "헬름 차트"], {
        onDone: done,
      })
    );
    await waitFor(() => expect(termsOf(client)).toHaveLength(3));
    expect(addBatch).toHaveBeenCalledTimes(1);
    expect(addBatch).toHaveBeenCalledWith(["kubernetes", "k8s", "헬름 차트"]);

    await act(async () =>
      reply.resolve({
        added: [
          { termId: "a", term: "kubernetes" },
          { termId: "b", term: "k8s" },
        ],
        existing: [],
        rejected: [{ term: "헬름 차트", reason: "LIMIT" }],
      })
    );
    // 거절된 칩은 빠지고, 나머지는 실제 id 를 받는다
    await waitFor(() =>
      expect(termsOf(client).map((t) => t.termId)).toEqual(["a", "b"])
    );
    expect(done).toHaveBeenCalledWith({
      added: 2,
      existing: 0,
      rejected: [{ term: "헬름 차트", reason: "LIMIT" }],
      failed: [],
    });
  });

  it("100개를 넘으면 100개씩 나눠 보낸다", async () => {
    const client = seed([]);
    const addBatch = vi.fn(
      async (terms: string[]): Promise<BatchResult> => ({
        added: terms.map((term) => ({ termId: `id-${term}`, term })),
        existing: [],
        rejected: [],
      })
    );
    const { result } = setup(
      client,
      async () => {
        throw new Error("x");
      },
      { addBatch }
    );
    const terms = Array.from({ length: 150 }, (_, i) => `용어${i}`);
    act(() => result.current.addMany(terms));
    await waitFor(() => expect(addBatch).toHaveBeenCalledTimes(2));
    expect(addBatch.mock.calls.map(([part]) => part.length)).toEqual([100, 50]);
    await waitFor(() => expect(termsOf(client)[0].termId).toBe("id-용어0"));
    expect(termsOf(client)).toHaveLength(150);
  });

  it("서버가 일괄을 모르면(404/405) 항목 추가를 직렬로 부르고 다음부터는 일괄을 시도하지 않는다", async () => {
    const client = seed([]);
    const addBatch = vi.fn(async (): Promise<BatchResult> => {
      throw apiError(404, "NOT_FOUND");
    });
    const calls: string[] = [];
    const { result } = setup(
      client,
      async (term) => {
        calls.push(term);
        return { termId: `id-${term}`, term };
      },
      { addBatch }
    );
    act(() => result.current.addMany(["A", "B", "C"]));
    await waitFor(() => expect(calls).toEqual(["A", "B", "C"]));
    await waitFor(() =>
      expect(termsOf(client).map((t) => t.termId)).toEqual([
        "id-A",
        "id-B",
        "id-C",
      ])
    );
    act(() => result.current.addMany(["D", "E"]));
    await waitFor(() => expect(calls).toEqual(["A", "B", "C", "D", "E"]));
    expect(addBatch).toHaveBeenCalledTimes(1);
  });

  it("직렬 도중 실패하면 실패한 것만 돌려주고 성공한 것은 남긴다", async () => {
    const client = seed([]);
    const addBatch = vi.fn(async (): Promise<BatchResult> => {
      throw apiError(405, "METHOD_NOT_ALLOWED");
    });
    const done = vi.fn();
    const { result } = setup(
      client,
      async (term) => {
        if (term === "B") throw apiError(500, "INTERNAL_ERROR");
        return { termId: `id-${term}`, term };
      },
      { addBatch }
    );
    act(() => result.current.addMany(["A", "B", "C"], { onDone: done }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(done.mock.calls[0][0]).toMatchObject({
      added: 1,
      failed: ["B", "C"],
    });
    await waitFor(() =>
      expect(termsOf(client)).toEqual([{ termId: "id-A", term: "A" }])
    );
  });

  it("하나도 못 넣고 실패하면 칩을 되돌리고 실패 콜백으로 보낸 용어를 돌려준다", async () => {
    const client = seed([]);
    const failed = vi.fn();
    const { result } = setup(
      client,
      async () => {
        throw new Error("x");
      },
      {
        addBatch: async () => {
          throw apiError(500, "INTERNAL_ERROR");
        },
      }
    );
    act(() => result.current.addMany(["A", "B"], { onFailed: failed }));
    await waitFor(() => expect(failed).toHaveBeenCalledWith(["A", "B"]));
    expect(termsOf(client)).toHaveLength(0);
  });

  it("요청을 한 줄로 보내고, 실패한 추가만 되돌리며 뒤의 칩은 깜빡이지 않는다", async () => {
    const client = seed([]);
    const calls: string[] = [];
    const replies = [deferred<Term>(), deferred<Term>()];
    const { result } = setup(client, (term) => {
      calls.push(term);
      return replies[calls.length - 1].promise;
    });

    act(() => {
      result.current.addMany(["A"]);
      result.current.addMany(["B"]);
    });
    await waitFor(() => expect(termsOf(client)).toHaveLength(2));
    // 앞 요청이 끝나기 전에 뒤 요청은 나가지 않는다
    expect(calls).toEqual(["A"]);

    await act(async () => replies[0].reject(new Error("boom")));
    await waitFor(() => expect(calls).toEqual(["A", "B"]));
    expect(termsOf(client).map((t) => t.term)).toEqual(["B"]);

    await act(async () => replies[1].resolve({ termId: "b", term: "B" }));
    await waitFor(() =>
      expect(termsOf(client)).toEqual([{ termId: "b", term: "B" }])
    );
  });

  it("응답 전에 지운 칩은 응답의 실제 id 로 지운다", async () => {
    const client = seed([]);
    const reply = deferred<Term>();
    const removeTerm = vi.fn(async () => undefined);
    const { result } = setup(client, () => reply.promise, { removeTerm });

    act(() => result.current.addMany(["A"]));
    await waitFor(() => expect(termsOf(client)).toHaveLength(1));
    act(() => result.current.remove(termsOf(client)[0].termId));
    await waitFor(() => expect(termsOf(client)).toHaveLength(0));

    await act(async () => reply.resolve({ termId: "real", term: "A" }));
    await waitFor(() => expect(removeTerm).toHaveBeenCalledWith("real"));
    expect(termsOf(client)).toHaveLength(0);
  });

  it("이미 있던 항목을 돌려주면 하나로 합친다", async () => {
    const client = seed([{ termId: "1", term: "MCP" }]);
    const { result } = setup(client, async () => ({
      termId: "1",
      term: "MCP",
    }));
    act(() => result.current.addMany(["mcp"]));
    await waitFor(() =>
      expect(termsOf(client)).toEqual([{ termId: "1", term: "MCP" }])
    );
  });

  it("한도 거절(409·LIMIT)이면 줄이 빈 뒤 한 번만 다시 받는다", async () => {
    const client = seed([]);
    const refetch = vi
      .spyOn(client, "refetchQueries")
      .mockResolvedValue(undefined);
    const { result } = setup(client, async () => {
      throw apiError(409, "TERM_LIMIT_EXCEEDED");
    });
    const done = vi.fn();
    act(() => result.current.addMany(["A"], { onDone: done }));
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    expect(done).toHaveBeenCalledWith({
      added: 0,
      existing: 0,
      rejected: [{ term: "A", reason: "LIMIT" }],
      failed: [],
    });
    expect(termsOf(client)).toHaveLength(0);
  });
});
