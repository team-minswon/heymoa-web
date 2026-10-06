import { redirect } from "next/navigation";

import {
  AGENT_OAUTH_RECONNECT_MESSAGE,
  AgentOAuthEndCard,
  AgentOAuthLoginCard,
} from "@/components/agent-connections/agent-oauth-cards";
import { buildAgentAuthorizeUrl, searchParamsOf } from "@/lib/auth/paths";
import { getCurrentUserForSsr } from "@/lib/auth/server";

/**
 * 외부 에이전트 인가 요청의 web 입구(APP-888). server 가 로그인 안 된 인가 요청을 받은 쿼리 그대로 여기로 보낸다.
 *
 * - 로그인돼 있으면 같은 쿼리로 server 인가 엔드포인트에 돌려보낸다. server 가 동의 화면으로 이어 보낸다
 * - 아니면 로그인 카드를 그린다. 로그인하면 이 주소로 쿼리째 돌아온다
 * - access 쿠키만 만료됐으면 `proxy.ts` 가 렌더 전에 갱신해 여기서는 로그인으로 보인다
 */
export default async function AgentOAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParamsOf(await searchParams);
  if (query.toString() === "") {
    return <AgentOAuthEndCard message={AGENT_OAUTH_RECONNECT_MESSAGE} />;
  }
  if (await getCurrentUserForSsr()) {
    redirect(buildAgentAuthorizeUrl(query));
  }
  return (
    <AgentOAuthLoginCard returnTo={`/oauth/authorize?${query.toString()}`} />
  );
}
