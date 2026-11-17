import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { SettingsReturnRedirect } from "@/components/settings/settings-return-redirect";
import { WorkspaceLoginCard } from "@/components/workspace/workspace-login-card";
import { WorkspaceRouteSkeleton } from "@/components/workspace/workspace-route-skeleton";
import { AUTH_COOKIE_NAMES } from "@/lib/auth/cookies";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { privateRouteMetadata } from "@/lib/site";

export const metadata: Metadata = privateRouteMetadata;

export default async function SettingsNotificationsPage() {
  const jar = await cookies();
  if (
    !shouldEnableMocking() &&
    !AUTH_COOKIE_NAMES.some((name) => Boolean(jar.get(name)?.value))
  ) {
    return (
      <WorkspaceLoginCard
        description={(await getTranslations("settings.notificationsPage"))(
          "loginRequired"
        )}
      />
    );
  }
  return (
    <Suspense fallback={<WorkspaceRouteSkeleton />}>
      <SettingsReturnRedirect section="notifications" />
    </Suspense>
  );
}
