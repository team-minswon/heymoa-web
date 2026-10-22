import { useQueryClient } from "@tanstack/react-query";

import {
  getGetUnreadNotificationCountQueryKey,
  useMarkNotificationRead,
} from "@/lib/api/generated/notifications/notifications";
import { markReadInCache } from "@/lib/notification/notification-list";

/**
 * 알림 하나를 읽는다. 캐시를 먼저 고쳐 점이 바로 빠지고(애니메이션), 끝나면 개수만 다시 읽는다 — 목록은 다시 읽지 않는다.
 * 실패는 전역 토스트가 알리고 다음 개수 조회가 배지를 맞춘다.
 */
export function useReadNotification() {
  const queryClient = useQueryClient();
  const markRead = useMarkNotificationRead();
  return (notificationId: string) => {
    markReadInCache(
      queryClient,
      (item) => item.notificationId === notificationId,
      new Date().toISOString()
    );
    markRead.mutate(
      { notificationId },
      {
        onSettled: () =>
          void queryClient.invalidateQueries({
            queryKey: getGetUnreadNotificationCountQueryKey(),
          }),
      }
    );
  };
}
