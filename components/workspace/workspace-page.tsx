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
    <section className="mx-auto min-h-full w-full max-w-6xl bg-[var(--el-canvas)] px-4 py-5 sm:px-6 lg:px-10">
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--el-muted)]">
          Meeting notes
        </p>
        <h2 className="mt-1 font-serif text-3xl font-light tracking-tight text-[var(--el-ink)]">
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
