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
 * 알림 개수와 모달을 셸이 한 번 소유한다. 사이드바 「알림」이 읽고 연다.
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
  const streamHealthy = useEventStreamHealthy();
  const count = useGetUnreadNotificationCount(
    { schema: NOTIFICATION_SCHEMA },
    {
      query: {
        // 건강한 이벤트 스트림이면 `notifications.changed` 힌트가 다시 읽게 한다(PRO-67 I04). 시작값이 이미 60초라
        // 안전망과 같다 — 힌트가 앞당기는 것이 차이다.
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

  // 모달과 탭은 주소(`?notifications=all|unread|action`)가 단일 출처다(APP-1361) — 새로고침·딥링크·뒤로 가기가 그대로
  // 되살린다. 설정 창(`?settings=`)이 위에 얹혀 있으면 숨는다(규칙은 `notification-url`). 첫 커밋 뒤에만 읽는다 —
  // 셸(`workspace-app-shell`)의 `committed` 와 같은 이유다(hydration 전 `history` 호출은 라우터 상태를 지운다).
  const searchParams = useSearchParams();
  const [committed, setCommitted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 첫 커밋을 표시하는 것 자체가 목적이다
  useEffect(() => setCommitted(true), []);
  const param = searchParams.get(NOTIFICATIONS_PARAM);
  const urlFilter = notificationsFilterFrom(searchParams);
  const open = committed && urlFilter !== null;
  // 닫히는 동안(페이드)에도 마지막 탭을 그린다 — 주소에서 값이 사라져도 내용이 다른 탭으로 뒤집히지 않게.
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

  /**
   * 열고 나서 우리가 쌓은 방문 기록 칸 수(열기 1 + 탭마다 1)와, 열기 자체를 우리가 쌓았는지. 닫기·이동은 이만큼
   * 한 번에 되돌린다 — 닫은 뒤 뒤로 가기가 지난 탭을 다시 열지 않게. 뒤로 가기마다 한 칸씩 준다.
   * ponytail: 앞으로 가기는 세지 않는다(드묾). 그 뒤 닫으면 한두 칸 덜 걷힐 뿐 주소는 맞다.
   */
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

  /**
   * 「알림 설정」 — 알림을 닫지 않고 그 위에 설정을 push 로 얹는다(APP-1363). 뒤로 가기·설정 X 가 그 한 칸을 걷으면
   * 알림이 같은 탭으로 돌아온다. 그 한 칸도 우리 위에 쌓인 것이라 센다 — 걷힐 때 popstate 가 한 칸 빼 준다.
   */
  const openSettingsOver = useCallback(
    (section: SettingsSection) => {
      depthRef.current += 1;
      onOpenSettings(section);
    },
    [onOpenSettings]
  );

  /** 쌓은 칸을 걷고(딥링크로 열렸으면 쿼리를 지우고) 나서 `then` 을 한다 — 이동이 걷히는 중에 끼지 않게. */
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
