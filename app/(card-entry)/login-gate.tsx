import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { WorkspaceLoginCard } from "@/components/workspace/workspace-login-card";
import { AUTH_COOKIE_NAMES } from "@/lib/auth/cookies";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";

/**
 * 카드를 받는 두 면(첫 구독 결제 페이지·카드 변경 iframe, APP-1600)의 로그인 확인. 결과 화면처럼 쿠키가 없으면 로그인 카드를
 * 돌려주고, 있으면 `null`. 쿠키를 읽어 동적 렌더가 되므로 proxy 가 요청마다 만든 CSP nonce 가 스크립트에 붙는다.
 */
export async function loginRequired() {
  const jar = await cookies();
  if (
    shouldEnableMocking() ||
    AUTH_COOKIE_NAMES.some((name) => Boolean(jar.get(name)?.value))
  )
    return null;
  return (
    <WorkspaceLoginCard
      description={(await getTranslations("billing.setup"))("loginRequired")}
    />
  );
}
