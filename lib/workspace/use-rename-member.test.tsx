import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRenameMember } from "@/lib/workspace/use-rename-member";

const USER = "0HZX2K7M9Q4AU";
const KEY = ["/v1/workspaces/W/members"];
const MEMBER = {
  userId: USER,
  name: "상어",
  displayName: null,
  accountName: "상어",
};

function seed() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(KEY, {
    status: 200,
    data: {
      success: true,
      data: { members: [{ ...MEMBER, email: "a@b.c", role: "ADMIN" }] },
    },
  });
  return client;
}

function shown(client: QueryClient) {
  return (
    client.getQueryData(KEY) as {
      data: {
        data: { members: { name: string; displayName: string | null }[] };
      };
    }
  ).data.data.members[0];
}

function setup(client: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () => useRenameMember({ workspaceId: "W", member: MEMBER }),
    { wrapper }
  );
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useRenameMember", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("요청 전에 이름을 바꿔 보이고 응답 값을 쓰며 재조회하지 않는다", async () => {
    const client = seed();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let release: (response: Response) => void = () => {};
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => (release = resolve))
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = setup(client);

    let outcome: Promise<string | null> = Promise.resolve(null);
    act(() => {
      outcome = result.current.rename("  김민수 ");
    });
    await waitFor(() => expect(shown(client).name).toBe("김민수"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ displayName: "김민수" });

    await act(async () => {
      release(
        json(200, {
          success: true,
          data: {
            ...MEMBER,
            name: "김민수",
            displayName: "김민수",
            email: "a@b.c",
            role: "ADMIN",
            image: null,
            joinedAt: "2026-07-01T00:00:00Z",
          },
          error: null,
        })
      );
      expect(await outcome).toBeNull();
    });
    expect(shown(client)).toMatchObject({
      name: "김민수",
      displayName: "김민수",
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("빈 값은 null 로 보내 계정 이름으로 되돌린다", async () => {
    const client = seed();
    const fetchMock = vi.fn(async () =>
      json(200, {
        success: true,
        data: {
          ...MEMBER,
          email: "a@b.c",
          role: "ADMIN",
          image: null,
          joinedAt: "2026-07-01T00:00:00Z",
        },
        error: null,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = setup(client);

    await act(async () => {
      await result.current.rename("   ");
    });
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ displayName: null });
    expect(shown(client).name).toBe("상어");
  });

  it("실패하면 서버가 확인한 이름으로 되돌리고 문구를 돌려준다", async () => {
    const client = seed();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json(403, {
          success: false,
          data: null,
          error: {
            code: "WORKSPACE_ACCESS_DENIED",
            message: "권한 없음",
            details: null,
          },
        })
      )
    );
    const { result } = setup(client);

    let failure: string | null = null;
    await act(async () => {
      failure = await result.current.rename("김민수");
    });
    await waitFor(() => expect(shown(client).name).toBe("상어"));
    expect(failure).toBe("권한 없음");
  });

  it("되돌릴 기준은 연 순간이 아니라 지금 캐시의 이름이다", async () => {
    const client = seed();
    // 대화상자를 연 뒤(훅은 「상어」로 열렸다) 목록이 다른 이름을 받았다
    client.setQueryData(KEY, {
      status: 200,
      data: {
        success: true,
        data: {
          members: [
            {
              ...MEMBER,
              name: "고래",
              displayName: "고래",
              email: "a@b.c",
              role: "ADMIN",
            },
          ],
        },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json(500, {
          success: false,
          data: null,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "실패",
            details: null,
          },
        })
      )
    );
    const { result } = setup(client);

    await act(async () => {
      await result.current.rename("김민수");
    });
    await waitFor(() => expect(shown(client).name).toBe("고래"));
  });
});
