import type { DesktopBridge } from "@heymoa/desktop-contracts";

export function desktopBridge() {
  return typeof window === "undefined"
    ? undefined
    : (window as unknown as { heymoaDesktop?: DesktopBridge }).heymoaDesktop;
}
