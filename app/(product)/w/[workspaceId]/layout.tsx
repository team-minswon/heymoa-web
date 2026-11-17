import type { Metadata } from "next";
import { cookies } from "next/headers";
import { HydrationBoundary } from "@tanstack/react-query";

import { WorkspaceLoginCard } from "@/components/workspace/workspace-login-card";
import { AUTH_COOKIE_NAMES } from "@/lib/auth/cookies";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { WorkspaceRouteLayout } from "@/components/workspace/workspace-route-layout";
import { privateRouteMetadata } from "@/lib/site";
import { prefetchWorkspaceShell } from "@/lib/workspace/prefetch";

export const metadata: Metadata = privateRouteMetadata;

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const jar = await cookies();
  if (
    !shouldEnableMocking() &&
    !AUTH_COOKIE_NAMES.some((name) => Boolean(jar.get(name)?.value))
  ) {
    return <WorkspaceLoginCard />;
  }
  const state = await prefetchWorkspaceShell({ workspaceId });

  return (
    <HydrationBoundary state={state}>
      <WorkspaceRouteLayout workspaceId={workspaceId}>
        {children}
      </WorkspaceRouteLayout>
    </HydrationBoundary>
  );
}
