import {
  cleanup,
  fireEvent,
  render as baseRender,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ReactElement } from "react";
import { LoginForm } from "./auth-modal";
import { intlWrapper } from "@/components/help/test-intl";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/track", () => ({ track }));
const render = (ui: ReactElement) =>
  baseRender(ui, { wrapper: intlWrapper("ko") });
const safari =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1";

beforeEach(() => {
  track.mockReset();
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(safari);
  window.history.replaceState(null, "", "/?utm_source=instagram&fbclid=click");
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "heymoaDesktop");
});

describe("in-app login UI", () => {
  it("keeps ordinary Safari on the existing consent form", () => {
    render(<LoginForm />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Google로 로그인" })
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText("브라우저에서 Google 로그인")).toBeNull();
  });

  it("asks for external browser first and offers a copy fallback without starting OAuth", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      safari + " FBAN/FBIOS;FBAV/1"
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<LoginForm />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(track).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "브라우저에서 Google 로그인" })
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "외부 브라우저로 열기"
    );
    expect(track).toHaveBeenCalledWith("browser_handoff_attempted", {
      app: "facebook",
      os: "ios",
      method: "manual",
      trigger: "login",
      interaction: "click",
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인 링크 복사" }));
    await waitFor(() =>
      expect(screen.getByText("복사했습니다")).toBeInTheDocument()
    );
    const link = new URL(writeText.mock.calls[0][0]);
    expect(link.searchParams.get("utm_source")).toBe("instagram");
    expect(link.searchParams.get("fbclid")).toBe("click");
    expect(track).not.toHaveBeenCalledWith("login_started");
    expect(window.sessionStorage.getItem("heymoa:login-consent")).toBeNull();
  });

  it("still exposes a selectable link if clipboard access is blocked", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(safari + " TikTok");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<LoginForm returnTo="/settings" />);
    fireEvent.click(
      screen.getByRole("button", { name: "브라우저에서 Google 로그인" })
    );
    fireEvent.click(screen.getByRole("button", { name: "로그인 링크 복사" }));
    const input = await screen.findByRole("textbox");
    expect(
      new URL((input as HTMLInputElement).value).searchParams.get("returnTo")
    ).toBe("/settings");
    expect(track).not.toHaveBeenCalledWith(
      "browser_handoff_link_copied",
      expect.anything()
    );
  });

  it("never routes the desktop app into the in-app gate", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Android Instagram"
    );
    Object.defineProperty(window, "heymoaDesktop", {
      configurable: true,
      value: {},
    });
    render(<LoginForm />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });
  it("counts the guide only when the original webview is visible again", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(safari + " TikTok");
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    render(<LoginForm />);
    fireEvent.click(
      screen.getByRole("button", { name: "브라우저에서 Google 로그인" })
    );
    expect(
      track.mock.calls.filter(
        ([name]) => name === "browser_handoff_guide_shown"
      )
    ).toHaveLength(0);
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    fireEvent(document, new Event("visibilitychange"));
    expect(
      track.mock.calls.filter(
        ([name]) => name === "browser_handoff_guide_shown"
      )
    ).toHaveLength(1);
  });
});
