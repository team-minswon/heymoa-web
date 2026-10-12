import { useSyncExternalStore } from "react";

import { desktopAuthBridge } from "@/lib/desktop/auth";

const subscribe = () => () => {};

/**
 * 데스크톱 앱 안인가. **서버는 모르므로 하이드레이션 동안은 `null`(모름)이다** — 렌더에서
 * `window`를 바로 보면 앱 안에서 서버 HTML과 첫 렌더가 갈린다. 브라우저 전용 안내(「데스크톱 앱
 * 받기」)는 `=== false`일 때만 그린다. 앱 안에서 한 번 보였다 사라지지 않게.
 */
export function useDesktopApp(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => Boolean(desktopAuthBridge()),
    () => null
  );
}
