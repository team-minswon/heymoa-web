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
vi.mock("@/lib/auth/login-consent", () => ({
  settleLoginConsent: vi.fn().mockResolvedValue("done"),
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
