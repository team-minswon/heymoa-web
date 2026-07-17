"use client";

import { Expand, PanelRightClose } from "lucide-react";

import { NoteDetails } from "@/components/notes/note-details";
import { TranscriptView } from "@/components/notes/transcript-view";
import { RecordingDock } from "@/components/transcription/recording-dock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import { useGetProject } from "@/lib/api/generated/projects/projects";

export type NoteTab = "details" | "transcript";

export function NotePanel({
  workspaceId,
  noteId,
  tab,
  onTabChange,
  onClose,
  onExpand,
}: {
  workspaceId: string;
  noteId: string;
  tab: NoteTab;
  onTabChange: (tab: NoteTab) => void;
  onClose: () => void;
  onExpand?: () => void;
}) {
  const noteQuery = useGetNote(noteId);
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;
  const projectQuery = useGetProject(workspaceId, note?.projectId ?? "", {
    query: { enabled: Boolean(note?.projectId) },
  });
  const project =
    projectQuery.data?.status === 200 && projectQuery.data.data.success
      ? projectQuery.data.data.data
      : undefined;
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <header className="relative z-10 border-b border-[var(--el-hairline)] bg-white/92 px-5 py-4 backdrop-blur-xl sm:px-9 sm:py-5">
        <div className="mx-auto flex w-full max-w-[820px] items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {project ? (
                <Badge variant="secondary">{project.name}</Badge>
              ) : null}
            </div>
            <h1 className="mt-2 truncate font-serif text-[28px] font-light leading-tight tracking-[-0.03em] text-[var(--el-ink)] sm:text-[32px]">
              {note?.title ?? "회의 노트"}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onExpand ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                className="rounded-full"
                aria-label="전체 화면으로 보기"
                onClick={onExpand}
              >
                <Expand />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="rounded-full"
              aria-label="노트 닫기"
              onClick={onClose}
            >
              <PanelRightClose />
            </Button>
          </div>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => value && onTabChange(value as NoteTab)}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="border-b border-[var(--el-hairline)] bg-white px-5 sm:px-9">
          <div className="mx-auto w-full max-w-[820px]">
            <TabsList
              variant="line"
              className="h-11 w-full justify-start gap-6"
            >
              <TabsTrigger value="transcript">실시간 전사</TabsTrigger>
              <TabsTrigger value="details">노트 정보</TabsTrigger>
            </TabsList>
          </div>
        </div>
        <TabsContent value="transcript" className="min-h-0 flex-1">
          <TranscriptView noteId={noteId} />
        </TabsContent>
        <TabsContent value="details" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <NoteDetails noteId={noteId} />
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-5 sm:px-9">
        <div className="pointer-events-auto">
          <RecordingDock noteId={noteId} />
        </div>
      </div>
    </div>
  );
}
