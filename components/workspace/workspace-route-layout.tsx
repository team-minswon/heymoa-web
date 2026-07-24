"use client";

import { useParams } from "next/navigation";

import { WorkspaceAppShell } from "@/components/workspace/workspace-app-shell";
import { WorkspacePage } from "@/components/workspace/workspace-page";

export function WorkspaceRouteLayout({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const params = useParams<{ noteId?: string | string[] }>();
  const noteId = Array.isArray(params.noteId)
    ? params.noteId[0]
    : params.noteId;

  // v5: 사이드바는 full 모드에서도 유지한다 — full 노트 표면이 SidebarInset 안에서
  // 255 우측에 앉으므로 내비를 잃지 않는다. (이전 hideSidebar 폐기)
  return (
    <WorkspaceAppShell workspaceId={workspaceId} activeNoteId={noteId}>
      <WorkspacePage workspaceId={workspaceId} />
      {children}
    </WorkspaceAppShell>
  );
}
