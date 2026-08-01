"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { NoteColumn } from "@/components/notes/note-chrome";
import { AvatarStack } from "@/components/workspace/page-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getGetNoteQueryKey,
  getGetNotesQueryKey,
  useGetNoteSuspense,
  useUpdateNote,
} from "@/lib/api/generated/notes/notes";
import { formatAppDate } from "@/lib/format/date";
import { MEETING_STATUS_LABEL } from "@/lib/notes/meeting-state";
import { cn } from "@/lib/utils";

/** 값 한 줄. 라벨 폭을 고정해야 값들이 한 세로선에 선다. */
function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[30px] items-center gap-3">
      <dt className="w-[124px] shrink-0 text-[12px] text-[var(--el-body)]">
        {label}
      </dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-[var(--el-ink)]">
        {children}
      </dd>
    </div>
  );
}

export function NoteDetails({ noteId }: { noteId: string }) {
  const queryClient = useQueryClient();
  const noteResponse = useGetNoteSuspense(noteId).data;
  const updateNote = useUpdateNote({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [feedback, setFeedback] = useState<"saved" | null>(null);

  // suspense가 네트워크 실패는 throw하지만, 계약 위반 봉투(200 아님·success=false)도 경계로 보낸다.
  if (noteResponse.status !== 200 || !noteResponse.data.success) {
    throw new Error("회의를 불러오지 못했습니다.");
  }
  const note = noteResponse.data.data;
  const live = note.meetingStatus === "IN_PROGRESS";
  const minutes = Math.floor((note.recordedDurationMs ?? 0) / 60_000);

  // 노트 단건과 목록을 함께 무효화한다 — 목록은 projectId별로 조회하므로(workspace-page)
  // 단건만 무효화하면 제목 변경이 목록에 반영되지 않는다.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) }),
      queryClient.invalidateQueries({
        queryKey: getGetNotesQueryKey(note.projectId),
      }),
    ]);

  return (
    <div className="px-4 py-6 sm:px-8">
      <NoteColumn className="flex flex-col gap-6">
        <form
          key={`${note.noteId}-${note.updatedAt}`}
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setFeedback(null);
            const form = new FormData(event.currentTarget);
            const title = String(form.get("title") ?? "").trim();
            const context = String(form.get("context") ?? "").trim();
            try {
              await updateNote.mutateAsync({
                noteId,
                data: {
                  title: title || "제목 없는 회의",
                  // 빈 문자열은 「비웠다」는 뜻이다 — 계약의 null 로 보내야 서버가 지운다.
                  context: context || null,
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-title">제목</Label>
            <Input
              id="note-title"
              name="title"
              defaultValue={note.title}
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-context">맥락</Label>
            {/* 맥락은 분석이 읽는다 — 「무엇을 정하러 모였나」를 적어 두면 요약이 그 축으로 잡힌다. */}
            <Textarea
              id="note-context"
              name="context"
              rows={3}
              maxLength={2000}
              defaultValue={note.context ?? ""}
              placeholder="이 회의에서 정하려는 것을 적어 두면 요약이 그 축으로 잡힙니다."
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={updateNote.isPending}>
              <Check /> 변경 저장
            </Button>
            {feedback === "saved" ? (
              <span
                role="status"
                className="flex items-center gap-1.5 text-[11px] text-[var(--el-muted)]"
              >
                <Check className="size-3.5" /> 저장했습니다
              </span>
            ) : null}
          </div>
        </form>

        <dl className="flex flex-col">
          <p className="pb-2.5 text-[13px] font-bold text-[var(--el-ink)]">
            회의 정보
          </p>
          <Fact label="회의 상태">
            <span
              className={cn(
                "size-1.5 rounded-full",
                live ? "bg-[var(--el-error)]" : "bg-[var(--el-muted)]"
              )}
            />
            {MEETING_STATUS_LABEL[note.meetingStatus] ?? note.meetingStatus}
          </Fact>
          <Fact label="시작 시각">
            {note.meetingStartedAt ? (
              <time dateTime={note.meetingStartedAt}>
                {formatAppDate(note.meetingStartedAt, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
            ) : (
              <span className="font-normal text-[var(--el-muted)]">
                아직 시작하지 않았습니다
              </span>
            )}
          </Fact>
          <Fact label="참석자">
            {note.participants.length > 0 ? (
              <>
                <AvatarStack people={note.participants} />
                <span className="font-normal text-[var(--el-body)]">
                  {note.participants.length}명
                </span>
              </>
            ) : (
              <span className="font-normal text-[var(--el-muted)]">미지정</span>
            )}
          </Fact>
          <Fact label="진행자">
            {note.meetingStartedBy?.name ?? (
              <span className="font-normal text-[var(--el-muted)]">미정</span>
            )}
          </Fact>
          <Fact label="누적 기록 시간">
            {minutes > 0 ? (
              `${minutes}분 (종료 세션 누적)`
            ) : (
              <span className="font-normal text-[var(--el-muted)]">없음</span>
            )}
          </Fact>

          <div className="my-2.5 h-px bg-[var(--el-hairline)]" />

          <Fact label="생성">
            <time dateTime={note.createdAt}>
              {formatAppDate(note.createdAt, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>
          </Fact>
          <Fact label="최종 수정">
            <time dateTime={note.updatedAt}>
              {formatAppDate(note.updatedAt, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>
          </Fact>
        </dl>
      </NoteColumn>
    </div>
  );
}

/** 노트 정보 로딩 스켈레톤. DataBoundary fallback으로 부모(note-panel)가 쓴다. */
export function NoteDetailsSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-8">
      <NoteColumn className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </NoteColumn>
    </div>
  );
}
