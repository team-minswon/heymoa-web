import {
  cleanup,
  fireEvent,
  render as baseRender,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { intlWrapper } from "@/components/help/test-intl";

const render = (ui: ReactElement, locale: "ko" | "en" = "ko") =>
  baseRender(ui, { wrapper: intlWrapper(locale) });

const toast = vi.hoisted(() => ({ error: vi.fn() }));
const paths = vi.hoisted(() => ({
  configured: false,
  buildGoogleOAuthUrl: vi.fn(),
}));

vi.mock("@/lib/auth/paths", () => ({
  buildGoogleOAuthUrl: paths.buildGoogleOAuthUrl,
  getCurrentReturnTo: () => "/settings",
  get isAuthApiConfigured() {
    return paths.configured;
  },
}));

vi.mock("@/lib/ui/toast", () => ({ toast }));

describe("GoogleLoginButton", () => {
  beforeEach(() => {
    toast.error.mockReset();
    paths.configured = false;
    paths.buildGoogleOAuthUrl.mockReset();
  });
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "heymoaDesktop");
  });

  function desktop(bridge: object) {
    paths.configured = true;
    Object.defineProperty(window, "heymoaDesktop", {
      value: bridge,
      configurable: true,
    });
  }

  it("reports an unavailable login through Sonner without inline feedback", () => {
    render(<GoogleLoginButton />);

    fireEvent.click(screen.getByRole("button", { name: "Google로 로그인" }));

    expect(toast.error).toHaveBeenCalledWith(
      "현재 로그인을 사용할 수 없습니다.",
      { id: "google-login-unavailable" }
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("admits native login during the click and cancellation restores the button", async () => {
    const beginLogin = vi.fn().mockResolvedValue({ status: "cancelled" });
    desktop({ beginLogin });
    render(<GoogleLoginButton />);
    fireEvent.click(screen.getByRole("button", { name: "Google로 로그인" }));
    expect(beginLogin).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Google로 로그인" })
      ).not.toBeDisabled()
    );
    expect(paths.buildGoogleOAuthUrl).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
  it("blocks an old app from navigating to embedded Google login", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    desktop({});
    render(<GoogleLoginButton />);
    fireEvent.click(screen.getByRole("button", { name: "Google로 로그인" }));
    expect(toast.error).toHaveBeenCalledWith(
      "앱을 업데이트한 뒤 다시 로그인해 주세요.",
      {
        id: "google-login-update",
        action: { label: "새 버전 보기", onClick: expect.any(Function) },
      }
    );
    expect(paths.buildGoogleOAuthUrl).not.toHaveBeenCalled();
    toast.error.mock.calls.at(-1)?.[1].action.onClick();
    expect(open).toHaveBeenCalledWith(
      "https://github.com/team-minswon/homebrew-tap/releases",
      "_blank",
      "noopener,noreferrer"
    );
    open.mockRestore();
  });
  it("keeps a pending native request single and shows timeout without web fallback", async () => {
    let finish!: (value: { status: string; reason: string }) => void;
    const beginLogin = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    desktop({ beginLogin });
    render(<GoogleLoginButton />);
    const button = screen.getByRole("button", { name: "Google로 로그인" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(beginLogin).toHaveBeenCalledTimes(1);
    finish({ status: "error", reason: "timeout" });
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "로그인 시간이 지났습니다. 다시 시도해 주세요.",
        { id: "google-login-desktop" }
      )
    );
    expect(paths.buildGoogleOAuthUrl).not.toHaveBeenCalled();
  });
  it("releases the native login when the modal closes before the browser returns", () => {
    const beginLogin = vi.fn(() => new Promise(() => {}));
    const cancelAuth = vi.fn().mockResolvedValue(undefined);
    desktop({ beginLogin, cancelAuth });
    const { unmount } = render(<GoogleLoginButton />);
    fireEvent.click(screen.getByRole("button", { name: "Google로 로그인" }));
    expect(cancelAuth).not.toHaveBeenCalled();
    unmount();
    expect(cancelAuth).toHaveBeenCalledTimes(1);
  });
  it("does not cancel when the button closes without a pending login", () => {
    const cancelAuth = vi.fn().mockResolvedValue(undefined);
    desktop({ beginLogin: vi.fn(), cancelAuth });
    const { unmount } = render(<GoogleLoginButton />);
    unmount();
    expect(cancelAuth).not.toHaveBeenCalled();
  });
  it("keeps ordinary web login on the OAuth URL builder with returnTo", async () => {
    paths.configured = true;
    // Stop at the navigation boundary; jsdom cannot perform document navigation.
    paths.buildGoogleOAuthUrl.mockImplementation(() => {
      throw new Error("navigation boundary");
    });
    render(<GoogleLoginButton />);
    fireEvent.click(screen.getByRole("button", { name: "Google로 로그인" }));
    expect(paths.buildGoogleOAuthUrl).toHaveBeenCalledWith("/settings");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Google로 로그인" })
      ).not.toBeDisabled()
    );
  });

  it("allows retry after native rejection without starting web OAuth", async () => {
    const beginLogin = vi
      .fn()
      .mockRejectedValueOnce(new Error("IPC unavailable"))
      .mockResolvedValueOnce({ status: "cancelled" });
    desktop({ beginLogin });
    render(<GoogleLoginButton />);
    const button = screen.getByRole("button", { name: "Google로 로그인" });
    fireEvent.click(button);
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(toast.error).toHaveBeenCalledTimes(1);
    fireEvent.click(button);
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(beginLogin).toHaveBeenCalledTimes(2);
    expect(paths.buildGoogleOAuthUrl).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
  it("starts OAuth with the handed-off destination rather than the login page", () => {
    paths.configured = true;
    paths.buildGoogleOAuthUrl.mockImplementation(() => {
      throw new Error("navigation boundary");
    });
    render(<GoogleLoginButton returnTo="/settings/notifications" />);
    fireEvent.click(screen.getByRole("button", { name: "Google로 로그인" }));
    expect(paths.buildGoogleOAuthUrl).toHaveBeenCalledWith(
      "/settings/notifications"
    );
  });
  it("while blocked it looks disabled, hands the click to onBlocked and never starts login", () => {
    paths.configured = true;
    const onLoginStart = vi.fn();
    const onBlocked = vi.fn();
    render(
      <GoogleLoginButton
        blocked
        onBlocked={onBlocked}
        onLoginStart={onLoginStart}
      />
    );
    const button = screen.getByRole("button", { name: "Google로 로그인" });

    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);

    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(onLoginStart).not.toHaveBeenCalled();
    expect(paths.buildGoogleOAuthUrl).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("tells the caller once when login actually starts, before leaving for Google", () => {
    paths.configured = true;
    const onLoginStart = vi.fn();
    paths.buildGoogleOAuthUrl.mockImplementation(() => {
      throw new Error("navigation boundary");
    });
    render(<GoogleLoginButton onLoginStart={onLoginStart} />);

    fireEvent.click(screen.getByRole("button", { name: "Google로 로그인" }));

    expect(onLoginStart).toHaveBeenCalledTimes(1);
    expect(onLoginStart.mock.invocationCallOrder[0]).toBeLessThan(
      paths.buildGoogleOAuthUrl.mock.invocationCallOrder[0]
    );
  });

  it("does not report login start when login is unavailable", () => {
    const onLoginStart = vi.fn();
    render(<GoogleLoginButton onLoginStart={onLoginStart} />);

    fireEvent.click(screen.getByRole("button", { name: "Google로 로그인" }));

    expect(onLoginStart).not.toHaveBeenCalled();
  });

  it("speaks English in the English edition", () => {
    paths.configured = false;
    render(<GoogleLoginButton />, "en");

    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with Google" })
    );

    expect(toast.error).toHaveBeenCalledWith(
      "Sign-in is not available right now.",
      { id: "google-login-unavailable" }
    );
  });
});
