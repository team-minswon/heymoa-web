import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { WorkspaceLoginCard } from "@/components/workspace/workspace-login-card";
import { AUTH_COOKIE_NAMES } from "@/lib/auth/cookies";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";

/** 쿠키를 읽어 동적 렌더가 되어야 proxy 가 요청마다 만든 CSP nonce 가 스크립트에 붙습니다. */
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
