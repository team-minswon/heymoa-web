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
  // 인증 쿠키가 하나도 없으면 확실히 로그인 전이다(APP-1312). 조회해 봤자 401 이라 로그인 카드를 바로 세운다.
  // 쿠키가 있는데 만료된 경우는 `proxy.ts` 가 렌더 전에 갱신한다. 서버 상태로 판정하지 않는 것은 API 가 잠깐
  // 실패할 때 로그인한 사람에게 로그인 카드를 보이지 않기 위해서다.
  const jar = await cookies();
  if (
    !shouldEnableMocking() &&
    !AUTH_COOKIE_NAMES.some((name) => jar.has(name))
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
