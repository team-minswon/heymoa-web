import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserForSsr } = vi.hoisted(() => ({
  getCurrentUserForSsr: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ getCurrentUserForSsr }));
vi.mock("@/components/agent-connections/agent-oauth-consent", () => ({
  AgentOAuthConsent: ({ consentState }: { consentState: string }) => (
    <p>동의 화면 {consentState}</p>
  ),
}));

import AgentOAuthConsentPage from "./page";

async function renderPage(searchParams: Record<string, string>) {
  render(
    await AgentOAuthConsentPage({ searchParams: Promise.resolve(searchParams) })
  );
}

describe("외부 에이전트 연결 동의 페이지", () => {
  beforeEach(() => getCurrentUserForSsr.mockReset());

  it("로그인돼 있으면 state 로 동의 화면을 그린다", async () => {
    getCurrentUserForSsr.mockResolvedValue({ userId: "01K0000000000" });

    await renderPage({ client_id: "abc", scope: "mcp:read", state: "s1" });

    expect(screen.getByText("동의 화면 s1")).toBeTruthy();
  });

  it("그 사이 로그아웃됐으면 로그인 카드를 그리고 로그인 뒤 이 화면으로 돌아온다", async () => {
    getCurrentUserForSsr.mockResolvedValue(null);

    await renderPage({ client_id: "abc", scope: "mcp:read", state: "s1" });

    const login = screen.getByRole("link", { name: "Google로 계속하기" });
    expect(
      new URL(login.getAttribute("href")!, "http://web.test").searchParams.get(
        "returnTo"
      )
    ).toBe("/oauth/consent?client_id=abc&scope=mcp%3Aread&state=s1");
  });

  it("state 가 없으면 다시 연결하라고 안내한다", async () => {
    await renderPage({ client_id: "abc" });

    expect(getCurrentUserForSsr).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "연결 요청을 찾을 수 없습니다. 에이전트에서 다시 연결해 주세요."
      )
    ).toBeTruthy();
  });
});
