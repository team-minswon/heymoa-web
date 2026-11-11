import type { DesktopUpdateBridge } from "@heymoa/desktop-contracts";

export function desktopUpdateBridge(): DesktopUpdateBridge | undefined {
  if (typeof window === "undefined") return;
  const bridge = (
    window as unknown as { heymoaDesktop?: Partial<DesktopUpdateBridge> }
  ).heymoaDesktop;
  if (
    bridge &&
    [
      bridge.getUpdateState,
      bridge.checkForUpdates,
      bridge.setAutomaticUpdates,
      bridge.restartForUpdate,
      bridge.subscribeUpdates,
    ].every((method) => typeof method === "function")
  )
    return bridge as DesktopUpdateBridge;
}
