"use client";

import { useEffect, useRef } from "react";
import { RefreshCcw } from "lucide-react";
import { toast } from "@/lib/ui/toast";

import { NoteListRow } from "@/components/workspace/note-list-row";
import { WorkspaceOnboarding } from "@/components/workspace/workspace-onboarding";
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
  onNewMeeting,
}: {
  workspaceId: string;
  notes: NoteListResponseDataNotesItem[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  /** 빈 상태 CTA. 프로젝트가 없으면 셸이 프로젝트를 먼저 묻는다. */
  onNewMeeting: () => void;
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
      <div aria-label="노트 불러오는 중">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            // 실제 행(note-list-row)이 두 줄 h-16이다. 어긋나면 데이터 도착 시 목록이 아래로 점프한다.
            className="flex h-16 items-center gap-[14px] px-3"
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
    // **누를 수 있는 것을 여기 둔다.** 예전에는 "상단바의 새 노트로…"라고 가리키기만 했는데,
    // 프로젝트가 없으면 그 버튼이 비활성이라 가리키는 곳이 눌리지 않았다.
    return <WorkspaceOnboarding stage="no-note" onNewMeeting={onNewMeeting} onCreateProject={onNewMeeting} />;
  }

  return (
    <div data-testid="workspace-note-list">
      {groupNotesByRecency(sortNotesByRecency(notes)).map((group) => (
        <section key={group.key}>
          <h2 className="px-3 pt-5 pb-2 text-xs font-medium text-[var(--el-muted)]">
            {group.label}
          </h2>
          {/* **행 사이에 선을 두지 않는다.** 가르는 것은 날짜 머리글이고, 행은 h-16과 hover로
              선다. 예전에는 그룹 안에서만 `divide-y`를 돌려서, 하루에 두 건 이상인 그룹에만
              선이 생겼다 — 목록 전체에 한 줄만 뜨니 규칙이 아니라 사고로 읽혔다. */}
          <div>
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
