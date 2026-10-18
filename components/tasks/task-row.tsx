"use client";

import { ARRIVE_CLASS } from "@/components/heymoa/motion";
import { Check, Folder } from "lucide-react";
import { motion, useIsPresent } from "motion/react";

import { AssigneeCell } from "@/components/heymoa/assignee-cell";
import { DueCell } from "@/components/heymoa/due-cell";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CONFLICT_MESSAGE } from "@/lib/api/error-message";
import type { AssigneeChoice } from "@/lib/assignees/describe";
import type { TaskEntry } from "@/lib/tasks/task-groups";
import { cn } from "@/lib/utils";

/**
 * 머리글 · 행 · 불러오는 동안의 자리가 같은 칸을 쓴다. 칸이 갈리면 도착할 때 줄이 튄다.
 * 좁은 화면에서는 내용 옆에 고정 폭 칸을 둘 자리가 없어 둘째 줄로 내린다([TASK_ROW_TRAIL]).
 * 프로젝트 하나만 보이면(거르기 · 프로젝트가 하나뿐) 모든 줄이 같은 이름이라 그 칸을 뺀다.
 */
export function taskRowGrid(showProject: boolean) {
  return cn(
    "grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-4 px-2",
    showProject
      ? "sm:grid-cols-[28px_minmax(0,1fr)_128px_148px_112px]"
      : "sm:grid-cols-[28px_minmax(0,1fr)_148px_112px]"
  );
}

/** 기한 칸은 오른쪽 끝에 붙인다 — 날짜 끝이 한 줄로 서서 위아래로 견주기 쉽다. */
export const TASK_DUE_ALIGN = "sm:justify-self-end";

/** 프로젝트 · 담당 · 기한. 넓은 화면에서는 상자를 지워 격자의 칸 순서를 그대로 쓴다. */
export const TASK_ROW_TRAIL =
  "col-start-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 pb-1.5 sm:contents sm:pb-0";

/** 새로 생겼거나 상태가 바뀌어 다른 묶음으로 옮겨 온 줄의 등장. */
export function TaskRow({
  entry,
  showProject,
  choices,
  today,
  pending,
  completing,
  arrived,
  reduceMotion,
  conflict,
  onToggleDone,
  onAssign,
  onDue,
  onOpenHistory,
  onEdit,
}: {
  entry: TaskEntry;
  showProject: boolean;
  choices: AssigneeChoice[];
  today: string;
  /** 이 할 일의 저장이 도는 중. 같은 판으로 두 번 보내면 뒤의 것이 거절된다 */
  pending: boolean;
  /** 끝내거나 취소하는 저장이 도는 중. 응답 전에 줄을 먼저 긋는다 */
  completing: boolean;
  arrived: boolean;
  /** 움직임 줄이기 설정. 켜져 있으면 줄이 빠질 때 접히지 않고 바로 사라진다 */
  reduceMotion: boolean;
  /** 다른 사람이 먼저 수정해 저장이 거절됐다 */
  conflict: boolean;
  onToggleDone: () => void;
  onAssign: (next: AssigneeChoice | null) => void;
  onDue: (next: string | null) => void;
  onOpenHistory: () => void;
  /** 이력 시트를 내용 고치기로 연다 */
  onEdit: () => void;
}) {
  const task = entry;
  const done = task.taskStatus !== "OPEN";
  const struck = done || completing;
  const editable = !done && !pending;
  // 떠나는 중인 줄은 손에 닿지 않게 한다. 다른 묶음으로 옮겨 가면 새 줄이 이미 섰는데, 옛 줄의 버튼은 낡은 판으로 저장한다.
  const present = useIsPresent();

  return (
    // 끝내거나 다른 묶음으로 옮겨 이 자리를 떠나는 줄은 짧게 옅어지며 접힌다 — 아래 줄이 튀어 오르지 않게.
    <motion.li
      exit={reduceMotion ? undefined : { opacity: 0, height: 0, overflow: "hidden" }}
      inert={!present}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "group rounded-control transition-[background-color] duration-150 ease-out hover:bg-[var(--el-surface-strong)]/55 focus-within:bg-[var(--el-surface-strong)]/55 motion-reduce:transition-none",
        arrived && ARRIVE_CLASS
      )}
    >
      <div className={cn(taskRowGrid(showProject), "min-h-11")}>
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
          {/* 넓은 화면(lg)에서 줄을 가리키면 이력과 수정이 선다. 담당 · 기한 칸은 가리지 않는다. 그보다 좁으면 고정 칸 사이의
              제목이 100px 남짓이라 두 버튼이 제목을 지운다 — 줄을 눌러 시트를 연다 */}
          <span className="hidden shrink-0 items-center gap-3 text-xs lg:group-hover:flex">
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
          {/* 프로젝트는 값이 아니라 출처라 테두리 칩(`Badge outline`)으로 한 단 낮춘다 — 담당(얼굴) · 기한(날짜)과 모양부터
              다르다. 칸이 좁아 이름이 잘리면 가리킬 때 툴팁이 전체 이름을 보인다(글 자체는 DOM 에 다 있어 읽기 프로그램은 다 읽는다).
              칩을 탭 순서에 넣지 않는다 — 줄마다 멈출 자리가 하나 더 생긴다. 키보드로는 내용을 눌러 여는 이력 시트가 프로젝트를 보인다. */}
          {showProject ? (
            <Tooltip>
              <TooltipTrigger
                delay={500}
                render={
                  <Badge
                    variant="outline"
                    className="h-6 max-w-full justify-start gap-1.5 border-[var(--el-hairline)] font-normal text-[var(--el-body)] sm:justify-self-start"
                  />
                }
              >
                <Folder aria-hidden className="text-[var(--el-muted)]" />
                <span className="min-w-0 truncate">{entry.projectName}</span>
              </TooltipTrigger>
              <TooltipContent className="motion-reduce:animate-none">{entry.projectName}</TooltipContent>
            </Tooltip>
          ) : null}
          <AssigneeCell
            value={task.assignee}
            choices={choices}
            editable={editable}
            placeholder={done ? "" : "담당 정하기"}
            quiet
            onChange={onAssign}
            // 칸 폭 전체로 늘면 hover 면이 이름보다 훨씬 길게 칠해진다.
            className="sm:justify-self-start"
          />
          <DueCell
            value={task.due}
            editable={editable}
            overdue={!done && Boolean(task.due) && task.due! < today}
            quiet
            onChange={onDue}
            className={TASK_DUE_ALIGN}
          />
        </div>
      </div>
      {conflict ? (
        <p role="alert" className={cn("pb-2 pl-[52px] pr-2 text-xs text-[var(--el-error-strong)]", ARRIVE_CLASS)}>
          {CONFLICT_MESSAGE}
        </p>
      ) : null}
    </motion.li>
  );
}
