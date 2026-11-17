import type { Metadata } from "next";
import { Suspense } from "react";

import { SettingsReturnRedirect } from "@/components/settings/settings-return-redirect";
import { WorkspaceRouteSkeleton } from "@/components/workspace/workspace-route-skeleton";

import { privateRouteMetadata } from "@/lib/site";

export const metadata: Metadata = privateRouteMetadata;

// useSearchParams 가 Suspense 경계를 요구해 감쌉니다.
export default function SettingsIntegrationsPage() {
  return (
    <Suspense fallback={<WorkspaceRouteSkeleton />}>
      <SettingsReturnRedirect />
    </Suspense>
  );
}
