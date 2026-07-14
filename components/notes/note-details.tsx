"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGetNoteQueryKey,
  useGetNote,
  useUpdateNote,
} from "@/lib/api/generated/notes/notes";

export function NoteDetails({
  noteId,
}: {
  noteId: string;
}) {
  const queryClient = useQueryClient();
  const noteQuery = useGetNote(noteId);
  const updateNote = useUpdateNote();
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;

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
        try {
          await updateNote.mutateAsync({
            noteId,
            data: {
              title: title || "제목 없는 노트",
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

      <dl className="grid gap-3 rounded-2xl border border-[var(--el-hairline)] bg-[var(--el-canvas)] p-4 text-sm sm:grid-cols-2">
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
