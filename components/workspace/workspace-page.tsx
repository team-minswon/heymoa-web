"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock3, Mic, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import {
  useCreateNote,
  useListWorkspaceNotes,
} from "@/lib/api/generated/note/note";

export function WorkspacePage({
  workspaceId,
}: {
  workspaceId: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const { selectedFolderId } = useWorkspaceShell();
  const notesQuery = useListWorkspaceNotes(workspaceId, {
    limit: 100,
    ...(selectedFolderId ? { folderId: selectedFolderId } : {}),
  });
  const createNote = useCreateNote();
  const notes =
    notesQuery.data?.status === 200 && notesQuery.data.data.success
      ? (notesQuery.data.data.data?.items ?? [])
      : [];
  const groups = (() => {
    const grouped = new Map<string, typeof notes>();
    notes.forEach((note) => {
      const date = new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(note.lastRecordedAt ?? note.createdAt));
      grouped.set(date, [...(grouped.get(date) ?? []), note]);
    });
    return [...grouped.entries()];
  })();

  const handleCreateNote = async () => {
    const response = await createNote.mutateAsync({ workspaceId, data: {} });
    if (response.status === 200 && response.data.success && response.data.data) {
      router.push(
        `/w/${workspaceId}/notes/${response.data.data.noteId}?view=full&tab=transcript`
      );
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <header className="flex flex-col justify-between gap-5 border-b border-border pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">
            회의의 원문을 먼저 기록하세요.
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
            모든 노트
          </h1>
        </div>
        <Button
          type="button"
          size="xl"
          onClick={() => void handleCreateNote()}
          loading={createNote.isPending}
          className="rounded-full px-5"
        >
          <Plus /> 새 노트
        </Button>
      </header>

      <div className="mt-8 space-y-10">
        {groups.map(([date, dateNotes]) => (
          <section key={date}>
            <h2 className="mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {date}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {dateNotes.map((note) => (
                <Link
                  key={note.noteId}
                  href={`/w/${workspaceId}/notes/${note.noteId}?view=side&tab=transcript`}
                  className="group rounded-2xl border bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-foreground/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-base font-medium tracking-tight">
                      {note.title}
                    </h3>
                    {note.lastRecordedAt && (
                      <Mic className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="mt-8 text-xs text-muted-foreground">
                    {note.createdBy.name}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {note.folders.map((folder) => (
                        <span
                          key={folder.folderId}
                          className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium"
                        >
                          {folder.name}
                        </span>
                      ))}
                    </div>
                    <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground">
                      <Clock3 className="size-3" />
                      {Math.round(note.recordedDurationMs / 60000)}m
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
        {!notesQuery.isPending && notes.length === 0 && (
          <div className="rounded-2xl border border-dashed py-20 text-center">
            <Mic className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              아직 노트가 없습니다.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
