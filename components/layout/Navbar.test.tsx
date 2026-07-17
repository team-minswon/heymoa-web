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

vi.mock("sonner", () => ({ toast }));

const workspaceData = {
  status: 200,
  data: {
    success: true,
    data: {
      workspaces: [
        {
          workspaceId: "workspace-1",
          name: "기본 워크스페이스",
          isDefault: true,
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
    expect(screen.getByRole("button", { name: "대시보드" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "대시보드" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
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
});
