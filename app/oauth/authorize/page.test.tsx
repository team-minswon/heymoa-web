import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, getCurrentUserForSsr } = vi.hoisted(() => {
  // `buildApiUrl` 이 모듈을 읽을 때 API 주소를 잡으므로 가져오기 전에 둔다.
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.heymoa.test";
  return {
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT ${url}`);
    }),
    getCurrentUserForSsr: vi.fn(),
  };
});
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/server", () => ({ getCurrentUserForSsr }));

import AgentOAuthAuthorizePage from "./page";

const query = {
  response_type: "code",
  client_id: "abc",
  redirect_uri: "http://127.0.0.1:1455/callback",
  scope: "mcp:read",
  state: "s1",
  code_challenge: "xyz",
  code_challenge_method: "S256",
  resource: "https://api.heymoa.test/mcp",
};

async function renderPage(searchParams: Record<string, string | string[]>) {
  render(
    await AgentOAuthAuthorizePage({
      searchParams: Promise.resolve(searchParams),
    })
  );
}

describe("외부 에이전트 인가 입구", () => {
  beforeEach(() => {
    redirect.mockClear();
    getCurrentUserForSsr.mockReset();
  });

  it("로그인돼 있으면 받은 쿼리 그대로 server 인가 엔드포인트로 보낸다", async () => {
    getCurrentUserForSsr.mockResolvedValue({ userId: "01K0000000000" });

    await expect(renderPage(query)).rejects.toThrow("NEXT_REDIRECT");

    const target = new URL(redirect.mock.calls[0][0]);
    expect(`${target.origin}${target.pathname}`).toBe(
      "https://api.heymoa.test/oauth2/authorize"
    );
    expect(Object.fromEntries(target.searchParams)).toEqual(query);
    expect([...target.searchParams.keys()]).toEqual(Object.keys(query));
  });

  it("쿼리에 다른 주소가 있어도 보내는 곳은 server 인가 엔드포인트다", async () => {
    getCurrentUserForSsr.mockResolvedValue({ userId: "01K0000000000" });

    await expect(
      renderPage({
        ...query,
        redirect_uri: "https://evil.example/steal",
        returnTo: "https://evil.example",
      })
    ).rejects.toThrow("NEXT_REDIRECT");

    const target = new URL(redirect.mock.calls[0][0]);
    expect(target.origin).toBe("https://api.heymoa.test");
    expect(target.pathname).toBe("/oauth2/authorize");
  });

  it("로그인 안 돼 있으면 로그인 카드를 그리고 로그인 뒤 이 인가 요청으로 돌아온다", async () => {
    getCurrentUserForSsr.mockResolvedValue(null);

    await renderPage(query);

    expect(redirect).not.toHaveBeenCalled();
    const login = screen.getByRole("link", { name: "Google로 계속하기" });
    const returnTo = new URL(login.getAttribute("href")!).searchParams.get(
      "returnTo"
    );
    expect(returnTo).toBe(`/oauth/authorize?${new URLSearchParams(query)}`);
  });

  it("쿼리가 없으면 에이전트에서 다시 연결하라고 안내한다", async () => {
    await renderPage({});

    expect(getCurrentUserForSsr).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "연결 요청을 찾을 수 없습니다. 에이전트에서 다시 연결해 주세요."
      )
    ).toBeTruthy();
  });
});
