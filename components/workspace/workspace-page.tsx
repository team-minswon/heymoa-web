"use client";

import { WorkspaceNoteList } from "@/components/workspace/workspace-note-list";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";

export function WorkspacePage({
  workspaceId,
}: {
  workspaceId: string;
  embedded?: boolean;
}) {
  const { selectedFolderId } = useWorkspaceShell();

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-10">
      <WorkspaceNoteList
        workspaceId={workspaceId}
        folderId={selectedFolderId}
      />
    </section>
  );
}
