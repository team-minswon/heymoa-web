"use client";

import { Check, Plus, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  useAttachNoteFolder,
  useDetachNoteFolder,
  useListWorkspaceFolders,
} from "@/lib/api/generated/folder/folder";
import {
  getGetNoteQueryKey,
  useGetNote,
  useUpdateNote,
} from "@/lib/api/generated/note/note";

export function NoteDetails({
  workspaceId,
  noteId,
}: {
  workspaceId: string;
  noteId: string;
}) {
  const queryClient = useQueryClient();
  const noteQuery = useGetNote(noteId);
  const foldersQuery = useListWorkspaceFolders(workspaceId);
  const updateNote = useUpdateNote();
  const attachFolder = useAttachNoteFolder();
  const detachFolder = useDetachNoteFolder();
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;
  const folders =
    foldersQuery.data?.status === 200 && foldersQuery.data.data.success
      ? (foldersQuery.data.data.data ?? [])
      : [];
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) });

  if (!note) {
    return (
      <div className="p-8 text-sm text-[var(--el-muted)]">
        노트를 불러오는 중입니다.
      </div>
    );
  }

  return (
    <div className="space-y-10 p-6 sm:p-10">
      <form
        key={note.updatedAt}
        className="space-y-10"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const title = String(form.get("title") ?? "").trim();
          const context = String(form.get("context") ?? "");
          await updateNote.mutateAsync({
            noteId,
            data: {
              title: title || "제목 없는 노트",
              context: context || null,
            },
          });
          await refresh();
        }}
      >
        <section>
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--el-muted)]">
            Title
          </label>
          <input
            name="title"
            defaultValue={note.title}
            maxLength={200}
            className="mt-3 w-full border-0 border-b border-[var(--el-hairline)] bg-transparent px-0 py-3 font-serif text-3xl font-light tracking-tight outline-none focus:border-[var(--el-ink)]"
          />
        </section>
        <section>
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--el-muted)]">
            Context
          </label>
          <textarea
            name="context"
            defaultValue={note.context ?? ""}
            maxLength={4000}
            rows={7}
            placeholder="회의에서 알아야 할 맥락을 적어두세요."
            className="mt-3 w-full resize-none rounded-2xl border border-[var(--el-hairline)] bg-white p-4 text-sm leading-6 outline-none focus:border-[var(--el-ink)]"
          />
        </section>
        <Button
          type="submit"
          loading={updateNote.isPending}
          className="rounded-full bg-[var(--el-primary)] px-5 text-white"
        >
          <Check /> 변경 저장
        </Button>
      </form>

      <section className="border-t border-[var(--el-hairline)] pt-8">
        <h3 className="font-serif text-2xl font-light">Folders</h3>
        <p className="mt-1 text-sm text-[var(--el-muted)]">
          폴더는 노트를 분류하는 태그처럼 동작합니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {folders.map((folder) => {
            const attached = note.folders.some(
              (candidate) => candidate.folderId === folder.folderId
            );
            return (
              <button
                key={folder.folderId}
                type="button"
                onClick={async () => {
                  if (attached) {
                    await detachFolder.mutateAsync({
                      noteId,
                      folderId: folder.folderId,
                    });
                  } else {
                    await attachFolder.mutateAsync({
                      noteId,
                      folderId: folder.folderId,
                    });
                  }
                  await refresh();
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs transition ${
                  attached
                    ? "border-[var(--el-ink)] bg-[var(--el-ink)] text-white"
                    : "border-[var(--el-hairline-strong)] bg-white hover:border-[var(--el-ink)]"
                }`}
              >
                {attached ? (
                  <X className="size-3" />
                ) : (
                  <Plus className="size-3" />
                )}
                {folder.name}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
