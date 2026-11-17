import type { DesktopAuthBridge } from "@heymoa/desktop-contracts";
export type {
  DesktopAuthOutcome,
  DesktopConnection,
} from "@heymoa/desktop-contracts";

export function desktopAuthBridge(): DesktopAuthBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { heymoaDesktop?: DesktopAuthBridge })
    .heymoaDesktop;
}
