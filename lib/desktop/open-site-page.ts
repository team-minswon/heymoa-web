import { desktopAuthBridge } from "@/lib/desktop/auth";
import { toast } from "@/lib/ui/toast";

/**
 * 우리 사이트의 다른 페이지(`/help`·`/privacy` 등)를 연다. 브라우저에서는 새 탭으로 — 보던 회의를 잃지 않게.
 *
 * **데스크톱 앱에서는 앱 안에서 이동한다.** 앱은 새 창 요청을 막고 외부 브라우저로 넘기는데
 * (`apps/desktop/src/security.ts`의 `setWindowOpenHandler`), 같은 사이트 주소는 넘기지 않는다
 * (`policy.ts`의 `externalUrl`). 새 탭으로 열면 앱에서는 아무 일도 안 일어났다(codex 리뷰).
 * 사이트 페이지는 제품 면과 다른 루트 레이아웃이라 이 이동은 전체 로드다 — 녹음 중이면 막는다
 * (`blockedByRecording`).
 */
export function openSitePage(href: string, navigate: (href: string) => void) {
  if (!desktopAuthBridge()) window.open(href, "_blank", "noopener,noreferrer");
  else if (!blockedByRecording(href)) navigate(href);
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
  toast.info("녹음 중에는 앱에서 다른 페이지를 열 수 없습니다", {
    id: "site-page-blocked",
    description: `녹음을 마친 뒤 다시 눌러 주세요. 지금 보려면 브라우저에서 여세요: ${new URL(href, window.location.origin).href}`,
  });
  return true;
}
