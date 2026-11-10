"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import {
  identifyUser,
  initAnalytics,
  syncSessionReplay,
  setSessionReplayConsent,
} from "@/lib/analytics/track";

import { useGetCurrentUser } from "@/lib/api/generated/users/users";
import { SessionReplayNotice } from "./session-replay-notice";

/** PostHog를 켜고 로그인한 사람을 userId로 묶는다. 켤지는 `SiteAnalytics`가 정한다. */
export function PostHogAnalytics({ apiKey }: { apiKey: string }) {
  const userId = useAuth().user?.userId;
  const pathname = usePathname();
  const { data } = useGetCurrentUser({
    query: {
      queryKey: ["/v1/users/me", "replay-consent", userId],
      enabled: !!userId,
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  });
  const account =
    data?.status === 200 && data.data.success ? data.data.data : undefined;

  // 같은 커밋에서 위에서부터 돈다 — identify가 init보다 먼저 불리지 않는다.
  useEffect(() => initAnalytics(apiKey), [apiKey]);
  useEffect(() => {
    if (userId) identifyUser(userId);
  }, [userId]);
  useEffect(() => {
    setSessionReplayConsent(
      account?.userId === userId ? (account?.consents ?? []) : []
    );
  }, [account, userId]);
  useEffect(() => syncSessionReplay(), [pathname]);

  return <SessionReplayNotice />;
}
