import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LandingCta } from "@/components/heymoa/landing-cta";

const auth = vi.hoisted(() => ({ status: "anonymous" as string }));
const workspaces = vi.hoisted(() => ({
  data: undefined as unknown,
  isPending: false,
  isFetching: false,
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

const WITH_WORKSPACE = {
  status: 200,
  data: {
    success: true,
    data: {
      workspaces: [{ workspaceId: "01K0000000000", isDefault: true }],
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

  it("조회가 끝났는데 갈 곳이 없으면 스피너를 멈추고 다시 시도를 낸다", () => {
    // 실패와 빈 결과를 로딩과 같은 스피너로 그리면 CTA가 영원히 돌면서 빠져나갈 길이 없다.
    auth.status = "authenticated";
    workspaces.data = undefined;

    render(<LandingCta label="Google 계정으로 시작" />);

    const retry = screen.getByRole("button", { name: "대시보드 다시 시도" });
    expect(retry).not.toBeDisabled();
    fireEvent.click(retry);
    expect(workspaces.refetch).toHaveBeenCalledOnce();
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
