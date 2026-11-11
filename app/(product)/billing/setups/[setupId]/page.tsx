import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { BillingSetupResultPage } from "@/components/billing/billing-setup-result-page";
import { WorkspaceLoginCard } from "@/components/workspace/workspace-login-card";
import { AUTH_COOKIE_NAMES } from "@/lib/auth/cookies";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { privateRouteMetadata } from "@/lib/site";

export const metadata: Metadata = {
  ...privateRouteMetadata,
  // 결제 복귀 주소의 Referer 로 setup 주소가 새지 않게 한다.
  referrer: "no-referrer",
};

// 카드 등록 결과(PRO-75). 워크스페이스 레이아웃 밖이라 로그인 확인을 여기서 한다 — 로그인 전이면 로그인 카드를 세우고,
// 로그인하면 이 깨끗한 주소로 돌아온다(`lib/auth/paths.ts`). `SettingsReturnRedirect` 는 쓰지 않는다.
export default async function BillingSetupRoute({
  params,
}: {
  params: Promise<{ setupId: string }>;
}) {
  const { setupId } = await params;
  const jar = await cookies();
  if (
    !shouldEnableMocking() &&
    !AUTH_COOKIE_NAMES.some((name) => Boolean(jar.get(name)?.value))
  ) {
    return (
      <WorkspaceLoginCard
        description={(await getTranslations("billing.setup"))("loginRequired")}
      />
    );
  }
  return <BillingSetupResultPage setupId={setupId} />;
}
