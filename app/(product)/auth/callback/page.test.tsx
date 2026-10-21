import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CallbackProcessor } from "@/components/auth/auth-callback-client";
import AuthCallbackPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ setUser: vi.fn() }),
}));
vi.mock("@/lib/auth/api", () => ({
  getMe: vi.fn().mockResolvedValue({ name: "김민수" }),
}));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getWorkspaces: vi.fn().mockResolvedValue({
    status: 200,
    data: {
      success: true,
      data: {
        workspaces: [
          { workspaceId: "01K0000000007" },
          { workspaceId: "01K0000000000" },
        ],
      },
    },
  }),
}));

describe("Auth callback", () => {
  // 마지막 방문 기록이 없는 첫 로그인이다 — 목록의 첫 항목(서버가 합류한 순서로 준다)으로 간다.
  it("기억이 없으면 목록의 첫 워크스페이스로 보낸다", async () => {
    render(<CallbackProcessor />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/w/01K0000000007")
    );
  });

  it("마지막으로 연 워크스페이스가 목록에 있으면 그리로 보낸다", async () => {
    window.localStorage.setItem("heymoa:last-workspace", "01K0000000000");

    render(<CallbackProcessor />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/w/01K0000000000")
    );
    window.localStorage.clear();
  });

  // 쿼리 이름의 원본은 heymoa-server다 — 성공은 `?returnTo=`, 실패는 `?error=`로 온다.
  // 이름이 갈리면 값이 조용히 undefined가 되고 화면은 정상으로 보인다. 그래서 이름을 검사한다.
  it("server가 보낸 쿼리 이름을 그대로 읽는다", async () => {
    const element = await AuthCallbackPage({
      searchParams: Promise.resolve({
        returnTo: "/invite?token=abc",
        error: "access_denied",
      }),
    });

    expect(element.props.returnTo).toBe("/invite?token=abc");
    expect(element.props.urlError).toBe("access_denied");
  });
});
