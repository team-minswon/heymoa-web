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
    <section className="mx-auto min-h-full w-full max-w-[1320px] bg-card px-4 py-7 sm:px-8 lg:px-12 xl:px-16">
      <div className="mb-8 lg:mb-10">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--el-muted)]">
          Meeting notes
        </p>
        <h2 className="mt-1 font-serif text-4xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
          회의 기록
        </h2>
      </div>
      <WorkspaceNoteList
        workspaceId={workspaceId}
        folderId={selectedFolderId}
      />
    </section>
  );
}
