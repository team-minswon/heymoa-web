import type { NotificationFilter } from "@/lib/notification/notification-list";
import { hrefWithParam, SETTINGS_PARAM } from "@/lib/workspace/settings-url";

/**
 * 알림 모달을 주소(`?notifications=all|unread|action`)에 남기는 길(APP-1361). 설정 창(`settings-url`)과 같은 방식이다 —
 * 같은 화면 안의 상태라 라우터가 아니라 `history.pushState` 다(rule `architecture`). RSC 왕복은 안 나간다.
 *
 * **탭도 push 다.** 설정 창의 탭은 replace 인데 여기는 다르게 골랐다 — 세 탭은 같은 알림을 거른 「다른 목록」이라
 * 메일함의 폴더처럼 오가고, 사용자가 탭을 옮긴 뒤 뒤로 가기로 앞 탭에 돌아오기를 기대했다. 대신 닫기·이동은
 * 쌓은 칸 수만큼 한 번에 되돌린다(`history.go(-n)`) — 닫은 뒤 뒤로 가기가 지난 탭들을 다시 여는 일이 없다.
 */
export const NOTIFICATIONS_PARAM = "notifications";

const TO_PARAM: Record<NotificationFilter, string> = {
  ALL: "all",
  UNREAD: "unread",
  ACTION_REQUIRED: "action",
};

/** 주소 값 → 탭. 모르는 값이면 `null`. */
export function parseNotificationsParam(
  value: string | null
): NotificationFilter | null {
  const entry = Object.entries(TO_PARAM).find(([, param]) => param === value);
  return entry ? (entry[0] as NotificationFilter) : null;
}

/** 열기·탭 바꾸기 — 방문 기록을 하나 쌓는다. 설정 창 쿼리는 같이 걷는다(둘은 동시에 열리지 않는다). */
export function pushNotifications(filter: NotificationFilter) {
  window.history.pushState(
    null,
    "",
    hrefWithParam(NOTIFICATIONS_PARAM, TO_PARAM[filter], [SETTINGS_PARAM])
  );
}

/** 기록을 안 쌓고 탭을 바꾼다(모르는 값 고치기). */
export function replaceNotifications(filter: NotificationFilter) {
  window.history.replaceState(
    null,
    "",
    hrefWithParam(NOTIFICATIONS_PARAM, TO_PARAM[filter])
  );
}

/** 기록을 안 쌓고 `notifications` 만 지운다. */
export function clearNotifications() {
  window.history.replaceState(
    null,
    "",
    hrefWithParam(NOTIFICATIONS_PARAM, null)
  );
}
