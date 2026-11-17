import { redirect } from "next/navigation";

import { MockOAuthConsent } from "@/components/mocks/mock-oauth-consent";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";

/** MSW 는 최상위 내비게이션을 가로채지 못해, 이 화면이 외부 제공자와 callback 이동을 대신합니다. */
export default async function MockOAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; provider?: string }>;
}) {
  if (!shouldEnableMocking()) redirect("/");

  const { workspaceId = "", provider = "" } = await searchParams;

  return <MockOAuthConsent workspaceId={workspaceId} provider={provider} />;
}
