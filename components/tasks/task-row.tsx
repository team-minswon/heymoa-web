"use client";

import { ARRIVE_CLASS } from "@/components/heymoa/motion";
import { Bot, Check, Folder } from "lucide-react";
import { motion, useIsPresent } from "motion/react";

import { AssigneeCell } from "@/components/heymoa/assignee-cell";
import { DueCell } from "@/components/heymoa/due-cell";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AssigneeChoice } from "@/lib/assignees/describe";
import type { TaskEntry } from "@/lib/tasks/task-groups";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function taskRowGrid(showProject: boolean) {
  return cn(
    "grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-4 px-2",
    showProject
      ? "sm:grid-cols-[28px_minmax(0,1fr)_128px_148px_128px]"
      : "sm:grid-cols-[28px_minmax(0,1fr)_148px_128px]"
  );
}

export const TASK_DUE_ALIGN = "sm:justify-self-end";

export const TASK_ROW_TRAIL =
  "col-start-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 pb-1.5 sm:contents sm:pb-0";

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
  pending: boolean;
  completing: boolean;
  arrived: boolean;
  reduceMotion: boolean;
  conflict: boolean;
  onToggleDone: () => void;
  onAssign: (next: AssigneeChoice | null) => void;
  onDue: (next: string | null) => void;
  onOpenHistory: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("tasks.row");
  const tActions = useTranslations("common.actions");
  const tError = useTranslations("errors");
  const task = entry;
  const done = task.taskStatus !== "OPEN";
  const struck = done || completing;
  const editable = !done && !pending;
  const present = useIsPresent();

  return (
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
        <button
          type="button"
          aria-pressed={done}
          aria-label={t(done ? "reopen" : "complete", { content: task.content })}
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
          {task.externalAgentChange ? (
            <span className="inline-flex max-w-[40%] shrink-0 items-center gap-1 text-xs text-[var(--el-muted)]">
              <Bot aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">
                {task.externalAgentChange.connectionName
                  ? t("agentNamed", { name: task.externalAgentChange.connectionName })
                  : t("agent")}
              </span>
            </span>
          ) : null}
          <span className="hidden shrink-0 items-center gap-3 text-xs lg:group-hover:flex">
            <button type="button" onClick={onOpenHistory} className="text-[var(--el-muted)] hover:text-[var(--el-ink)]">
              {t("history")}
            </button>
            {done ? null : (
              <button type="button" onClick={onEdit} className="text-[var(--el-muted)] hover:text-[var(--el-ink)]">
                {tActions("edit")}
              </button>
            )}
          </span>
        </div>
        <div className={TASK_ROW_TRAIL}>
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
            placeholder={done ? "" : undefined}
            quiet
            onChange={onAssign}
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
          {tError("conflict")}
        </p>
      ) : null}
    </motion.li>
  );
}
