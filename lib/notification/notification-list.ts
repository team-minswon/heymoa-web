import type { QueryClient } from "@tanstack/react-query";

import type {
  GetNotificationsFilter,
  NotificationListResponseData,
  NotificationListResponseDataNotificationsItem,
} from "@/lib/api/generated/models";
import {
  getGetNotificationsQueryKey,
  getNotifications,
} from "@/lib/api/generated/notifications/notifications";
import { getAppDateKey, formatAppDate } from "@/lib/format/date";
import type { DatesT } from "@/lib/i18n/translator";

export type NotificationItem = NotificationListResponseDataNotificationsItem;
type NotificationPage = NotificationListResponseData;
export type NotificationFilter = GetNotificationsFilter;

export const NOTIFICATION_SCHEMA = "2";
const PAGE_LIMIT = "20";

export const UNREAD_COUNT_POLL_MS = 60_000;

const listParams = (filter: NotificationFilter) => ({
  filter,
  schema: NOTIFICATION_SCHEMA,
  limit: PAGE_LIMIT,
});

export const notificationListKey = (filter: NotificationFilter) =>
  getGetNotificationsQueryKey(listParams(filter));

export const notificationHeadKey = (filter: NotificationFilter) =>
  [...notificationListKey(filter), "head"] as const;

export type NotificationCursor = {
  afterCreatedAt?: string;
  afterNotificationId?: string;
};

export async function fetchNotificationPage(
  filter: NotificationFilter,
  cursor: NotificationCursor,
  signal?: AbortSignal
): Promise<NotificationPage> {
  const response = await getNotifications(
    { ...listParams(filter), ...cursor },
    { signal }
  );
  if (response.status !== 200 || !response.data.success) throw response;
  return response.data.data;
}

export function nextCursor(
  page: NotificationPage
): NotificationCursor | undefined {
  if (!page.hasMore || !page.nextNotificationId) return undefined;
  return {
    afterCreatedAt: page.nextCreatedAt ?? undefined,
    afterNotificationId: page.nextNotificationId,
  };
}

export function countNewer(
  head: NotificationItem[],
  shown: NotificationItem[]
): number {
  const top = shown[0];
  const seen = new Set(shown.map((item) => item.notificationId));
  return head.filter(
    (item) =>
      !seen.has(item.notificationId) && (!top || item.createdAt > top.createdAt)
  ).length;
}

type CachedList =
  | NotificationPage
  | { pages: NotificationPage[]; pageParams: unknown[] }
  | undefined;

export function updateNotificationsInCache(
  queryClient: QueryClient,
  update: (item: NotificationItem) => NotificationItem
) {
  const mapPage = (page: NotificationPage): NotificationPage => ({
    ...page,
    notifications: page.notifications.map(update),
  });
  queryClient.setQueriesData<CachedList>(
    { queryKey: getGetNotificationsQueryKey() },
    (data) => {
      if (!data) return data;
      if ("pages" in data) return { ...data, pages: data.pages.map(mapPage) };
      return mapPage(data);
    }
  );
}

export function markReadInCache(
  queryClient: QueryClient,
  pick: (item: NotificationItem) => boolean,
  readAt: string
) {
  updateNotificationsInCache(queryClient, (item) =>
    item.readAt === null && pick(item) ? { ...item, readAt } : item
  );
}

export function dayLabel(
  createdAt: string,
  locale: string,
  t: DatesT,
  now = new Date()
) {
  const key = getAppDateKey(createdAt);
  if (key === getAppDateKey(now)) return t("today");
  if (key === getAppDateKey(new Date(now.getTime() - 86_400_000)))
    return t("yesterday");
  return t("dayHeading", {
    date: formatAppDate(createdAt, { month: "long", day: "numeric" }, locale),
    weekday: formatAppDate(createdAt, { weekday: "short" }, locale),
  });
}

export const notificationModalMemory = {
  filter: "ALL" as NotificationFilter,
  scrollTop: 0,
  lastNotificationId: null as string | null,
};

export function rememberNotificationModal(
  patch: Partial<typeof notificationModalMemory>
) {
  Object.assign(notificationModalMemory, patch);
}
