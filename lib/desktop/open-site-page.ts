import { desktopAuthBridge } from "@/lib/desktop/auth";

/**
 * 우리 사이트의 다른 페이지(`/help`·`/privacy` 등)를 연다. 브라우저에서는 새 탭으로 — 보던 회의를 잃지 않게.
 *
 * **데스크톱 앱에서는 앱 안에서 이동한다.** 앱은 새 창 요청을 막고 외부 브라우저로 넘기는데
 * (`apps/desktop/src/security.ts`의 `setWindowOpenHandler`), 같은 사이트 주소는 넘기지 않는다
 * (`policy.ts`의 `externalUrl`). 새 탭으로 열면 앱에서는 아무 일도 안 일어났다(codex 리뷰).
 * 녹음 상태는 최상위 Provider에 있어 앱 안 이동에도 이어진다.
 */
export function openSitePage(href: string, navigate: (href: string) => void) {
  if (desktopAuthBridge()) navigate(href);
  else window.open(href, "_blank", "noopener,noreferrer");
}
