import type { NotificationFilter } from "@/lib/notification/notification-list";
import { hrefWithParam, SETTINGS_PARAM } from "@/lib/workspace/settings-url";

export const NOTIFICATIONS_PARAM = "notifications";

const TO_PARAM: Record<NotificationFilter, string> = {
  ALL: "all",
  UNREAD: "unread",
  ACTION_REQUIRED: "action",
};

export function parseNotificationsParam(
  value: string | null
): NotificationFilter | null {
  const entry = Object.entries(TO_PARAM).find(([, param]) => param === value);
  return entry ? (entry[0] as NotificationFilter) : null;
}

export function notificationsFilterFrom(params: {
  get(name: string): string | null;
  has(name: string): boolean;
}): NotificationFilter | null {
  const value = params.get(NOTIFICATIONS_PARAM);
  if (value === null || params.has(SETTINGS_PARAM)) return null;
  return parseNotificationsParam(value) ?? "ALL";
}

export function pushNotifications(filter: NotificationFilter) {
  window.history.pushState(
    null,
    "",
    hrefWithParam(NOTIFICATIONS_PARAM, TO_PARAM[filter], [SETTINGS_PARAM])
  );
}

export function replaceNotifications(filter: NotificationFilter) {
  window.history.replaceState(
    null,
    "",
    hrefWithParam(NOTIFICATIONS_PARAM, TO_PARAM[filter])
  );
}

export function clearNotifications() {
  window.history.replaceState(
    null,
    "",
    hrefWithParam(NOTIFICATIONS_PARAM, null)
  );
}
