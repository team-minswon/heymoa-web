import { useQueryClient } from "@tanstack/react-query";

import {
  getGetUnreadNotificationCountQueryKey,
  type getUnreadNotificationCountResponse,
  useMarkNotificationRead,
} from "@/lib/api/generated/notifications/notifications";
import { markReadInCache } from "@/lib/notification/notification-list";

/** 요청 중인 읽음. 같은 알림을 거듭 읽어도(검토 화면의 재조회 등) 배지는 한 번만 내린다. */
const pending = new Set<string>();

/**
 * 알림 하나를 읽는다. 캐시를 먼저 고쳐 점이 바로 빠지고(애니메이션) 사이드바 배지도 바로 하나 내린 뒤, 끝나면 개수만
 * 다시 읽는다 — 목록은 다시 읽지 않는다. 실패는 전역 토스트가 알리고 그 재조회가 배지를 되돌린다.
 * 부르는 쪽은 안 읽은 알림에만 부른다.
 */
export function useReadNotification() {
  const queryClient = useQueryClient();
  // 요청이 끝나면 풀어 준다. 훅 단의 콜백이라 화면이 내려가도(이동) 불린다 — `mutate` 단 콜백은 그때 빠진다.
  const markRead = useMarkNotificationRead({
    mutation: {
      onSettled: (_data, _error, { notificationId }) => {
        pending.delete(notificationId);
        void queryClient.invalidateQueries({
          queryKey: getGetUnreadNotificationCountQueryKey(),
        });
      },
    },
  });
  return (notificationId: string) => {
    if (pending.has(notificationId)) return;
    pending.add(notificationId);
    queryClient.setQueriesData<getUnreadNotificationCountResponse>(
      { queryKey: getGetUnreadNotificationCountQueryKey() },
      (data) =>
        data?.status === 200 && data.data.success
          ? {
              ...data,
              data: {
                ...data.data,
                data: {
                  ...data.data.data,
                  unreadCount: Math.max(0, data.data.data.unreadCount - 1),
                },
              },
            }
          : data
    );
    markReadInCache(
      queryClient,
      (item) => item.notificationId === notificationId,
      new Date().toISOString()
    );
    markRead.mutate({ notificationId });
  };
}
