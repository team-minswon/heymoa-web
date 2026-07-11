"use client";

import { useState } from "react";
import { Expand, MoreHorizontal, PanelRightClose, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { NoteDetails } from "@/components/notes/note-details";
import { TranscriptView } from "@/components/notes/transcript-view";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getListWorkspaceNotesQueryKey,
  useDeleteNote,
  useGetNote,
} from "@/lib/api/generated/note/note";

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
  const queryClient = useQueryClient();
  const noteQuery = useGetNote(noteId);
  const deleteNote = useDeleteNote();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex min-h-16 items-center gap-3 border-b px-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">
            {note?.title ?? "노트"}
          </p>
          {note?.folders.length ? (
            <div className="mt-1 flex gap-1.5 overflow-hidden">
              {note.folders.map((folder) => (
                <Badge key={folder.folderId} variant="secondary">
                  {folder.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        {onExpand ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="전체 화면으로 보기"
            onClick={onExpand}
          >
            <Expand />
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="노트 메뉴"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 /> 노트 삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="노트 닫기"
          onClick={onClose}
        >
          <PanelRightClose />
        </Button>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => value && onTabChange(value as NoteTab)}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="border-b px-4 sm:px-6">
          <TabsList variant="line" className="h-12">
            <TabsTrigger value="transcript">원본 전사</TabsTrigger>
            <TabsTrigger value="details">노트 정보</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="transcript" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <TranscriptView noteId={noteId} />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="details" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <NoteDetails workspaceId={workspaceId} noteId={noteId} />
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>노트를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              노트와 연결된 전사 기록도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                await deleteNote.mutateAsync({ noteId });
                await queryClient.invalidateQueries({
                  queryKey: getListWorkspaceNotesQueryKey(workspaceId),
                });
                onClose();
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
