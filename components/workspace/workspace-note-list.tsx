"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { NoteListRow } from "@/components/workspace/note-list-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";

/**
 * 목록 전체가 공유하는 상대-시각 시계. 행마다 타이머를 두면 노트가 많을 때 렌더가 폭증하므로
 * 여기 하나만 둔다. 마운트 후 채우고 1분마다 갱신(효과 본문 동기 setState 경고를 타이머로 회피).
 */
function useSharedNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);
  return now;
}

/** 최근 수정 내림차순. v5 허브는 날짜 그룹 없이 최근순 flat 목록이다(프레임 LHXhy). */
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
  const now = useSharedNow();

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
      <div aria-label="노트 불러오는 중" className="divide-y divide-[var(--el-hairline)]">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex h-[52px] items-center gap-[14px] px-3">
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
          상단바의 <span className="font-medium text-[var(--el-ink)]">새 노트</span>로 첫 회의를
          시작하면 실시간 전사와 확정된 기록이 이곳에 쌓입니다.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="workspace-note-list"
      className="divide-y divide-[var(--el-hairline)]"
    >
      {sortNotesByRecency(notes).map((note) => (
        <NoteListRow
          key={note.noteId}
          workspaceId={workspaceId}
          note={note}
          now={now}
        />
      ))}
    </div>
  );
}
