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

    // 로딩 자리표시의 children이 확정 링크와 같아야 폭이 안 튄다 — 좁은 화면 `대시보드`와
    // 넓은 화면 `대시보드로 이동` 두 span을 그대로 들고 있다(둘 중 하나만 CSS로 보인다).
    const placeholder = screen.getByRole("button", { name: /대시보드/ });
    expect(placeholder).toHaveTextContent("대시보드");
    expect(placeholder).toHaveTextContent("대시보드로 이동");
    expect(placeholder).toBeDisabled();
    expect(placeholder).toHaveAttribute("aria-busy", "true");
    // 폭을 min-w로 못 박지 않는다 — 그 값(144px)이 확정 폭(138.1px)보다 커서 반대로 줄었다.
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

  /**
   * **0개는 실패가 아니다.** 마지막 워크스페이스에서 추방되면 도달하는 정상 상태이고, 같은
   * 홈의 랜딩 CTA가 그때 「워크스페이스 만들기」를 낸다(APP-402). 여기서 오류 토스트를 띄우면
   * 방금 안내한 행동을 옆에서 부정하게 되고, 재시도해 봐야 같은 0개가 온다.
   */
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
