import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Navbar } from "@/components/layout/Navbar";

const auth = vi.hoisted(() => ({
  logout: vi.fn(),
  value: {
    user: {
      userId: "user-1",
      name: "테스트 사용자",
      email: "test@heymoa.com",
      image: null,
    },
    status: "authenticated" as const,
    isLoggingOut: false,
  },
}));

const workspaceQuery = vi.hoisted(() => ({
  data: undefined as unknown,
  isPending: false,
  isFetching: false,
  isError: false,
  isSuccess: true,
  refetch: vi.fn(),
}));

const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ ...auth.value, logout: auth.logout }),
}));

vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  useGetWorkspaces: () => ({
    ...workspaceQuery,
  }),
}));

vi.mock("@/lib/ui/toast", () => ({ toast }));

const workspaceData = {
  status: 200,
  data: {
    success: true,
    data: {
      workspaces: [
        {
          workspaceId: "workspace-1",
          name: "기본 워크스페이스",
        },
      ],
    },
  },
};

describe("Navbar", () => {
  afterEach(cleanup);

  beforeEach(() => {
    auth.logout.mockReset();
    toast.error.mockReset();
    workspaceQuery.refetch.mockReset();
    workspaceQuery.data = workspaceData;
    workspaceQuery.isPending = false;
    workspaceQuery.isFetching = false;
    workspaceQuery.isError = false;
    workspaceQuery.isSuccess = true;
  });

  it("shows both dashboard and logout actions for an authenticated user", () => {
    render(<Navbar />);

    expect(screen.getByRole("link", { name: /대시보드/ })).toHaveAttribute(
      "href",
      "/w/workspace-1"
    );

    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(auth.logout).toHaveBeenCalledOnce();
  });

  it("never renders a no-op dashboard link while workspaces are loading", () => {
    workspaceQuery.data = undefined;
    workspaceQuery.isPending = true;
    workspaceQuery.isSuccess = false;

    render(<Navbar />);

    expect(screen.queryByRole("link", { name: /대시보드/ })).toBeNull();

    const placeholder = screen.getByRole("button", { name: /대시보드/ });
    expect(placeholder).toHaveTextContent("대시보드");
    expect(placeholder).toHaveTextContent("대시보드로 이동");
    expect(placeholder).toBeDisabled();
    expect(placeholder).toHaveAttribute("aria-busy", "true");
    expect(placeholder.className).not.toMatch(/min-w-/);
  });

  it("offers a toast and retry action when workspaces fail to load", () => {
    workspaceQuery.data = undefined;
    workspaceQuery.isError = true;
    workspaceQuery.isSuccess = false;

    render(<Navbar />);

    expect(toast.error).toHaveBeenCalledWith(
      "대시보드를 불러오지 못했습니다.",
      expect.objectContaining({ id: "navbar-workspaces" })
    );

    fireEvent.click(screen.getByRole("button", { name: "대시보드 다시 시도" }));
    expect(workspaceQuery.refetch).toHaveBeenCalledOnce();
  });

  it("워크스페이스가 0개여도 오류로 다루지 않는다", () => {
    workspaceQuery.data = {
      status: 200,
      data: { success: true, data: { workspaces: [] } },
    };
    workspaceQuery.isError = false;
    workspaceQuery.isSuccess = true;

    render(<Navbar />);

    expect(toast.error).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "대시보드 다시 시도" })
    ).toBeNull();
  });
});
