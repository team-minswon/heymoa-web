import { act, cleanup, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { DesktopUpdateState } from "@heymoa/desktop-contracts";
import { DesktopUpdateAnalytics } from "./desktop-update-analytics";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/track", () => ({ track }));
afterEach(() => {
  cleanup();
  track.mockClear();
  Reflect.deleteProperty(window, "heymoaDesktop");
});

it("observes background transitions once, ignores progress and safety heartbeats, and removes listeners", async () => {
  const listeners = new Set<(state: DesktopUpdateState) => void>();
  const state: DesktopUpdateState = {
    currentVersion: "0.1.4",
    automatic: true,
    status: "idle",
    canRestart: false,
  };
  const bridge = {
    getUpdateState: async () => state,
    checkForUpdates() {},
    setAutomaticUpdates() {},
    restartForUpdate() {},
    subscribeUpdates: (listener: (state: DesktopUpdateState) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  Object.defineProperty(window, "heymoaDesktop", {
    configurable: true,
    value: bridge,
  });
  const view = render(
    <StrictMode>
      <DesktopUpdateAnalytics />
    </StrictMode>
  );
  await waitFor(() => expect(track).toHaveBeenCalledTimes(1));
  const emit = (next: Partial<DesktopUpdateState>) =>
    act(() => {
      Object.assign(state, next);
      for (const listener of listeners) listener({ ...state });
    });
  emit({ status: "downloading", version: "0.1.5", percent: 1 });
  emit({ percent: 80 });
  emit({ status: "ready", canRestart: false });
  emit({ percent: 100 });
  emit({ canRestart: true });
  emit({ status: "installing" });
  emit({ status: "error" });
  expect(
    track.mock.calls
      .filter(([name]) => name === "desktop_update_status_changed")
      .map(([, p]) => p.status)
  ).toEqual(["idle", "downloading", "ready", "installing", "error"]);
  expect(
    track.mock.calls.filter(
      ([name]) => name === "desktop_update_restart_blocked"
    )
  ).toHaveLength(1);
  expect(track).toHaveBeenCalledWith(
    "desktop_update_status_changed",
    expect.objectContaining({ status: "installing" }),
    { send_instantly: true, transport: "sendBeacon" }
  );
  view.unmount();
  expect(listeners.size).toBe(0);
});

it("a live event wins over a delayed initial snapshot", async () => {
  let resolve!: (state: DesktopUpdateState) => void;
  const state: DesktopUpdateState = {
    currentVersion: "0.1.4",
    status: "ready",
    canRestart: true,
    automatic: false,
  };
  Object.defineProperty(window, "heymoaDesktop", {
    configurable: true,
    value: {
      getUpdateState: () =>
        new Promise<DesktopUpdateState>((done) => {
          resolve = done;
        }),
      checkForUpdates() {},
      setAutomaticUpdates() {},
      restartForUpdate() {},
      subscribeUpdates: (listener: (state: DesktopUpdateState) => void) => {
        listener(state);
        return () => {};
      },
    },
  });
  render(<DesktopUpdateAnalytics />);
  await act(async () => resolve({ ...state, status: "idle" }));
  expect(track).toHaveBeenCalledTimes(1);
  expect(track).toHaveBeenCalledWith(
    "desktop_update_status_changed",
    expect.objectContaining({ status: "ready" }),
    undefined
  );
});
