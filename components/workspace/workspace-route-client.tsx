"use client";

import { WorkspaceAppShell } from "@/components/workspace/workspace-app-shell";
import { WorkspacePage } from "@/components/workspace/workspace-page";

export function WorkspaceRouteClient({ workspaceId }: { workspaceId: string }) {
  return (
    <WorkspaceAppShell workspaceId={workspaceId}>
      <WorkspacePage workspaceId={workspaceId} />
    </WorkspaceAppShell>
  );
}
