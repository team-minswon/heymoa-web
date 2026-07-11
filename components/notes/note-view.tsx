"use client";

import { Expand, PanelRightClose, Settings2, Text, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { NoteDetails } from "@/components/notes/note-details";
import { TranscriptView } from "@/components/notes/transcript-view";
import { Button } from "@/components/ui/button";
import { WorkspacePage } from "@/components/workspace/workspace-page";
import {
  getListWorkspaceNotesQueryKey,
  useDeleteNote,
  useGetNote,
} from "@/lib/api/generated/note/note";

type NoteViewMode = "side" | "full";
type NoteTab = "details" | "transcript";

export function normalizeNoteViewQuery(query: {
  view?: string | string[];
  tab?: string | string[];
}): { view: NoteViewMode; tab: NoteTab } {
  return {
    view: query.view === "side" ? "side" : "full",
    tab: query.tab === "details" ? "details" : "transcript",
  };
}

export function NoteView({
  workspaceId,
  noteId,
  initialQuery,
}: {
  workspaceId: string;
  noteId: string;
  initialQuery: { view?: string; tab?: string };
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const noteQuery = useGetNote(noteId);
  const deleteNote = useDeleteNote();
  const current = normalizeNoteViewQuery({
    view: searchParams.get("view") ?? initialQuery.view,
    tab: searchParams.get("tab") ?? initialQuery.tab,
  });
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;

  const setQuery = (updates: Partial<{ view: NoteViewMode; tab: NoteTab }>) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", updates.view ?? current.view);
    next.set("tab", updates.tab ?? current.tab);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const panel = (
    <div className="flex h-full min-h-0 flex-col bg-[var(--el-canvas)]">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--el-hairline)] px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {note?.title ?? "노트"}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-[var(--el-muted)]">
            {noteId}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={current.tab === "transcript" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setQuery({ tab: "transcript" })}
            className="rounded-full"
          >
            <Text /> 원본
          </Button>
          <Button
            type="button"
            variant={current.tab === "details" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setQuery({ tab: "details" })}
            className="rounded-full"
          >
            <Settings2 /> 상세
          </Button>
          <span className="mx-1 h-5 w-px bg-[var(--el-hairline)]" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="노트 삭제"
            onClick={async () => {
              if (!window.confirm("이 노트와 전사 기록을 모두 삭제할까요?"))
                return;
              await deleteNote.mutateAsync({ noteId });
              await queryClient.invalidateQueries({
                queryKey: getListWorkspaceNotesQueryKey(workspaceId),
              });
              router.push(`/w/${workspaceId}`);
            }}
            className="rounded-full text-[var(--el-muted)] hover:text-red-700"
          >
            <Trash2 />
          </Button>
          {current.view === "side" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="전체 화면으로 보기"
              onClick={() => setQuery({ view: "full" })}
              className="rounded-full"
            >
              <Expand />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="노트 닫기"
            onClick={() => router.push(`/w/${workspaceId}`)}
            className="rounded-full"
          >
            <PanelRightClose />
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {current.tab === "details" ? (
          <NoteDetails workspaceId={workspaceId} noteId={noteId} />
        ) : (
          <TranscriptView noteId={noteId} />
        )}
      </div>
    </div>
  );

  if (current.view === "side") {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <WorkspacePage workspaceId={workspaceId} embedded />
        <button
          type="button"
          aria-label="사이드 노트 닫기"
          onClick={() => router.push(`/w/${workspaceId}`)}
          className="absolute inset-0 bg-black/5 backdrop-blur-[1px]"
        />
        <aside className="fixed bottom-0 right-0 top-16 z-30 w-full border-l border-[var(--el-hairline)] bg-[var(--el-canvas)] shadow-[-20px_0_60px_rgba(28,25,23,0.12)] sm:w-[min(760px,78vw)]">
          {panel}
        </aside>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-0 py-0 sm:px-6 sm:py-8">
      <div className="overflow-hidden border-y border-[var(--el-hairline)] bg-[var(--el-canvas)] sm:rounded-2xl sm:border sm:shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
        {panel}
      </div>
    </div>
  );
}
