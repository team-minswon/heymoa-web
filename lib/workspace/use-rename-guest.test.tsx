import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRenameGuest } from "@/lib/workspace/use-rename-guest";

const GUEST = "0HZX2K7M9Q4AR";
const KEY = ["/v1/workspaces/W/guests"];

function seed() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(KEY, {
    status: 200,
    data: {
      success: true,
      data: {
        guests: [{ guestId: GUEST, displayName: "박서준", noteCount: 1 }],
      },
    },
  });
  return client;
}

function nameOf(client: QueryClient) {
  const data = client.getQueryData(KEY) as {
    data: { data: { guests: { displayName: string }[] } };
  };
  return data.data.data.guests[0].displayName;
}

function reply(displayName: string) {
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        guestId: GUEST,
        displayName,
        noteCount: 1,
        createdAt: "2026-07-08T00:00:00Z",
      },
      error: null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function setup(client: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () =>
      useRenameGuest({
        workspaceId: "W",
        guestId: GUEST,
        displayName: "박서준",
      }),
    { wrapper }
  );
}

describe("useRenameGuest", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("요청이 끝나기 전에 이름을 바꿔 보이고, 응답 값을 쓰고, 재조회하지 않는다", async () => {
    const client = seed();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let release: (response: Response) => void = () => {};
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => (release = resolve))
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = setup(client);

    act(() => result.current.rename("  새 이름 "));

    await waitFor(() => expect(nameOf(client)).toBe("새 이름"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => release(reply("새 이름(정규화)")));
    await waitFor(() => expect(nameOf(client)).toBe("새 이름(정규화)"));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("실패하면 서버가 확인한 이름으로 되돌린다", async () => {
    const client = seed();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              data: null,
              error: {
                code: "WORKSPACE_ACCESS_DENIED",
                message: "권한 없음",
                details: null,
              },
            }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          )
      )
    );
    const { result } = setup(client);

    act(() => result.current.rename("틀린 이름"));

    await waitFor(() => expect(nameOf(client)).toBe("박서준"));
  });

  it("연달아 고치면 한 줄로 순서대로 보낸다", async () => {
    const client = seed();
    const releases: Array<(response: Response) => void> = [];
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        bodies.push(String(init.body));
        return new Promise<Response>((resolve) => releases.push(resolve));
      })
    );
    const { result } = setup(client);

    act(() => {
      result.current.rename("하나");
      result.current.rename("둘");
    });

    // 화면은 즉시 마지막 이름이고, 요청은 앞 것이 끝나야 나간다.
    await waitFor(() => expect(nameOf(client)).toBe("둘"));
    expect(releases).toHaveLength(1);

    await act(async () => releases[0](reply("하나")));
    // 앞 응답이 낙관적인 「둘」을 덮어 되돌리지 않는다.
    expect(nameOf(client)).toBe("둘");
    await waitFor(() => expect(releases).toHaveLength(2));
    expect(bodies).toEqual(['{"displayName":"하나"}', '{"displayName":"둘"}']);

    await act(async () => releases[1](reply("둘")));
    await waitFor(() => expect(nameOf(client)).toBe("둘"));
  });
});
