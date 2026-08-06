"use client";

import { useState } from "react";
import { CalendarDays, Check, Clock3, Mic, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/ui/toast";

import { NoteParticipantsField } from "@/components/notes/note-participants-field";
import { ParticipantAvatar } from "@/components/notes/note-participants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGetNoteQueryKey,
  getGetNotesQueryKey,
  useGetNoteSuspense,
  useUpdateNote,
} from "@/lib/api/generated/notes/notes";
import { formatAppDate } from "@/lib/format/date";
import { getRecordedDurationMs } from "@/lib/notes/meeting-state";
import { useAlignedNow } from "@/lib/notes/use-aligned-now";

function formatRecordedClock(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(
    totalSeconds % 60
  ).padStart(2, "0")}`;
}

export function NoteDetails({
  noteId,
  workspaceId,
}: {
  noteId: string;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();
  const noteResponse = useGetNoteSuspense(noteId).data;
  const updateNote = useUpdateNote({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [feedback, setFeedback] = useState<"saved" | null>(null);
  const loaded =
    noteResponse.status === 200 && noteResponse.data.success
      ? noteResponse.data.data
      : undefined;
  // **throw보다 먼저 부른다.** 아래 경계로 던지는 렌더와 정상 렌더가 훅 개수까지 달라지면
  // 안 된다. 진행 중일 때만 돌고, 세션 시작 초에 맞춰 눈금이 튀지 않게 원점을 넘긴다.
  const now = useAlignedNow(
    1_000,
    loaded?.meetingStatus === "IN_PROGRESS",
    loaded?.activeSessionStartedAt
      ? [Date.parse(loaded.activeSessionStartedAt)]
      : []
  );

  // suspense가 네트워크 실패는 throw하지만, 계약 위반 봉투(200 아님·success=false)도 경계로 보낸다.
  if (!loaded) {
    throw new Error("노트를 불러오지 못했습니다.");
  }
  const note = loaded;

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
    <form
      key={`${note.noteId}-${note.updatedAt}`}
      className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] space-y-10 px-[var(--note-gutter)] pb-36 pt-6"
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

      <section className="space-y-3 rounded-block border border-[var(--el-hairline)] bg-white p-5 sm:p-6">
        <Label className="text-xs text-[var(--el-muted)]">참여자</Label>
        <NoteParticipantsField
          noteId={noteId}
          projectId={note.projectId}
          workspaceId={workspaceId}
          participants={note.participants}
        />
      </section>

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
        {/* 누적 기록 시간과 진행자의 자리는 여기다. 노트 헤더는 정본대로(design.pen `MZRO0`)
            상태 칩·제목·메타 두 줄만 갖고, 초 단위로 바뀌는 값과 얼굴은 이 탭이 맡는다 —
            헤더에 함께 두었을 때 그 줄만 소리쳤고 좁은 폭에서 감기며 전사 높이를 눌렀다.
            헤더의 메타 둘째 줄은 같은 값을 분 단위로 요약한다(「기록 42분」). */}
        <div className="rounded-block border border-[var(--el-hairline)] bg-white p-5">
          <dt className="flex items-center gap-2 text-xs font-medium text-[var(--el-muted)]">
            <Mic className="size-3.5" /> 기록 시간
          </dt>
          <dd
            role="timer"
            aria-label="누적 기록 시간"
            className="mt-3 text-sm tabular-nums text-[var(--el-body-strong)]"
          >
            {formatRecordedClock(getRecordedDurationMs(note, now ?? 0))}
          </dd>
        </div>
        {note.meetingStartedBy ? (
          <div className="rounded-block border border-[var(--el-hairline)] bg-white p-5">
            <dt className="flex items-center gap-2 text-xs font-medium text-[var(--el-muted)]">
              <UserRound className="size-3.5" /> 진행자
            </dt>
            <dd className="mt-3 flex items-center gap-2 text-sm text-[var(--el-body-strong)]">
              <ParticipantAvatar
                participant={note.meetingStartedBy}
                size="sm"
                isStarter
              />
              {note.meetingStartedBy.name}
            </dd>
          </div>
        ) : null}
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

/** 노트 정보 로딩 스켈레톤. DataBoundary fallback으로 부모(note-panel)가 쓴다. */
export function NoteDetailsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] space-y-5 px-[var(--note-gutter)] pt-6">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
