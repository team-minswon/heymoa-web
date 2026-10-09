import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { NotificationListResponseDataNotificationsItem } from "@/lib/api/generated/models";
import {
  getGetNotificationsQueryKey,
  getNotifications,
  type getNotificationsResponse,
} from "@/lib/api/generated/notifications/notifications";

/**
 * 알림 벨의 목록. 쪽 수만큼 이어 붙인 한 응답을 돌려준다 (APP-1015).
 *
 * 서버는 한 쪽을 최대 50개로 고정하고 `limit` 이 없다. 쪽 수가 키에 들어가므로 읽음·수락·거절 뒤의
 * `invalidateQueries({ queryKey: getGetNotificationsQueryKey() })` 가 이 목록도 집는다(키 첫 칸이 같다).
 * `unreadCount` 는 목록 전체의 값이라 마지막으로 읽은 쪽의 것을 쓴다.
 */
export function useNotificationListPages({ pages }: { pages: number }) {
  return useQuery({
    queryKey: [...getGetNotificationsQueryKey(), { pages }],
    queryFn: async ({
      signal,
    }): Promise<getNotificationsResponse & { partial?: boolean }> => {
      const merged: NotificationListResponseDataNotificationsItem[] = [];
      let partial = false;
      let last: getNotificationsResponse | undefined;
      for (let page = 0; page < pages; page += 1) {
        const cursor =
          last?.status === 200 && last.data.data?.nextNotificationId
            ? {
                afterCreatedAt: last.data.data.nextCreatedAt ?? undefined,
                afterNotificationId: last.data.data.nextNotificationId,
              }
            : undefined;
        let response: getNotificationsResponse;
        try {
          response = await getNotifications(cursor, { signal });
        } catch (error) {
          // 첫 쪽이 아니면 읽은 곳까지만 돌려준다 — 던지면 보던 목록이 통째로 사라진다.
          if (page > 0 && !signal.aborted) {
            partial = true;
            break;
          }
          throw error;
        }
        if (response.status !== 200 || !response.data.success) {
          if (page > 0) {
            partial = true;
            break;
          }
          return response;
        }
        for (const item of response.data.data.notifications) {
          if (
            !merged.some((seen) => seen.notificationId === item.notificationId)
          ) {
            merged.push(item);
          }
        }
        last = response;
        if (!response.data.data.hasMore) break;
      }
      const tail = last?.status === 200 ? last.data.data : undefined;
      return {
        partial,
        status: 200,
        headers: last?.headers ?? new Headers(),
        data: {
          success: true,
          error: null,
          data: {
            notifications: merged,
            unreadCount: tail?.unreadCount ?? 0,
            hasMore: tail?.hasMore ?? false,
            nextCreatedAt: tail?.nextCreatedAt ?? null,
            nextNotificationId: tail?.nextNotificationId ?? null,
          },
        },
      };
    },
    placeholderData: keepPreviousData,
  });
}
