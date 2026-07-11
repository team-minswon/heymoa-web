"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clock3, FolderPlus, Mic, Pencil, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  getListWorkspaceFoldersQueryKey,
  useCreateFolder,
  useDeleteFolder,
  useListWorkspaceFolders,
  useUpdateFolder,
} from "@/lib/api/generated/folder/folder";
import {
  getListWorkspaceNotesQueryKey,
  useCreateNote,
  useListWorkspaceNotes,
} from "@/lib/api/generated/note/note";
import { useGetWorkspace } from "@/lib/api/generated/workspace/workspace";

export function WorkspacePage({
  workspaceId,
  embedded = false,
}: {
  workspaceId: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const workspaceQuery = useGetWorkspace(workspaceId);
  const foldersQuery = useListWorkspaceFolders(workspaceId);
  const notesQuery = useListWorkspaceNotes(workspaceId, {
    limit: 100,
    ...(folderId ? { folderId } : {}),
  });
  const createNote = useCreateNote();
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();

  const workspace =
    workspaceQuery.data?.status === 200 && workspaceQuery.data.data.success
      ? workspaceQuery.data.data.data
      : undefined;
  const folders =
    foldersQuery.data?.status === 200 && foldersQuery.data.data.success
      ? (foldersQuery.data.data.data ?? [])
      : [];
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
    if (
      response.status === 200 &&
      response.data.success &&
      response.data.data
    ) {
      router.push(
        `/w/${workspaceId}/notes/${response.data.data.noteId}?view=full&tab=transcript`
      );
    }
  };

  const handleCreateFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    await createFolder.mutateAsync({ workspaceId, data: { name } });
    setFolderName("");
    await queryClient.invalidateQueries({
      queryKey: getListWorkspaceFoldersQueryKey(workspaceId),
    });
  };

  return (
    <div className={embedded ? "min-h-screen opacity-55" : "min-h-screen"}>
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
        <aside className="space-y-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--el-muted)]">
              Workspace
            </p>
            <h1 className="mt-2 font-serif text-2xl font-light tracking-tight">
              {workspace?.name ?? "워크스페이스"}
            </h1>
          </div>
          <nav aria-label="폴더 필터" className="space-y-1">
            <button
              type="button"
              onClick={() => setFolderId(null)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                folderId === null
                  ? "bg-white shadow-sm"
                  : "text-[var(--el-muted)] hover:bg-white/60"
              }`}
            >
              모든 노트
            </button>
            {folders.map((folder) => (
              <div
                key={folder.folderId}
                className="group flex items-center gap-1"
              >
                <button
                  type="button"
                  onClick={() => setFolderId(folder.folderId)}
                  className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm transition ${
                    folderId === folder.folderId
                      ? "bg-white shadow-sm"
                      : "text-[var(--el-muted)] hover:bg-white/60"
                  }`}
                >
                  <span className="block truncate">{folder.name}</span>
                </button>
                {!embedded && (
                  <div className="flex opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <button
                      type="button"
                      aria-label={`${folder.name} 이름 변경`}
                      className="rounded-full p-1.5 text-[var(--el-muted)] hover:bg-white hover:text-[var(--el-ink)]"
                      onClick={async () => {
                        const name = window
                          .prompt("새 폴더 이름", folder.name)
                          ?.trim();
                        if (!name || name === folder.name) return;
                        await updateFolder.mutateAsync({
                          folderId: folder.folderId,
                          data: { name },
                        });
                        await queryClient.invalidateQueries({
                          queryKey:
                            getListWorkspaceFoldersQueryKey(workspaceId),
                        });
                      }}
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`${folder.name} 삭제`}
                      className="rounded-full p-1.5 text-[var(--el-muted)] hover:bg-red-50 hover:text-red-700"
                      onClick={async () => {
                        if (
                          !window.confirm(`'${folder.name}' 폴더를 삭제할까요?`)
                        )
                          return;
                        await deleteFolder.mutateAsync({
                          folderId: folder.folderId,
                        });
                        if (folderId === folder.folderId) setFolderId(null);
                        await Promise.all([
                          queryClient.invalidateQueries({
                            queryKey:
                              getListWorkspaceFoldersQueryKey(workspaceId),
                          }),
                          queryClient.invalidateQueries({
                            queryKey:
                              getListWorkspaceNotesQueryKey(workspaceId),
                          }),
                        ]);
                      }}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </nav>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateFolder();
            }}
          >
            <input
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="새 폴더"
              maxLength={50}
              className="min-w-0 flex-1 rounded-lg border border-[var(--el-hairline)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--el-ink)]"
            />
            <Button
              type="submit"
              variant="outline"
              size="icon"
              aria-label="폴더 추가"
            >
              <FolderPlus />
            </Button>
          </form>
        </aside>

        <section>
          <header className="flex flex-col justify-between gap-5 border-b border-[var(--el-hairline)] pb-7 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm text-[var(--el-muted)]">
                회의의 원문을 먼저 기록하세요.
              </p>
              <h2 className="mt-2 font-serif text-4xl font-light tracking-[-0.03em] sm:text-5xl">
                Notes
              </h2>
            </div>
            {!embedded && (
              <Button
                type="button"
                size="xl"
                onClick={() => void handleCreateNote()}
                loading={createNote.isPending}
                className="rounded-full bg-[var(--el-primary)] px-5 text-white"
              >
                <Plus /> 새 노트
              </Button>
            )}
          </header>

          <div className="mt-8 space-y-10">
            {groups.map(([date, dateNotes]) => (
              <section key={date}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--el-muted)]">
                  {date}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {dateNotes.map((note) => (
                    <Link
                      key={note.noteId}
                      href={`/w/${workspaceId}/notes/${note.noteId}?view=side&tab=transcript`}
                      className="group rounded-2xl border border-[var(--el-hairline)] bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--el-hairline-strong)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <h4 className="text-base font-medium tracking-tight">
                          {note.title}
                        </h4>
                        {note.lastRecordedAt && (
                          <Mic className="size-4 text-[var(--el-muted)]" />
                        )}
                      </div>
                      <p className="mt-8 text-xs text-[var(--el-muted)]">
                        {note.createdBy.name}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-1.5">
                          {note.folders.map((folder) => (
                            <span
                              key={folder.folderId}
                              className="rounded-full bg-[var(--el-surface-strong)] px-2 py-1 text-[10px] font-medium"
                            >
                              {folder.name}
                            </span>
                          ))}
                        </div>
                        <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-[var(--el-muted)]">
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
              <div className="rounded-2xl border border-dashed border-[var(--el-hairline-strong)] py-20 text-center">
                <Mic className="mx-auto size-5 text-[var(--el-muted)]" />
                <p className="mt-3 text-sm text-[var(--el-muted)]">
                  아직 노트가 없습니다.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
