"use client";

import { ARRIVE_CLASS } from "@/components/heymoa/motion";
import { Check } from "lucide-react";

import { AssigneeCell } from "@/components/heymoa/assignee-cell";
import { DueCell } from "@/components/heymoa/due-cell";
import { CONFLICT_MESSAGE } from "@/lib/api/error-message";
import type { AssigneeChoice } from "@/lib/assignees/describe";
import type { TaskEntry } from "@/lib/tasks/task-groups";
import { cn } from "@/lib/utils";

/**
 * 머리글 · 행 · 불러오는 동안의 자리가 같은 칸을 쓴다. 칸이 갈리면 도착할 때 줄이 튄다.
 * 좁은 화면에서는 내용 옆에 고정 폭 칸을 둘 자리가 없어 둘째 줄로 내린다([TASK_ROW_TRAIL]).
 */
export const TASK_ROW_GRID =
  "grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-3 px-2 sm:grid-cols-[28px_minmax(0,1fr)_120px_150px_120px]";

/** 프로젝트 · 담당 · 기한. 넓은 화면에서는 상자를 지워 격자의 칸 순서를 그대로 쓴다. */
export const TASK_ROW_TRAIL =
  "col-start-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 pb-1.5 sm:contents sm:pb-0";

/** 새로 생겼거나 상태가 바뀌어 다른 묶음으로 옮겨 온 줄의 등장. */
export function TaskRow({
  entry,
  choices,
  today,
  pending,
  completing,
  arrived,
  conflict,
  onToggleDone,
  onAssign,
  onDue,
  onOpenHistory,
  onEdit,
}: {
  entry: TaskEntry;
  choices: AssigneeChoice[];
  today: string;
  /** 이 할 일의 저장이 도는 중. 같은 판으로 두 번 보내면 뒤의 것이 거절된다 */
  pending: boolean;
  /** 끝내거나 취소하는 저장이 도는 중. 응답 전에 줄을 먼저 긋는다 */
  completing: boolean;
  arrived: boolean;
  /** 다른 사람이 먼저 수정해 저장이 거절됐다 */
  conflict: boolean;
  onToggleDone: () => void;
  onAssign: (next: AssigneeChoice | null) => void;
  onDue: (next: string | null) => void;
  onOpenHistory: () => void;
  /** 이력 시트를 내용 고치기로 연다 */
  onEdit: () => void;
}) {
  const { task } = entry;
  const done = task.taskStatus !== "OPEN";
  const struck = done || completing;
  const editable = !done && !pending;

  return (
    <li className={cn("group rounded-control hover:bg-[var(--el-canvas-soft)]", arrived && ARRIVE_CLASS)}>
      <div className={cn(TASK_ROW_GRID, "min-h-11")}>
        {/* 동그라미는 18px 이지만 누르는 자리는 사방으로 넓힌다. */}
        <button
          type="button"
          aria-pressed={done}
          aria-label={done ? `${task.content} 다시 열기` : `${task.content} 완료로 표시`}
          disabled={pending}
          onClick={onToggleDone}
          className={cn(
            "relative flex size-[18px] items-center justify-center rounded-full border-[1.5px] transition-colors duration-200 ease-out after:absolute after:-inset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-ink)] motion-reduce:transition-none",
            struck
              ? "border-[var(--el-ink)] bg-[var(--el-ink)] text-[var(--el-on-primary)]"
              : "border-[var(--el-hairline-strong)] hover:border-[var(--el-ink)]"
          )}
        >
          {struck ? <Check aria-hidden className="size-3" strokeWidth={3} /> : null}
        </button>
        <div className="flex min-w-0 items-center gap-3">
          {/* 줄은 늘 그어 두고 색만 옮긴다. 선이 생기고 사라지는 것을 전이로 보여 줄 수 있다. */}
          <button
            type="button"
            onClick={onOpenHistory}
            className={cn(
              "min-h-10 min-w-0 flex-1 truncate text-left text-[14px] line-through transition-[color,text-decoration-color] duration-200 ease-out focus-visible:underline focus-visible:outline-none motion-reduce:transition-none sm:min-h-0",
              struck
                ? task.taskStatus === "CANCELLED"
                  ? "text-[var(--el-muted-soft)] decoration-[var(--el-muted-soft)]"
                  : "text-[var(--el-muted)] decoration-[var(--el-muted-soft)]"
                : "text-[var(--el-ink)] decoration-transparent"
            )}
          >
            {task.content}
          </button>
          {/* 넓은 화면에서 줄을 가리키면 이력과 수정이 선다. 담당 · 기한 칸은 가리지 않는다. 좁은 화면은 줄을 눌러 시트를 연다 */}
          <span className="hidden shrink-0 items-center gap-3 text-xs sm:group-hover:flex">
            <button type="button" onClick={onOpenHistory} className="text-[var(--el-muted)] hover:text-[var(--el-ink)]">
              이력
            </button>
            {done ? null : (
              <button type="button" onClick={onEdit} className="text-[var(--el-muted)] hover:text-[var(--el-ink)]">
                수정
              </button>
            )}
          </span>
        </div>
        <div className={TASK_ROW_TRAIL}>
          <span className="truncate text-xs text-[var(--el-muted)] sm:text-[13px]">
            {entry.projectName}
          </span>
          <AssigneeCell
            value={task.assignee}
            choices={choices}
            editable={editable}
            placeholder={done ? "" : "담당 정하기"}
            onChange={onAssign}
          />
          <DueCell
            value={task.due}
            editable={editable}
            overdue={!done && Boolean(task.due) && task.due! < today}
            onChange={onDue}
          />
        </div>
      </div>
      {conflict ? (
        <p role="alert" className={cn("pb-2 pl-[52px] pr-2 text-xs text-[var(--el-error-strong)]", ARRIVE_CLASS)}>
          {CONFLICT_MESSAGE}
        </p>
      ) : null}
    </li>
  );
}
