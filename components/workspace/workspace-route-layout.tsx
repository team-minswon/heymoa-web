"use client";

import { useParams, useSearchParams } from "next/navigation";

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
  const searchParams = useSearchParams();
  const noteId = Array.isArray(params.noteId)
    ? params.noteId[0]
    : params.noteId;
  const hideSidebar = Boolean(noteId && searchParams.get("view") !== "side");

  return (
    <WorkspaceAppShell
      workspaceId={workspaceId}
      activeNoteId={noteId}
      hideSidebar={hideSidebar}
    >
      <WorkspacePage workspaceId={workspaceId} />
      {children}
    </WorkspaceAppShell>
  );
}
