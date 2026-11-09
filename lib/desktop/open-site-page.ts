import { desktopAuthBridge } from "@/lib/desktop/auth";
import { toast } from "@/lib/ui/toast";
import { webMessage } from "@/lib/i18n/web-message";

/** 새 앱은 공개 사이트 페이지를 외부 브라우저로 열어 녹음을 유지하고, 구버전은 기존 이탈 보호를 따른다. */
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

/**
 * 앱 안에서 이 화면을 떠나면 녹음이 끊기는가. 그렇다면 이동하지 않고 알린다(true 를 돌려준다).
 *
 * 녹음은 `beforeunload` 로 화면을 붙잡는다(`recording-provider.tsx`의 `holdTab`). 앱(Electron)은 그 거부를
 * 받으면 **아무 안내 없이** 이동을 취소해서 링크가 죽은 것처럼 보였다. 같은 거부를 미리 물어본다 — 녹음
 * 상태를 따로 읽지 않으니 붙잡는 조건이 바뀌어도 여기는 그대로 맞는다.
 */
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
