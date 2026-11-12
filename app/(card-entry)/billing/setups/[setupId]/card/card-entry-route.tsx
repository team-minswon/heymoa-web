import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { BillingCardEntryPage } from "@/components/billing/billing-card-entry-page";
import { WorkspaceLoginCard } from "@/components/workspace/workspace-login-card";
import { AUTH_COOKIE_NAMES } from "@/lib/auth/cookies";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";

// 카드 정보 입력(APP-1600)의 두 주소 — 전용 화면(`card`)과 모달 안 iframe(`card/embed`)이 같이 쓴다.
// 결과 화면(`(product)/billing/setups/[setupId]`)처럼 여기서 로그인을 확인한다.
// 쿠키를 읽어 동적 렌더가 되므로 proxy 가 요청마다 만든 CSP nonce 가 스크립트에 붙는다.
export async function renderCardEntry(
  params: Promise<{ setupId: string }>,
  embed: boolean
) {
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
  return <BillingCardEntryPage setupId={setupId} embed={embed} />;
}
