import type { DesktopAuthBridge } from "@heymoa/desktop-contracts";
export type {
  DesktopAuthOutcome,
  DesktopConnection,
} from "@heymoa/desktop-contracts";

// Authentication runs outside the browser API runtime. The renderer receives
// status only; the native broker keeps PKCE and session exchange private.
export function desktopAuthBridge(): DesktopAuthBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { heymoaDesktop?: DesktopAuthBridge })
    .heymoaDesktop;
}
