"use client";

import { useEffect, useEffectEvent, useSyncExternalStore } from "react";

import { useNotificationCenter } from "@/components/notification/notification-center";
import { fetchNotificationPage } from "@/lib/notification/notification-list";
import { useReadNotification } from "@/lib/notification/use-notification-read";

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/**
 * 검토할 결과 준비 알림의 자동 읽음(PRO-67 I23). 그 노트의 결과가 요약·검토 화면에 **실제로 그려졌고 창이 보일 때만**
 * 안 읽은 결과 알림을 읽음으로 바꾼다. 다른 탭(이 훅이 마운트되지 않는다)·숨은 창·불러오기 실패에서는 하지 않는다.
 *
 * 안 읽은 개수가 바뀔 때마다 다시 본다 — 화면을 보는 중에 결과가 와서 알림이 늦게 생겨도 토스트 없이 읽음이 된다.
 * 셸 밖(알림 센터 없음)이거나 안 읽은 것이 없으면 아무 요청도 하지 않는다.
 */
export function useReadAnalysisReadyOnView(noteId: string, displayed: boolean) {
  const unreadCount = useNotificationCenter()?.unreadCount;
  const visible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => false
  );
  const read = useReadNotification();
  const readMatching = useEffectEvent(
    async (signal: { cancelled: boolean }) => {
      const page = await fetchNotificationPage("UNREAD", {});
      if (signal.cancelled) return;
      for (const item of page.notifications) {
        if (
          item.type === "ANALYSIS_READY" &&
          item.readAt === null &&
          item.payload?.noteId === noteId
        )
          read(item.notificationId);
      }
    }
  );

  useEffect(() => {
    if (!displayed || !visible || !unreadCount) return;
    const signal = { cancelled: false };
    readMatching(signal).catch(() => undefined);
    return () => {
      signal.cancelled = true;
    };
  }, [displayed, visible, unreadCount, noteId]);
}
