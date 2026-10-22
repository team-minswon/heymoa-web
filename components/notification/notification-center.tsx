"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { NotificationModal } from "@/components/notification/notification-modal";
import { track } from "@/lib/analytics/track";
import { useGetUnreadNotificationCount } from "@/lib/api/generated/notifications/notifications";
import {
  NOTIFICATION_SCHEMA,
  UNREAD_COUNT_POLL_MS,
} from "@/lib/notification/notification-list";
import type { SettingsSection } from "@/lib/workspace/settings-url";

type NotificationCenter = {
  /** 모든 워크스페이스의 안 읽은 개수. 아직 모르면 `undefined` — 0과 다르다 */
  unreadCount: number | undefined;
  openNotifications: () => void;
};

const NotificationCenterContext = createContext<NotificationCenter | null>(
  null
);

/** 셸 밖(설정 페이지 등)에서는 `null` 이다 — 진입점을 그리지 않는다. */
export function useNotificationCenter() {
  return useContext(NotificationCenterContext);
}

/**
 * 알림 개수와 모달을 셸이 한 번 소유한다. 사이드바 「알림」과 전체 화면 노트의 헤더 진입점이 같은 것을 읽고 연다.
 *
 * 개수는 탭이 보이는 동안 60초마다, 그리고 창 포커스·온라인 복귀 때 다시 읽는다(숨은 탭은 쉬고, 복귀 때 모달을 띄우지
 * 않는다). 다른 탭에서 읽은 것도 이 조회로 맞춰진다. 조회가 실패해도 마지막 값을 그대로 둔다 — 0으로 바꾸지 않는다.
 */
export function NotificationCenterProvider({
  workspaceId,
  onOpenSettings,
  children,
}: {
  workspaceId: string;
  onOpenSettings: (section: SettingsSection) => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const count = useGetUnreadNotificationCount(
    { schema: NOTIFICATION_SCHEMA },
    {
      query: {
        refetchInterval: UNREAD_COUNT_POLL_MS,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    }
  );
  const unreadCount =
    count.data?.status === 200 && count.data.data.success
      ? count.data.data.data.unreadCount
      : undefined;
  const [open, setOpen] = useState(false);

  const openNotifications = useCallback(() => {
    track("notifications_opened", {
      workspace_id: workspaceId,
      unread_count: unreadCount ?? 0,
    });
    setOpen(true);
  }, [unreadCount, workspaceId]);

  const value = useMemo(
    () => ({ unreadCount, openNotifications }),
    [openNotifications, unreadCount]
  );

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
      <NotificationModal
        open={open}
        onOpenChange={setOpen}
        workspaceId={workspaceId}
        unreadCount={unreadCount}
        onOpenSettings={onOpenSettings}
        onNavigate={(href) => router.push(href)}
      />
    </NotificationCenterContext.Provider>
  );
}
