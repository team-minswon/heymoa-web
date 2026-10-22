import {
  cleanup,
  fireEvent,
  render as baseRender,
  screen,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthModal } from "@/components/auth/auth-modal";
import { intlWrapper } from "@/components/help/test-intl";
import { WorkspaceLoginCard } from "@/components/workspace/workspace-login-card";

const paths = vi.hoisted(() => ({ buildGoogleOAuthUrl: vi.fn() }));

vi.mock("@/lib/auth/paths", () => ({
  buildGoogleOAuthUrl: paths.buildGoogleOAuthUrl,
  getCurrentReturnTo: () => "/",
  isAuthApiConfigured: true,
}));
vi.mock("@/lib/ui/toast", () => ({ toast: { error: vi.fn() } }));

const render = (ui: ReactElement, locale: "ko" | "en" = "ko") =>
  baseRender(ui, { wrapper: intlWrapper(locale) });

const loginButton = () =>
  screen.getByRole("button", { name: /Google로 로그인|Sign in with Google/ });
const agreement = () => screen.getByRole("checkbox");

describe("AuthModal 약관 동의", () => {
  beforeEach(() => {
    paths.buildGoogleOAuthUrl.mockReset();
    // jsdom 은 문서 이동을 못 한다. 이동 직전(주소를 만드는 자리)에서 멈춘다.
    paths.buildGoogleOAuthUrl.mockImplementation(() => {
      throw new Error("navigation boundary");
    });
    window.sessionStorage.clear();
  });
  afterEach(cleanup);

  it("체크하기 전에는 로그인 버튼이 눌리지 않고 이유가 체크박스 옆에 보인다", () => {
    render(<AuthModal open />);

    expect(agreement()).not.toBeChecked();
    expect(loginButton()).toBeDisabled();
    const reason = screen.getByText("동의해야 로그인할 수 있습니다.");
    expect(reason).toBeInTheDocument();
    expect(agreement()).toHaveAttribute("aria-describedby", reason.id);

    fireEvent.click(loginButton());

    expect(paths.buildGoogleOAuthUrl).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("체크하면 로그인이 시작되고, 체크하고 시작했다는 표시가 이동 전에 남는다", () => {
    render(<AuthModal open />);

    fireEvent.click(agreement());

    expect(agreement()).toBeChecked();
    expect(loginButton()).toBeEnabled();
    expect(
      screen.queryByText("동의해야 로그인할 수 있습니다.")
    ).not.toBeInTheDocument();

    fireEvent.click(loginButton());

    expect(paths.buildGoogleOAuthUrl).toHaveBeenCalledTimes(1);
    expect(
      window.sessionStorage.getItem("heymoa:login-consent")
    ).not.toBeNull();
  });

  it("체크를 풀면 다시 막힌다", () => {
    render(<AuthModal open />);

    fireEvent.click(agreement());
    fireEvent.click(agreement());

    expect(loginButton()).toBeDisabled();
    expect(
      screen.getByText("동의해야 로그인할 수 있습니다.")
    ).toBeInTheDocument();
  });

  it("문서 이름은 각 문서로 가는 링크이고 창을 닫지 않게 새 탭으로 열린다", () => {
    render(<AuthModal open />);

    const privacy = screen.getByRole("link", { name: "개인정보 처리방침" });
    const terms = screen.getByRole("link", { name: "이용약관" });

    expect(privacy).toHaveAttribute("href", "/privacy");
    expect(terms).toHaveAttribute("href", "/terms");
    expect(privacy).toHaveAttribute("target", "_blank");
    // 링크를 눌러도 체크가 바뀌지 않는다 — 읽으러 가는 것과 동의하는 것은 다른 동작이다.
    fireEvent.click(privacy);
    expect(agreement()).not.toBeChecked();
  });

  it("영어판은 영어 문구와 /en 문서로 이어진다", () => {
    render(<AuthModal open />, "en");

    expect(
      screen.getByRole("checkbox", {
        name: "I have read and agree to the Privacy Policy and the Terms of Service",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("You need to agree before you can sign in.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Privacy Policy" })
    ).toHaveAttribute("href", "/en/privacy");
    expect(
      screen.getByRole("link", { name: "Terms of Service" })
    ).toHaveAttribute("href", "/en/terms");
    expect(loginButton()).toBeDisabled();
  });

  it("창을 닫았다 열면 체크가 풀려 있다 — 동의는 로그인할 때마다 직접 한다", async () => {
    const { rerender } = render(<AuthModal open />);
    fireEvent.click(agreement());
    expect(agreement()).toBeChecked();

    rerender(<AuthModal open={false} />);
    await vi.waitFor(() =>
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    );
    rerender(<AuthModal open />);

    expect(agreement()).not.toBeChecked();
    expect(loginButton()).toBeDisabled();
  });

  it("로그인 안 한 채 연 워크스페이스 주소의 로그인 카드도 같은 동의를 거친다", () => {
    render(<WorkspaceLoginCard />);

    expect(loginButton()).toBeDisabled();
    fireEvent.click(agreement());
    expect(loginButton()).toBeEnabled();
  });
});
