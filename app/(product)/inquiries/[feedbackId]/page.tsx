import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { SettingsReturnRedirect } from "@/components/settings/settings-return-redirect";
import { WorkspaceLoginCard } from "@/components/workspace/workspace-login-card";
import { WorkspaceRouteSkeleton } from "@/components/workspace/workspace-route-skeleton";
import { AUTH_COOKIE_NAMES } from "@/lib/auth/cookies";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { privateRouteMetadata } from "@/lib/site";

export const metadata: Metadata = privateRouteMetadata;

// 문의 답변 메일의 「답변 보기」(APP-1399). 마지막으로 연 워크스페이스로 넘기며 「내 문의」를 그 항목이 보이게 연다
// (`?inquiry=`, 사이드바가 읽는다). 로그인 전이면 로그인 카드를 세우고, 로그인하면 이 주소로 돌아온다.
export default async function InquiryPage({
  params,
}: {
  params: Promise<{ feedbackId: string }>;
}) {
  const { feedbackId } = await params;
  const jar = await cookies();
  if (
    !shouldEnableMocking() &&
    !AUTH_COOKIE_NAMES.some((name) => jar.has(name))
  ) {
    return (
      <WorkspaceLoginCard description="문의 답변을 보려면 로그인해 주세요." />
    );
  }
  return (
    <Suspense fallback={<WorkspaceRouteSkeleton />}>
      <SettingsReturnRedirect extra={{ inquiry: feedbackId }} />
    </Suspense>
  );
}
