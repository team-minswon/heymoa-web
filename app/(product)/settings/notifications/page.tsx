import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { SettingsReturnRedirect } from "@/components/settings/settings-return-redirect";
import { WorkspaceLoginCard } from "@/components/workspace/workspace-login-card";
import { WorkspaceRouteSkeleton } from "@/components/workspace/workspace-route-skeleton";
import { AUTH_COOKIE_NAMES } from "@/lib/auth/cookies";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { privateRouteMetadata } from "@/lib/site";

export const metadata: Metadata = privateRouteMetadata;

// 메일 푸터의 「알림 설정」(APP-1341). 서버에는 기본 워크스페이스가 없어 마지막으로 연 워크스페이스의 알림 탭으로 넘긴다.
// 로그인 전이면 로그인 카드를 세우고, 로그인하면 이 주소로 돌아와 다시 넘긴다(`normalizeReturnTo` 허용 경로).
export default async function SettingsNotificationsPage() {
  const jar = await cookies();
  if (
    !shouldEnableMocking() &&
    !AUTH_COOKIE_NAMES.some((name) => jar.has(name))
  ) {
    return (
      <WorkspaceLoginCard description="알림 설정을 바꾸려면 로그인해 주세요." />
    );
  }
  return (
    <Suspense fallback={<WorkspaceRouteSkeleton />}>
      <SettingsReturnRedirect section="notifications" />
    </Suspense>
  );
}
