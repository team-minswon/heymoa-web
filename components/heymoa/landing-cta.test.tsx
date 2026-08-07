import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LandingCta } from "@/components/heymoa/landing-cta";

const auth = vi.hoisted(() => ({ status: "anonymous" as string }));
const workspaces = vi.hoisted(() => ({
  data: undefined as unknown,
  isPending: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ status: auth.status }),
}));

vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  useGetWorkspaces: () => workspaces,
}));

vi.mock("@/components/auth/auth-modal", () => ({
  AuthModal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// 다이얼로그 본체는 라우터·쿼리 클라이언트를 요구한다. 여기서 보려는 것은 「어느 CTA가
// 뜨는가」뿐이라 열렸는지만 드러내는 대역으로 바꾼다.
vi.mock("@/components/workspace/create-workspace-dialog", () => ({
  CreateWorkspaceDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-workspace-dialog" /> : null,
}));

const WITH_WORKSPACE = {
  status: 200,
  data: {
    success: true,
    data: {
      workspaces: [{ workspaceId: "01K0000000000" }],
    },
  },
};

describe("LandingCta", () => {
  afterEach(cleanup);

  beforeEach(() => {
    auth.status = "anonymous";
    workspaces.data = undefined;
    workspaces.isPending = false;
    workspaces.isFetching = false;
    workspaces.isError = false;
    workspaces.refetch.mockReset();
  });

  it("비로그인이면 정본 라벨로 로그인 모달을 연다", () => {
    render(<LandingCta label="Google 계정으로 시작" />);

    expect(
      screen.getByRole("button", { name: /Google 계정으로 시작/ })
    ).toBeTruthy();
  });

  it("로그인 상태면 대시보드로 보낸다", () => {
    auth.status = "authenticated";
    workspaces.data = WITH_WORKSPACE;

    render(<LandingCta label="Google 계정으로 시작" />);

    expect(screen.getByRole("link", { name: /대시보드로 이동/ })).toHaveAttribute(
      "href",
      "/w/01K0000000000"
    );
  });

  it("조회가 실패하면 스피너를 멈추고 다시 시도를 낸다", () => {
    // 실패를 로딩과 같은 스피너로 그리면 CTA가 영원히 돌면서 빠져나갈 길이 없다.
    auth.status = "authenticated";
    workspaces.data = undefined;
    workspaces.isError = true;

    render(<LandingCta label="Google 계정으로 시작" />);

    const retry = screen.getByRole("button", { name: "대시보드 다시 시도" });
    expect(retry).not.toBeDisabled();
    fireEvent.click(retry);
    expect(workspaces.refetch).toHaveBeenCalledOnce();
  });

  /**
   * **0개는 재시도로 풀리지 않는다.** 마지막 워크스페이스에서 추방되면 여기가 앱에서 유일하게
   * 남는 입구다 — 사이드바의 「새 워크스페이스」는 `/w/[workspaceId]` 아래에 있어 닿을 수 없다.
   */
  it("조회에 성공했는데 워크스페이스가 0개면 만들기를 낸다", () => {
    auth.status = "authenticated";
    workspaces.data = {
      status: 200,
      data: { success: true, data: { workspaces: [] } },
    };

    render(<LandingCta label="Google 계정으로 시작" />);

    expect(screen.queryByRole("button", { name: "대시보드 다시 시도" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /워크스페이스 만들기/ }));
    expect(screen.getByTestId("create-workspace-dialog")).toBeTruthy();
  });

  it("조회 중에는 라벨이 튀지 않게 대시보드 버튼을 로딩으로 둔다", () => {
    auth.status = "authenticated";
    workspaces.isPending = true;

    render(<LandingCta label="Google 계정으로 시작" />);

    const button = screen.getByRole("button", { name: /대시보드로 이동/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  /**
   * 공용 `Button`은 로딩 중 라벨을 `opacity-0`으로 남겨 폭을 보존하지만, 보존하는 것은
   * **자기가 받은** children의 폭이다. 로딩 브랜치에만 `ArrowRight`가 없던 동안 146.1px로
   * 떴다가 확정되며 168.1px로 22px 튀었다.
   *
   * jsdom에는 레이아웃이 없어 px를 못 잰다 — 대신 두 브랜치의 children이 같은지를 본다.
   * 같은 children이면 같은 폭이고, 이 등식이 깨지는 순간이 곧 폭이 튀는 순간이다.
   */
  it("로딩 자리표시와 확정 버튼의 내용이 같다", () => {
    auth.status = "authenticated";
    workspaces.isPending = true;
    const loading = render(<LandingCta label="Google 계정으로 시작" />);
    const loadingLabel =
      screen.getByRole("button", { name: /대시보드로 이동/ }).firstElementChild
        ?.innerHTML;
    loading.unmount();

    workspaces.isPending = false;
    workspaces.data = WITH_WORKSPACE;
    render(<LandingCta label="Google 계정으로 시작" />);
    const settledLabel =
      screen.getByRole("link", { name: /대시보드로 이동/ }).firstElementChild
        ?.innerHTML;

    expect(loadingLabel).toBe(settledLabel);
  });
});
