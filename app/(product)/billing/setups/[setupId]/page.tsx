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
  referrer: "no-referrer",
};

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
