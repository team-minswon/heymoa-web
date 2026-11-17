import { useSyncExternalStore } from "react";

import { desktopAuthBridge } from "@/lib/desktop/auth";

const subscribe = () => () => {};

// 서버는 모르므로 하이드레이션 동안은 null(모름)입니다. 브라우저 전용 안내는 `=== false` 일 때만 그립니다.
export function useDesktopApp(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => Boolean(desktopAuthBridge()),
    () => null
  );
}
