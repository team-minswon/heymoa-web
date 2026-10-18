import type { Metadata } from "next";
import { Suspense } from "react";

import { IntegrationsReturnRedirect } from "@/components/settings/integrations-return-redirect";
import { WorkspaceRouteSkeleton } from "@/components/workspace/workspace-route-skeleton";

import { privateRouteMetadata } from "@/lib/site";

export const metadata: Metadata = privateRouteMetadata;

// OAuth 연동 복귀 주소(/settings/integrations?provider=&status=)를 받아 마지막으로 연 워크스페이스로 넘긴다.
// useSearchParams가 Suspense 경계를 요구하므로 감싼다.
export default function SettingsIntegrationsPage() {
  return (
    <Suspense fallback={<WorkspaceRouteSkeleton />}>
      <IntegrationsReturnRedirect />
    </Suspense>
  );
}
