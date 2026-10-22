import { setupWorker } from "msw/browser";

import { handlers } from "@/lib/mocks/handlers";
import { mockNotificationArrives } from "@/lib/mocks/user-events";

export const worker = setupWorker(...handlers);

/**
 * 목 모드에서 사람이 콘솔로 밟는 손잡이. `heymoaMock.notify()` — 새 알림이 도착하고 이벤트 스트림 힌트로 사이드바 개수와
 * 열린 알림 모달의 「새 알림 N개」가 따라온다(APP-1361). e2e 도 같은 것을 부른다.
 */
declare global {
  interface Window {
    heymoaMock?: { notify: typeof mockNotificationArrives };
  }
}
window.heymoaMock = { notify: mockNotificationArrives };
