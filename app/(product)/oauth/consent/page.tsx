import { AgentOAuthConsent } from "@/components/agent-connections/agent-oauth-consent";
import {
  AGENT_OAUTH_RECONNECT_MESSAGE,
  AgentOAuthEndCard,
  AgentOAuthLoginCard,
} from "@/components/agent-connections/agent-oauth-cards";
import { searchParamsOf } from "@/lib/auth/paths";
import { getCurrentUserForSsr } from "@/lib/auth/server";

/**
 * 외부 에이전트 연결 동의 화면(APP-888). server 가 로그인된 인가 요청을 `client_id`·`scope`·`state` 를 붙여
 * 보낸다. 화면이 쓰는 것은 `state` 하나다 — 그것으로 server 에 요청 내용을 다시 묻는다.
 *
 * 그 사이 로그아웃됐으면 로그인 카드를 그리고, 로그인하면 이 화면으로 쿼리째 돌아온다.
 */
export default async function AgentOAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParamsOf(await searchParams);
  const consentState = query.get("state");
  if (!consentState) {
    return <AgentOAuthEndCard message={AGENT_OAUTH_RECONNECT_MESSAGE} />;
  }
  if (!(await getCurrentUserForSsr())) {
    return (
      <AgentOAuthLoginCard returnTo={`/oauth/consent?${query.toString()}`} />
    );
  }
  return <AgentOAuthConsent consentState={consentState} />;
}
