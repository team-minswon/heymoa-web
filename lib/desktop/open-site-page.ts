import { desktopAuthBridge } from "@/lib/desktop/auth";
import { toast } from "@/lib/ui/toast";
import { webMessage } from "@/lib/i18n/web-message";

export function openSitePage(href: string, navigate: (href: string) => void) {
  if (!desktopAuthBridge()) window.open(href, "_blank", "noopener,noreferrer");
  else {
    const bridge = (window as unknown as { heymoaDesktop?: import("@heymoa/desktop-contracts").DesktopFoundationBridge }).heymoaDesktop;
    if (bridge?.openSitePage) void bridge.openSitePage(href).catch(() => {
      toast.error(webMessage("sitePageOpenFailed"));
    });
    else if (!blockedByRecording(href)) navigate(href);
  }
}

// 앱(Electron)은 beforeunload 거부를 받으면 안내 없이 이동을 취소해 링크가 죽은 것처럼 보입니다. 같은 거부를 미리 물어봅니다.
export function blockedByRecording(href: string): boolean {
  const leaving = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(leaving);
  if (!leaving.defaultPrevented) return false;
  toast.info(webMessage("pageBlockedByRecording"), {
    id: "site-page-blocked",
    description: webMessage("pageBlockedByRecordingDetail", {
      url: new URL(href, window.location.origin).href,
    }),
  });
  return true;
}
