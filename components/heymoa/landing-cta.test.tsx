import { cleanup, fireEvent, render as baseRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LandingCta } from "@/components/heymoa/landing-cta";
import { track } from "@/lib/analytics/track";
import { messagesFor } from "@/i18n/messages";

const render = (ui: ReactElement) =>
  baseRender(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="ko" messages={messagesFor("ko")}>
        {children}
      </NextIntlClientProvider>
    ),
  });

const auth = vi.hoisted(() => ({ status: "anonymous" as string }));
const workspaces = vi.hoisted(() => ({
  data: undefined as unknown,
  isPending: false,
  isFetching: false,
  isError: false,
  isSuccess: false,
  refetch: vi.fn(),
}));

vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ status: auth.status }),
}));

vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  useGetWorkspaces: () => workspaces,
}));

vi.mock("@/components/auth/auth-modal", () => ({
  AuthModal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

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
    workspaces.isSuccess = false;
    workspaces.refetch.mockReset();
    vi.mocked(track).mockClear();
    window.history.replaceState(null, "", "/");
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

  it("로그인한 사람에게 낼 라벨과 결제 페이지 행선지를 주면 대시보드 대신 그리로 보낸다", () => {
    auth.status = "authenticated";
    Object.assign(workspaces, { data: WITH_WORKSPACE, isSuccess: true });
    render(
      <LandingCta
        label="무료로 시작한 뒤 올리기"
        member={{ label: "Pro 시작하기", to: "checkout" }}
      />
    );
    expect(screen.getByRole("link", { name: "Pro 시작하기" })).toHaveAttribute(
      "href",
      "/billing/checkout/01K0000000000"
    );
    expect(screen.queryByText("대시보드로 이동")).toBeNull();
  });

  it("가격 안내의 버튼은 로그인 전 버튼을 누르면 비회원으로 이벤트를 낸다", () => {
    render(<LandingCta label="Google 계정으로 시작" pricingPlan="free" />);
    fireEvent.click(screen.getByRole("button", { name: /Google 계정으로 시작/ }));
    expect(track).toHaveBeenCalledWith("pricing_cta_clicked", {
      plan: "free",
      auth: "anonymous",
    });
  });

  it("가격 안내의 버튼은 로그인 뒤 링크를 누르면 회원으로 이벤트를 내고, 넘기지 않으면 내지 않는다", () => {
    auth.status = "authenticated";
    Object.assign(workspaces, { data: WITH_WORKSPACE, isSuccess: true });
    render(
      <>
        <LandingCta
          label="무료로 시작한 뒤 올리기"
          member={{ label: "Pro 시작하기", to: "checkout" }}
          pricingPlan="pro"
        />
        <LandingCta label="Google 계정으로 시작" />
      </>
    );
    fireEvent.click(screen.getByRole("link", { name: "Pro 시작하기" }));
    fireEvent.click(screen.getByRole("link", { name: /대시보드로 이동/ }));
    expect(vi.mocked(track).mock.calls).toEqual([
      ["pricing_cta_clicked", { plan: "pro", auth: "member" }],
    ]);
  });

  it("시작 버튼에 포커스하면 연결된 녹음 안내 툴팁을 연다", async () => {
    render(
      <LandingCta label="무료로 시작하기" tooltip="웹은 마이크 입력" />
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
    const button = screen.getByRole("button", { name: "무료로 시작하기" });
    fireEvent.focus(button);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("웹은 마이크 입력");
    expect(button).toHaveAttribute("aria-describedby", tooltip.id);
  });

  it("조회가 실패하면 스피너를 멈추고 다시 시도를 낸다", () => {
    auth.status = "authenticated";
    workspaces.data = undefined;
    workspaces.isError = true;

    render(<LandingCta label="Google 계정으로 시작" />);

    const retry = screen.getByRole("button", { name: "대시보드 다시 시도" });
    expect(retry).not.toBeDisabled();
    fireEvent.click(retry);
    expect(workspaces.refetch).toHaveBeenCalledOnce();
  });

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

  it("첫 로그인 직후에는 만들기 폼을 바로 열고 쿼리를 지운다", () => {
    auth.status = "authenticated";
    workspaces.isSuccess = true;
    workspaces.data = {
      status: 200,
      data: { success: true, data: { workspaces: [] } },
    };
    window.history.replaceState(null, "", "/?welcome");

    render(
      <>
        <LandingCta label="Google 계정으로 시작" openOnWelcome />
        <LandingCta label="Google 계정으로 시작" />
      </>
    );

    expect(screen.getAllByTestId("create-workspace-dialog")).toHaveLength(1);
    expect(window.location.search).toBe("");
  });

  it("조회 중에는 라벨이 튀지 않게 대시보드 버튼을 로딩으로 둔다", () => {
    auth.status = "authenticated";
    workspaces.isPending = true;

    render(<LandingCta label="Google 계정으로 시작" />);

    const button = screen.getByRole("button", { name: /대시보드로 이동/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

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
