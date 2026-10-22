import { setupWorker } from "msw/browser";

import { mockDb } from "@/lib/mocks/db";
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

/**
 * 로그인 동의(APP-1277)는 페이지를 새로 여는 `/auth/callback` 에서 보이므로 콘솔이 아니라 localStorage 로 켠다.
 * `localStorage.mockConsent = "required"` — 지금 판에 동의하지 않은 기존 사용자. `/auth/callback` 을 열면 체크박스를 받는다.
 * `localStorage.mockConsentFail = "1"` — 다음 동의 기록 N번이 500 이다. 대시보드 앞에서 「다시 시도」를 본다.
 * 표시가 없는 callback 은 체크박스부터 받으니, 다시 시도 화면은 로그인 창에서 체크한 뒤(목은 로그인이 없으므로
 * `sessionStorage["heymoa:login-consent"] = Date.now()`) callback 을 열어 본다. 끄려면 키를 지운다.
 */
try {
  if (window.localStorage.getItem("mockConsent") === "required") {
    mockDb.requireConsent();
  }
  const failures = Number(window.localStorage.getItem("mockConsentFail"));
  if (failures > 0) mockDb.failNextConsents(failures);
} catch {
  // 저장소를 못 쓰면 손잡이 없이 연다.
}
