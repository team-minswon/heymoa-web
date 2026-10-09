"use client";

import { useEffect } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { identifyUser, initAnalytics } from "@/lib/analytics/track";

/** PostHog를 켜고 로그인한 사람을 userId로 묶는다. 켤지는 `SiteAnalytics`가 정한다. */
export function PostHogAnalytics({ apiKey }: { apiKey: string }) {
  const userId = useAuth().user?.userId;

  // 같은 커밋에서 위에서부터 돈다 — identify가 init보다 먼저 불리지 않는다.
  useEffect(() => initAnalytics(apiKey), [apiKey]);
  useEffect(() => {
    if (userId) identifyUser(userId);
  }, [userId]);

  return null;
}
