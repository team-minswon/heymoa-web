"use client";

import { useState } from "react";
import { CalendarDays, Check, Clock3 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGetNoteQueryKey,
  useGetNote,
  useUpdateNote,
} from "@/lib/api/generated/notes/notes";
import { formatAppDate } from "@/lib/format/date";

export function NoteDetails({ noteId }: { noteId: string }) {
  const queryClient = useQueryClient();
  const noteQuery = useGetNote(noteId);
  const updateNote = useUpdateNote({ mutation: { meta: { suppressErrorToast: true } } });
  const [feedback, setFeedback] = useState<"saved" | null>(null);
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) });

  if (!note) {
    return (
      <div className="mx-auto w-full max-w-[820px] space-y-5 px-5 pt-7 sm:px-9 sm:pt-9">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <form
      key={`${note.noteId}-${note.updatedAt}`}
      className="mx-auto w-full max-w-[820px] space-y-10 px-5 pb-36 pt-7 sm:px-9 sm:pt-9"
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
          toast.error("저장하지 못했습니다. 입력한 내용은 유지됩니다.", {
            id: `note-save-${noteId}`,
          });
        }
      }}
    >
      {/* v5: 대문자 키커 제거 — 세리프 제목만 유지(FORM SPEC). */}
      <header>
        <h2 className="font-serif text-section font-light tracking-[-0.025em] text-[var(--el-ink)]">
          노트 정보
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--el-muted)]">
          회의 제목과 기록 시각을 관리합니다.
        </p>
      </header>

      <div className="space-y-3 rounded-block border border-[var(--el-hairline)] bg-white p-5 sm:p-6">
        <Label htmlFor="note-title" className="text-xs text-[var(--el-muted)]">
          회의 제목
        </Label>
        <Input
          id="note-title"
          name="title"
          defaultValue={note.title}
          maxLength={200}
          className="h-auto border-0 bg-transparent px-0 py-1 font-serif text-2xl font-light tracking-[-0.02em] shadow-none focus-visible:ring-0"
        />
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-block border border-[var(--el-hairline)] bg-white p-5">
          <dt className="flex items-center gap-2 text-xs font-medium text-[var(--el-muted)]">
            <CalendarDays className="size-3.5" /> 생성
          </dt>
          <dd className="mt-3 text-sm text-[var(--el-body-strong)]">
            {formatAppDate(note.createdAt, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </dd>
        </div>
        <div className="rounded-block border border-[var(--el-hairline)] bg-white p-5">
          <dt className="flex items-center gap-2 text-xs font-medium text-[var(--el-muted)]">
            <Clock3 className="size-3.5" /> 최근 수정
          </dt>
          <dd className="mt-3 text-sm text-[var(--el-body-strong)]">
            {formatAppDate(note.updatedAt, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </dd>
        </div>
      </dl>

      <div className="flex items-center gap-3 border-t border-[var(--el-hairline)] pt-6">
        <Button
          type="submit"
          loading={updateNote.isPending}
          className="rounded-full px-5"
        >
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
