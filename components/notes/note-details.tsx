"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);
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
      <div className="space-y-5 p-6 sm:p-8">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <form
      key={`${note.noteId}-${note.updatedAt}`}
      className="mx-auto max-w-2xl space-y-8 p-6 sm:p-8"
      onSubmit={async (event) => {
        event.preventDefault();
        setFeedback(null);
        const form = new FormData(event.currentTarget);
        const title = String(form.get("title") ?? "").trim();
        const context = String(form.get("context") ?? "");
        try {
          await updateNote.mutateAsync({
            noteId,
            data: {
              title: title || "제목 없는 노트",
              context: context || null,
            },
          });
          await refresh();
          setFeedback("saved");
        } catch {
          setFeedback("error");
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="note-title">제목</Label>
        <Input
          id="note-title"
          name="title"
          defaultValue={note.title}
          maxLength={200}
          className="h-11 text-base font-semibold"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="note-context">회의 맥락</Label>
        <Textarea
          id="note-context"
          name="context"
          defaultValue={note.context ?? ""}
          maxLength={4000}
          rows={8}
          placeholder="전사에서 알아야 할 제품명, 참여자 역할, 용어를 적어두세요."
          className="resize-none leading-6"
        />
      </div>

      <div className="space-y-3">
        <div>
          <Label>폴더</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            여러 폴더를 태그처럼 연결할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {note.folders.map((folder) => (
            <Badge key={folder.folderId} variant="secondary">
              {folder.name}
            </Badge>
          ))}
          {!note.folders.length ? (
            <span className="text-sm text-muted-foreground">
              연결된 폴더 없음
            </span>
          ) : null}
        </div>
        <Popover>
          <PopoverTrigger render={<Button type="button" variant="outline" />}>
            폴더 선택 <ChevronsUpDown />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="폴더 찾기" />
              <CommandList>
                <CommandEmpty>폴더가 없습니다.</CommandEmpty>
                <CommandGroup>
                  {folders.map((folder) => {
                    const attached = note.folders.some(
                      (candidate) => candidate.folderId === folder.folderId
                    );
                    return (
                      <CommandItem
                        key={folder.folderId}
                        value={folder.name}
                        onSelect={async () => {
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
                      >
                        <span
                          className={`flex size-4 items-center justify-center rounded border ${attached ? "bg-primary text-primary-foreground" : ""}`}
                        >
                          {attached ? <Check className="size-3" /> : null}
                        </span>
                        {folder.name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <dl className="grid gap-3 rounded-2xl border border-[var(--el-hairline)] bg-[var(--el-canvas)] p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[var(--el-muted)]">작성자</dt>
          <dd className="mt-1 font-medium">{note.createdBy.name}</dd>
        </div>
        <div>
          <dt className="text-[var(--el-muted)]">생성</dt>
          <dd className="mt-1">
            {new Intl.DateTimeFormat("ko-KR", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(note.createdAt))}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--el-muted)]">수정</dt>
          <dd className="mt-1">
            {new Intl.DateTimeFormat("ko-KR", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(note.updatedAt))}
          </dd>
        </div>
      </dl>

      {feedback === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>
            저장하지 못했습니다. 입력한 내용은 유지됩니다.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={updateNote.isPending}>
          <Check /> 변경 저장
        </Button>
        {feedback === "saved" ? (
          <span role="status" className="text-sm text-muted-foreground">
            저장됨
          </span>
        ) : null}
      </div>
    </form>
  );
}
