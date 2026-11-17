import { HydrationBoundary } from "@tanstack/react-query";

import { CardChangeFrame } from "@/components/billing/card-change-frame";
import { prefetchCardEntry } from "@/lib/workspace/prefetch";

import { loginRequired } from "../../../login-gate";

export default async function CardChangeFrameRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const login = await loginRequired();
  if (login) return login;
  return (
    <HydrationBoundary state={await prefetchCardEntry(workspaceId)}>
      <CardChangeFrame workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
