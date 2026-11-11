import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type {
  DesktopUpdateBridge,
  DesktopUpdateState,
} from "@heymoa/desktop-contracts";
import { DesktopUpdateSettings } from "./desktop-update-settings";
const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/track", () => ({ track }));

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "heymoaDesktop");
  track.mockClear();
});
function native(initial: Partial<DesktopUpdateState> = {}) {
  let state: DesktopUpdateState = {
    currentVersion: "0.1.4",
    automatic: false,
    status: "idle",
    canRestart: false,
    ...initial,
  };
  let listener: ((value: DesktopUpdateState) => void) | undefined;
  const emit = (next: Partial<DesktopUpdateState>) => {
    state = { ...state, ...next };
    listener?.(state);
    return state;
  };
  const unsubscribe = vi.fn();
  const bridge: DesktopUpdateBridge = {
    getUpdateState: vi.fn(async () => state),
    checkForUpdates: vi.fn(async () =>
      emit({ status: "downloading", version: "0.1.5", percent: 25 })
    ),
    setAutomaticUpdates: vi.fn(async (automatic) => emit({ automatic })),
    restartForUpdate: vi.fn(async () => emit({ status: "installing" })),
    subscribeUpdates: (callback) => {
      listener = callback;
      return unsubscribe;
    },
  };
  Object.defineProperty(window, "heymoaDesktop", {
    configurable: true,
    value: bridge,
  });
  return { bridge, emit, unsubscribe };
}
it("manual checking downloads automatically and a stale-ready button stays blocked until native reports safe", async () => {
  const f = native();
  const view = render(<DesktopUpdateSettings />);
  await screen.findByText("현재 버전 0.1.4");
  fireEvent.click(screen.getByRole("button", { name: "업데이트 확인" }));
  await waitFor(() =>
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "25")
  );
  act(() => {
    f.emit({ status: "ready", canRestart: false });
  });
  expect(
    screen.getByRole("button", { name: "재시작하여 업데이트" })
  ).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("전송 대기");
  act(() => {
    f.emit({ canRestart: true });
  });
  fireEvent.click(screen.getByRole("button", { name: "재시작하여 업데이트" }));
  await waitFor(() => expect(f.bridge.restartForUpdate).toHaveBeenCalledOnce());
  expect(track).toHaveBeenCalledWith("desktop_update_check_clicked", {
    current_version: "0.1.4",
  });
  expect(track).toHaveBeenCalledWith(
    "desktop_update_restart_requested",
    { current_version: "0.1.4", target_version: "0.1.5" },
    { send_instantly: true, transport: "sendBeacon" }
  );
  view.unmount();
  expect(f.unsubscribe).toHaveBeenCalledOnce();
});
it("automatic updates are off initially and user's selection is saved through the native bridge", async () => {
  const f = native();
  render(<DesktopUpdateSettings />);
  const toggle = await screen.findByRole("switch", { name: "자동 업데이트" });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  await waitFor(() =>
    expect(f.bridge.setAutomaticUpdates).toHaveBeenCalledWith(true)
  );
  await waitFor(() => expect(toggle).toBeChecked());
  expect(track).toHaveBeenCalledWith("desktop_update_automatic_changed", {
    current_version: "0.1.4",
    enabled: true,
  });
});
it("records a native refusal when safety changes after the restart button becomes available", async () => {
  const f = native({ status: "ready", canRestart: true, version: "0.1.5" });
  vi.mocked(f.bridge.restartForUpdate).mockResolvedValue({
    currentVersion: "0.1.4",
    automatic: false,
    status: "ready",
    canRestart: false,
    version: "0.1.5",
  });
  render(<DesktopUpdateSettings />);
  fireEvent.click(
    await screen.findByRole("button", { name: "재시작하여 업데이트" })
  );
  await waitFor(() =>
    expect(track).toHaveBeenCalledWith("desktop_update_restart_blocked", {
      current_version: "0.1.4",
      target_version: "0.1.5",
      source: "request",
    })
  );
  expect(
    screen.getByRole("button", { name: "재시작하여 업데이트" })
  ).toBeDisabled();
});
it("older apps receive an official installer link rather than calling absent native methods", async () => {
  Object.defineProperty(window, "heymoaDesktop", {
    configurable: true,
    value: {},
  });
  render(<DesktopUpdateSettings />);
  expect(
    await screen.findByRole("link", { name: "새 설치 파일 받기" })
  ).toHaveAttribute(
    "href",
    "https://github.com/team-minswon/homebrew-tap/releases"
  );
});
it("a failed native request leaves a retry without claiming success", async () => {
  const f = native();
  vi.mocked(f.bridge.checkForUpdates).mockRejectedValue(new Error("offline"));
  render(<DesktopUpdateSettings />);
  await screen.findByText("현재 버전 0.1.4");
  fireEvent.click(screen.getByRole("button", { name: "업데이트 확인" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "처리하지 못했습니다"
  );
  expect(screen.getByRole("button", { name: "업데이트 확인" })).toBeEnabled();
  expect(track).toHaveBeenCalledWith("desktop_update_request_failed", {
    action: "check",
  });
  expect(JSON.stringify(track.mock.calls)).not.toContain("offline");
});

it("new shells open their menu-bar settings instead of rendering duplicate hosted controls", async () => {
  const f = native();
  f.bridge.openPreferences = vi.fn(async () => {});
  render(<DesktopUpdateSettings />);
  fireEvent.click(
    await screen.findByRole("button", { name: "메뉴 막대 설정 열기" })
  );
  expect(f.bridge.openPreferences).toHaveBeenCalledOnce();
  expect(screen.queryByRole("switch")).not.toBeInTheDocument();
});
