import { afterEach, describe, expect, it, vi } from "vitest";
import { createRecordingSession } from "./recording-runtime";
import type { DesktopBridge } from "@heymoa/desktop-contracts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(overrides: Partial<DesktopBridge> = {}) {
  const bridge = {
    getCapabilities: vi.fn(async () => ({
      bridgeVersion: 1,
      platform: "darwin",
      architecture: "arm64",
      supported: true,
      capture: true,
      captureContractVersion: 1,
    })),
    reportRecording: vi.fn(async () => {}),
    beginCapture: vi.fn(async () => "capture-id"),
    captureReady: vi.fn(async () => {}),
    endCapture: vi.fn(async () => {}),
    subscribeCapture: vi.fn(() => () => {}),
    ...overrides,
  };
  vi.stubGlobal("window", { heymoaDesktop: bridge });
  const controller = createRecordingSession({
    url: "wss://api.heymoa.app",
    onEvent: vi.fn(),
    onLevel: vi.fn(),
    onFailure: vi.fn(),
  });
  return { controller, bridge };
}

describe("desktop recording runtime", () => {
  it("acquires native permission immediately even while capability resolution is pending", async () => {
    let resolve!: (
      value: Awaited<ReturnType<DesktopBridge["getCapabilities"]>>
    ) => void;
    const { controller, bridge } = setup({
      getCapabilities: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    const permission = controller.requestPermission();
    expect(bridge.beginCapture).toHaveBeenCalledTimes(1);
    resolve({
      bridgeVersion: 1,
      platform: "darwin",
      architecture: "arm64",
      supported: true,
      capture: true,
      captureContractVersion: 1,
    });
    await permission;
  });

  it("releases acquired native inputs when the installed capture contract is unsupported", async () => {
    const { controller, bridge } = setup({
      getCapabilities: async () => ({
        bridgeVersion: 1,
        platform: "darwin",
        architecture: "arm64",
        supported: true,
        capture: true,
        captureContractVersion: 2,
      }),
    });
    await expect(controller.requestPermission()).rejects.toThrow(
      "DESKTOP_CAPTURE_UPDATE_REQUIRED"
    );
    expect(bridge.endCapture).toHaveBeenCalledWith("capture-id");
    expect(bridge.captureReady).not.toHaveBeenCalled();
  });

  it("rejects older desktop apps without falling back to browser microphone capture", async () => {
    const { controller, bridge } = setup({ beginCapture: undefined });
    const getUserMedia = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    await expect(controller.requestPermission()).rejects.toThrow(
      "DESKTOP_CAPTURE_UPDATE_REQUIRED"
    );
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(bridge.captureReady).not.toHaveBeenCalled();
  });
});
