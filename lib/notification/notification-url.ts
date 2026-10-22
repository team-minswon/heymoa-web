import type { NotificationFilter } from "@/lib/notification/notification-list";
import { hrefWithParam, SETTINGS_PARAM } from "@/lib/workspace/settings-url";

/**
 * 알림 모달을 주소(`?notifications=all|unread|action`)에 남기는 길(APP-1361). 설정 창(`settings-url`)과 같은 방식이다 —
 * 같은 화면 안의 상태라 라우터가 아니라 `history.pushState` 다(rule `architecture`). RSC 왕복은 안 나간다.
 *
 * **탭도 push 다.** 설정 창의 탭은 replace 인데 여기는 다르게 골랐다 — 세 탭은 같은 알림을 거른 「다른 목록」이라
 * 메일함의 폴더처럼 오가고, 사용자가 탭을 옮긴 뒤 뒤로 가기로 앞 탭에 돌아오기를 기대했다. 대신 닫기·이동은
 * 쌓은 칸 수만큼 한 번에 되돌린다(`history.go(-n)`) — 닫은 뒤 뒤로 가기가 지난 탭들을 다시 여는 일이 없다.
 *
 * **설정 창(`?settings=`)과의 관계는 여기 한곳이 정한다(APP-1363).** 설정은 알림 위에 얹히는 층이다.
 * - 둘이 같이 있으면 설정이 보이고 알림은 숨는다(`notificationsFilterFrom`). 알림 쿼리는 지우지 않는다 —
 *   「알림 설정」이 알림 주소 위에 `settings` 를 push 하므로, 뒤로 가기든 설정의 X(쌓은 칸을 `back()` 으로 걷는다)든
 *   `settings` 만 빠지면 알림이 같은 탭으로 다시 보인다.
 * - 알림을 새로 열거나 탭을 바꿀 때는 `settings` 를 걷는다(`pushNotifications`) — 알림이 맨 위가 된다.
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

/**
 * 주소 → 지금 보일 알림 탭. 알림 쿼리가 없거나 설정이 위에 얹혀 있으면 `null`(닫힘), 모르는 값이면 `ALL`.
 */
export function notificationsFilterFrom(params: {
  get(name: string): string | null;
  has(name: string): boolean;
}): NotificationFilter | null {
  const value = params.get(NOTIFICATIONS_PARAM);
  if (value === null || params.has(SETTINGS_PARAM)) return null;
  return parseNotificationsParam(value) ?? "ALL";
}

/** 열기·탭 바꾸기 — 방문 기록을 하나 쌓는다. 위에 얹힌 설정 창 쿼리는 같이 걷는다. */
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
