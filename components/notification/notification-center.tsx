"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { NotificationModal } from "@/components/notification/notification-modal";
import { track } from "@/lib/analytics/track";
import { useGetUnreadNotificationCount } from "@/lib/api/generated/notifications/notifications";
import {
  NOTIFICATION_SCHEMA,
  notificationModalMemory,
  rememberNotificationModal,
  UNREAD_COUNT_POLL_MS,
  type NotificationFilter,
} from "@/lib/notification/notification-list";
import {
  clearNotifications,
  NOTIFICATIONS_PARAM,
  notificationsFilterFrom,
  parseNotificationsParam,
  pushNotifications,
  replaceNotifications,
} from "@/lib/notification/notification-url";
import type { SettingsSection } from "@/lib/workspace/settings-url";
import { useEventStreamHealthy } from "@/lib/events/health";
import { hintedInterval } from "@/lib/events/interval";

type NotificationCenter = {
  unreadCount: number | undefined;
  openNotifications: () => void;
};

const NotificationCenterContext = createContext<NotificationCenter | null>(
  null
);

export function useNotificationCenter() {
  return useContext(NotificationCenterContext);
}

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
  const streamHealthy = useEventStreamHealthy();
  const count = useGetUnreadNotificationCount(
    { schema: NOTIFICATION_SCHEMA },
    {
      query: {
        refetchInterval: hintedInterval(streamHealthy, UNREAD_COUNT_POLL_MS),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    }
  );
  const unreadCount =
    count.data?.status === 200 && count.data.data.success
      ? count.data.data.data.unreadCount
      : undefined;

  // 첫 커밋 뒤에만 읽는다 — hydration 전 `history` 호출은 라우터 상태를 지운다(`workspace-app-shell` 의 `committed`).
  const searchParams = useSearchParams();
  const [committed, setCommitted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 첫 커밋을 표시하는 것 자체가 목적이다
  useEffect(() => setCommitted(true), []);
  const param = searchParams.get(NOTIFICATIONS_PARAM);
  const urlFilter = notificationsFilterFrom(searchParams);
  const open = committed && urlFilter !== null;
  const [shownFilter, setShownFilter] = useState<NotificationFilter>(
    notificationModalMemory.filter
  );
  if (urlFilter !== null && urlFilter !== shownFilter) {
    setShownFilter(urlFilter);
  }
  useEffect(() => {
    if (open) rememberNotificationModal({ filter: shownFilter });
  }, [open, shownFilter]);
  useEffect(() => {
    if (committed && param !== null && parseNotificationsParam(param) === null)
      replaceNotifications("ALL");
  }, [committed, param]);

  const depthRef = useRef(0);
  const pushedRef = useRef(false);
  useEffect(() => {
    const onPop = () => {
      if (depthRef.current > 0) depthRef.current -= 1;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openNotifications = useCallback(() => {
    track("notifications_opened", {
      workspace_id: workspaceId,
      unread_count: unreadCount ?? 0,
    });
    if (new URLSearchParams(window.location.search).has(NOTIFICATIONS_PARAM))
      return;
    pushNotifications(notificationModalMemory.filter);
    depthRef.current = 1;
    pushedRef.current = true;
  }, [unreadCount, workspaceId]);

  const changeFilter = useCallback((next: NotificationFilter) => {
    pushNotifications(next);
    depthRef.current += 1;
  }, []);

  const openSettingsOver = useCallback(
    (section: SettingsSection) => {
      depthRef.current += 1;
      onOpenSettings(section);
    },
    [onOpenSettings]
  );

  const close = useCallback((then?: () => void) => {
    const depth = depthRef.current;
    const pushed = pushedRef.current;
    depthRef.current = 0;
    pushedRef.current = false;
    const finish = () => {
      if (!pushed) clearNotifications();
      then?.();
    };
    if (depth === 0) return finish();
    window.addEventListener("popstate", finish, { once: true });
    window.history.go(-depth);
  }, []);

  const value = useMemo(
    () => ({ unreadCount, openNotifications }),
    [openNotifications, unreadCount]
  );

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
      <NotificationModal
        open={open}
        filter={shownFilter}
        onFilterChange={changeFilter}
        onClose={close}
        workspaceId={workspaceId}
        unreadCount={unreadCount}
        onOpenSettings={openSettingsOver}
        onNavigate={(href) => router.push(href)}
      />
    </NotificationCenterContext.Provider>
  );
}
