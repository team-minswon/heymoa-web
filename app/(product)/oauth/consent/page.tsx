import { AgentOAuthConsent } from "@/components/agent-connections/agent-oauth-consent";
import {
  AgentOAuthEndCard,
  AgentOAuthLoginCard,
} from "@/components/agent-connections/agent-oauth-cards";
import { searchParamsOf } from "@/lib/auth/paths";
import { getCurrentUserForSsr } from "@/lib/auth/server";

export default async function AgentOAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParamsOf(await searchParams);
  const consentState = query.get("state");
  if (!consentState) {
    return <AgentOAuthEndCard />;
  }
  if (!(await getCurrentUserForSsr())) {
    return (
      <AgentOAuthLoginCard returnTo={`/oauth/consent?${query.toString()}`} />
    );
  }
  return <AgentOAuthConsent consentState={consentState} />;
}
