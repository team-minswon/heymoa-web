import { redirect } from "next/navigation";

import { MockOAuthConsent } from "@/components/mocks/mock-oauth-consent";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";

/**
 * 목 전용 OAuth 승인 화면.
 *
 * 실제 흐름은 authorize가 외부 도메인(Linear·GitHub)으로 리다이렉트하고 callback이 돌아온다.
 * **MSW는 최상위 내비게이션을 가로채지 못하므로** 목에서는 그 왕복을 브라우저 이동으로
 * 재현할 수 없다 — 이 화면이 외부 제공자와 callback 이동을 함께 대신한다.
 *
 * 목이 꺼진 환경에 존재하면 안 되는 화면이라 홈으로 돌려보낸다.
 */
export default async function MockOAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; provider?: string }>;
}) {
  if (!shouldEnableMocking()) redirect("/");

  const { workspaceId = "", provider = "" } = await searchParams;

  return <MockOAuthConsent workspaceId={workspaceId} provider={provider} />;
}
