import { useQueryClient } from "@tanstack/react-query";

import {
  getGetUnreadNotificationCountQueryKey,
  type getUnreadNotificationCountResponse,
  useMarkNotificationRead,
} from "@/lib/api/generated/notifications/notifications";
import { markReadInCache } from "@/lib/notification/notification-list";

const pending = new Set<string>();

export function useReadNotification() {
  const queryClient = useQueryClient();
  // 훅 단 콜백이라 화면이 내려가도 불립니다. `mutate` 단 콜백은 그때 빠집니다.
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
