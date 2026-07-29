"use client";

import { useEffect, useRef } from "react";
import { FileText, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { NoteListRow } from "@/components/workspace/note-list-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import { isMeetingActive } from "@/lib/notes/meeting-state";
import { useAlignedNow } from "@/lib/notes/use-aligned-now";
import { groupNotesByRecency } from "@/lib/workspace/note-groups";

/**
 * 최근 수정 내림차순. 순서의 주인은 이 함수 하나다 — 묶기(`groupNotesByRecency`)는 정렬하지 않는다.
 *
 * APP-162는 프레임 LHXhy를 근거로 날짜 그룹을 없앴지만, 노트가 쌓이면 상대 시각만으로는
 * 훑기 어렵다는 판단으로 2026-07-26(APP-211)에 날짜 묶음을 되살렸다. 행 자체는 FORM SPEC
 * 정본(52·한 줄) 그대로이고 헤더만 위에 붙는다.
 */
export function sortNotesByRecency(
  notes: NoteListResponseDataNotesItem[]
): NoteListResponseDataNotesItem[] {
  return [...notes].sort(
    (a, b) =>
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
      b.noteId.localeCompare(a.noteId)
  );
}

export function WorkspaceNoteList({
  workspaceId,
  notes,
  isPending,
  isError,
  onRetry,
}: {
  workspaceId: string;
  notes: NoteListResponseDataNotesItem[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const retryRef = useRef(onRetry);
  const activeMeetingStarts = notes
    .filter(isMeetingActive)
    .map((note) => Date.parse(note.activeSessionStartedAt ?? ""))
    .filter(Number.isFinite);
  // 목록 전체가 이 타이머 하나만 공유하되, 각 활성 회의의 다음 경과 분 경계 중 가장 가까운
  // 시각에 깨운다. 시작 초가 다른 회의도 최대 59초 늦게 바뀌지 않는다.
  const now = useAlignedNow(60_000, true, activeMeetingStarts);

  useEffect(() => {
    retryRef.current = onRetry;
  }, [onRetry]);

  useEffect(() => {
    if (!isError) return;

    toast.error("노트를 불러오지 못했습니다.", {
      id: `workspace-notes-${workspaceId}`,
      action: {
        label: "다시 시도",
        onClick: () => retryRef.current(),
      },
    });
  }, [isError, workspaceId]);

  if (isPending) {
    return (
      <div
        aria-label="노트 불러오는 중"
        className="divide-y divide-[var(--el-hairline)]"
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex h-[52px] items-center gap-[14px] px-3"
          >
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (isError && !notes.length) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={onRetry}
        >
          <RefreshCcw /> 다시 시도
        </Button>
      </div>
    );
  }

  if (!notes.length) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-panel border border-dashed border-[var(--el-hairline-strong)] px-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-[var(--el-surface-strong)]">
          <FileText className="size-5 text-[var(--el-muted)]" />
        </span>
        <h2 className="mt-5 font-serif text-2xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
          아직 회의 기록이 없습니다
        </h2>
        <p className="mt-1 max-w-sm text-sm text-[var(--el-muted)]">
          상단바의{" "}
          <span className="font-medium text-[var(--el-ink)]">새 노트</span>로 첫
          회의를 시작하면 실시간 전사와 확정된 기록이 이곳에 쌓입니다.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="workspace-note-list">
      {groupNotesByRecency(sortNotesByRecency(notes)).map((group) => (
        <section key={group.key}>
          <h2 className="px-3 pt-5 pb-2 text-xs font-medium text-[var(--el-muted)]">
            {group.label}
          </h2>
          <div className="divide-y divide-[var(--el-hairline)]">
            {group.notes.map((note) => (
              <NoteListRow
                key={note.noteId}
                workspaceId={workspaceId}
                note={note}
                now={now}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
