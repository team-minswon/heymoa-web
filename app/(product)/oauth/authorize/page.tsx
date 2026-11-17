import { redirect } from "next/navigation";

import {
  AgentOAuthEndCard,
  AgentOAuthLoginCard,
} from "@/components/agent-connections/agent-oauth-cards";
import { buildAgentAuthorizeUrl, searchParamsOf } from "@/lib/auth/paths";
import { getCurrentUserForSsr } from "@/lib/auth/server";

export default async function AgentOAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParamsOf(await searchParams);
  if (query.toString() === "") {
    return <AgentOAuthEndCard />;
  }
  if (await getCurrentUserForSsr()) {
    redirect(buildAgentAuthorizeUrl(query));
  }
  return (
    <AgentOAuthLoginCard returnTo={`/oauth/authorize?${query.toString()}`} />
  );
}
