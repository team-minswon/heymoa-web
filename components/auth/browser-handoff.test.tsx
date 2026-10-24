import {
  cleanup,
  fireEvent,
  render as baseRender,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { intlWrapper } from "@/components/help/test-intl";
import { BrowserHandoff } from "./browser-handoff";

const track = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ status: "anonymous" }));
const externalBrowserUrl = vi.hoisted(() => vi.fn().mockReturnValue(null));
vi.mock("@/lib/analytics/track", () => ({
  track,
  withAnalyticsHandoff: (target: string) => target,
}));
vi.mock("./auth-provider", () => ({ useAuth: () => auth }));
vi.mock("@/lib/auth/in-app-browser", async (original) => ({
  ...(await original<typeof import("@/lib/auth/in-app-browser")>()),
  externalBrowserUrl,
}));
const render = (ui: ReactElement) =>
  baseRender(ui, { wrapper: intlWrapper("ko") });
const safari = "iPhone Version/18.0 Mobile Safari/604.1";

beforeEach(() => {
  track.mockReset();
  externalBrowserUrl.mockClear();
  auth.status = "anonymous";
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    safari + " Instagram"
  );
  window.history.replaceState(null, "", "/?utm_source=instagram&fbclid=click");
  sessionStorage.clear();
});
afterEach(cleanup);

describe("landing browser handoff", () => {
  it("attempts once on entry, including StrictMode, and keeps campaign tags", async () => {
    render(
      <StrictMode>
        <BrowserHandoff />
      </StrictMode>
    );
    await screen.findByRole("button", { name: "브라우저에서 계속하기" });
    expect(externalBrowserUrl).toHaveBeenCalledTimes(1);
    const target = new URL(externalBrowserUrl.mock.calls[0][0]);
    expect(target.pathname).toBe("/");
    expect(target.searchParams.get("utm_source")).toBe("instagram");
    expect(target.searchParams.get("fbclid")).toBe("click");
    expect(track).toHaveBeenCalledWith(
      "browser_handoff_attempted",
      expect.objectContaining({ trigger: "entry" })
    );
    expect(track).not.toHaveBeenCalledWith("login_started");
  });

  it("allows a user-gesture retry without claiming arrival or looping after remount", async () => {
    const view = render(<BrowserHandoff />);
    const button = await screen.findByRole("button", {
      name: "브라우저에서 계속하기",
    });
    fireEvent.click(button);
    expect(externalBrowserUrl).toHaveBeenCalledTimes(2);
    expect(
      track.mock.calls.filter(
        ([name]) => name === "browser_handoff_guide_shown"
      )
    ).toHaveLength(1);
    expect(
      track.mock.calls.some(([name]) => name === "browser_handoff_arrived")
    ).toBe(false);
    view.unmount();
    render(<BrowserHandoff />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(externalBrowserUrl).toHaveBeenCalledTimes(2);
  });

  it.each([
    "/auth/callback?code=secret",
    "/auth/login",
    "/w/01K0000000000",
    "/oauth/authorize?state=secret",
  ])("does not auto-launch from %s", (path) => {
    window.history.replaceState(null, "", path);
    render(<BrowserHandoff />);
    expect(externalBrowserUrl).not.toHaveBeenCalled();
  });

  it("does not automatically reopen a marked destination that stayed in-app", async () => {
    window.history.replaceState(
      null,
      "",
      "/?handoff_app=instagram&handoff_os=ios"
    );
    render(<BrowserHandoff />);
    await screen.findByRole("button", { name: "브라우저에서 계속하기" });
    expect(externalBrowserUrl).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("records external arrival once and leaves UTM tags intact", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(safari);
    window.history.replaceState(
      null,
      "",
      "/?handoff_app=instagram&handoff_os=ios&utm_source=instagram"
    );
    render(
      <StrictMode>
        <BrowserHandoff />
      </StrictMode>
    );
    await waitFor(() => expect(track).toHaveBeenCalledTimes(1));
    expect(track).toHaveBeenCalledWith("browser_handoff_arrived", {
      app: "instagram",
      os: "ios",
    });
    expect(window.location.search).toBe("?utm_source=instagram");
    expect(externalBrowserUrl).not.toHaveBeenCalled();
  });

  it("leaves Safari and authenticated users alone", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(safari);
    const view = render(<BrowserHandoff />);
    expect(externalBrowserUrl).not.toHaveBeenCalled();
    view.unmount();
    auth.status = "authenticated";
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      safari + " Instagram"
    );
    render(<BrowserHandoff />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
