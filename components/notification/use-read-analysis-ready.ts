"use client";

import { useEffect, useEffectEvent, useSyncExternalStore } from "react";

import { useNotificationCenter } from "@/components/notification/notification-center";
import { fetchNotificationPage } from "@/lib/notification/notification-list";
import { useReadNotification } from "@/lib/notification/use-notification-read";

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

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
