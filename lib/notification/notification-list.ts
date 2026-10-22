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

export type NotificationItem = NotificationListResponseDataNotificationsItem;
export type NotificationPage = NotificationListResponseData;
export type NotificationFilter = GetNotificationsFilter;

/**
 * 응답 스키마 표식(PRO-67 I06). 붙이면 서버가 초대 밖의 종류와 원본이 지워진 초대도 낸다 — 옛 번들은 안 붙여서
 * 그리지 못할 종류를 받지 않는다. 목록과 개수가 같은 값을 실어야 배지와 목록이 같은 기준으로 센다.
 */
export const NOTIFICATION_SCHEMA = "2";
const PAGE_LIMIT = "20";

/** 탭이 보이는 동안의 개수 조회 간격. 트랙 C 뒤에는 힌트가 앞당긴다(I04). */
export const UNREAD_COUNT_POLL_MS = 60_000;

const listParams = (filter: NotificationFilter) => ({
  filter,
  schema: NOTIFICATION_SCHEMA,
  limit: PAGE_LIMIT,
});

/** 탭(서버 필터)마다 하나인 무한 목록의 키. 첫 칸이 `/v1/notifications` 라 그 접두로 무효화하면 같이 집힌다. */
export const notificationListKey = (filter: NotificationFilter) =>
  getGetNotificationsQueryKey(listParams(filter));

/** 열린 모달이 「새 알림 N개」를 세려고 다시 읽는 첫 쪽. 목록과 키가 달라 이걸 읽어도 보던 목록은 그대로다. */
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

/**
 * 받은 첫 쪽 가운데 보던 목록 맨 위보다 새것의 수. 목록이 비었으면 첫 쪽 전부다.
 * 읽는 도중 새 알림을 목록에 끼워 넣지 않고 이 수만 알린다(userflow 알림 목록).
 */
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

/**
 * 캐시의 알림 목록(무한 목록·첫 쪽 모두)의 항목을 고친다. 서버 응답을 받은 뒤 목록 전체를 다시 읽지 않는다 —
 * 무한 목록을 무효화하면 불러온 쪽 수만큼 차례로 다시 읽는다.
 */
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

/** 전체 탭의 날짜 머리. 오늘·어제 말고는 「10월 14일(수)」. `now` 는 검사에서만 넘긴다. */
export function dayLabel(createdAt: string, now = new Date()) {
  const key = getAppDateKey(createdAt);
  if (key === getAppDateKey(now)) return "오늘";
  if (key === getAppDateKey(new Date(now.getTime() - 86_400_000)))
    return "어제";
  const date = formatAppDate(createdAt, { month: "long", day: "numeric" });
  const weekday = formatAppDate(createdAt, { weekday: "short" });
  return `${date}(${weekday})`;
}

/**
 * 모달을 닫았다 열어도 돌아올 자리. **모듈 상태다** — 다른 워크스페이스의 노트로 이동하면 셸이 다시 마운트되는데,
 * 알림은 모든 워크스페이스의 것이라 그때도 보던 탭·스크롤·마지막으로 누른 행이 남아야 한다. 불러온 쪽은 쿼리 캐시가 든다.
 * 문서를 새로 열면 처음부터다.
 */
export const notificationModalMemory = {
  filter: "ALL" as NotificationFilter,
  scrollTop: 0,
  lastNotificationId: null as string | null,
};
