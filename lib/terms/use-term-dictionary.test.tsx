import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/fetcher";
import type { Term } from "@/lib/terms/term-list";
import { useTermDictionary } from "@/lib/terms/use-term-dictionary";

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
  addTerm: (term: string) => Promise<Term>,
  removeTerm: (termId: string) => Promise<unknown> = async () => undefined
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
        addTerm,
        removeTerm,
      }),
    { wrapper }
  );
}

describe("useTermDictionary", () => {
  it("칩을 임시 id 로 먼저 세우고 응답 id 로 바꾸며, 재조회하지 않는다", async () => {
    const client = seed([{ termId: "1", term: "HeyMoa" }]);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const refetch = vi.spyOn(client, "refetchQueries");
    const reply = deferred<Term>();
    const { result } = setup(client, () => reply.promise);

    act(() => result.current.add(" MCP "));
    await waitFor(() =>
      expect(termsOf(client).map((t) => t.term)).toEqual(["HeyMoa", "MCP"])
    );
    expect(termsOf(client)[1].termId).toMatch(/^temp:/);

    await act(async () => reply.resolve({ termId: "2", term: "MCP" }));
    await waitFor(() => expect(termsOf(client)[1].termId).toBe("2"));
    expect(invalidate).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
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
      result.current.add("A");
      result.current.add("B");
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
    const { result } = setup(client, () => reply.promise, removeTerm);

    act(() => result.current.add("A"));
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
    act(() => result.current.add("mcp"));
    await waitFor(() =>
      expect(termsOf(client)).toEqual([{ termId: "1", term: "MCP" }])
    );
  });

  it("409 면 줄이 빈 뒤 한 번만 다시 받는다", async () => {
    const client = seed([]);
    const refetch = vi
      .spyOn(client, "refetchQueries")
      .mockResolvedValue(undefined);
    const conflict = new ApiError(
      409,
      { code: "TERM_LIMIT_EXCEEDED", message: "한도", details: null },
      null
    );
    const { result } = setup(client, async () => {
      throw conflict;
    });
    act(() => result.current.add("A"));
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    expect(termsOf(client)).toHaveLength(0);
  });
});

describe("useTermDictionary 실패 콜백", () => {
  it("연달아 더하다 앞 것만 실패해도 그 용어를 돌려준다", async () => {
    const client = seed([]);
    const replies = [deferred<Term>(), deferred<Term>()];
    let call = 0;
    const { result } = setup(client, () => replies[call++].promise);
    const failed: string[] = [];
    act(() => {
      result.current.add("A", (term) => failed.push(term));
      result.current.add("B", (term) => failed.push(term));
    });
    await act(async () => replies[0].reject(new Error("boom")));
    await waitFor(() => expect(failed).toEqual(["A"]));
    await act(async () => replies[1].resolve({ termId: "b", term: "B" }));
    await waitFor(() =>
      expect(termsOf(client)).toEqual([{ termId: "b", term: "B" }])
    );
    expect(failed).toEqual(["A"]);
  });
});
