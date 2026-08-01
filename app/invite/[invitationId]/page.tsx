import type { Metadata } from "next";

import { InvitePage } from "@/components/workspace/invite-page";

export const metadata: Metadata = {
  title: "워크스페이스 초대",
  description: "받은 워크스페이스 초대를 수락하거나 거절합니다.",
};

export default async function InviteRoute({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  const { invitationId } = await params;
  return <InvitePage invitationId={invitationId} />;
}
