import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { SettingsReturnRedirect } from "@/components/settings/settings-return-redirect";
import { WorkspaceLoginCard } from "@/components/workspace/workspace-login-card";
import { WorkspaceRouteSkeleton } from "@/components/workspace/workspace-route-skeleton";
import { AUTH_COOKIE_NAMES } from "@/lib/auth/cookies";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { privateRouteMetadata } from "@/lib/site";

export const metadata: Metadata = privateRouteMetadata;

// 결제·환불 완료 메일의 버튼(APP-1598). 워크스페이스를 떠난 결제자도 열 수 있게 워크스페이스 결제 관리가 아니라
// 마지막으로 연 워크스페이스의 「내 결제 내역」 탭으로 넘긴다.
// 로그인 전이면 로그인 카드를 세우고, 로그인하면 이 주소로 돌아와 다시 넘긴다(`normalizeReturnTo` 허용 경로).
export default async function SettingsPaymentsPage() {
  const jar = await cookies();
  if (
    !shouldEnableMocking() &&
    !AUTH_COOKIE_NAMES.some((name) => Boolean(jar.get(name)?.value))
  ) {
    return (
      <WorkspaceLoginCard
        description={(await getTranslations("settings.paymentsPage"))(
          "loginRequired"
        )}
      />
    );
  }
  return (
    <Suspense fallback={<WorkspaceRouteSkeleton />}>
      <SettingsReturnRedirect section="myPayments" />
    </Suspense>
  );
}
