"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { AssigneeCell, AssigneeFace } from "@/components/heymoa/assignee-cell";
import { ChoiceToggle } from "@/components/heymoa/choice-toggle";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import type { Choice } from "@/lib/notes/review/confirm";
import { DueCell } from "@/components/heymoa/due-cell";
import { formatAppDate, formatDueDate } from "@/lib/format/date";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import type {
  MeetingReviewResponseDataItemsItemReplacementsItem as Replacement,
  MeetingReviewResponseDataItemsItemTaskChangesItem as TaskChange,
  ProjectTaskListResponseDataTasksItem as ProjectTask,
} from "@/lib/api/generated/models";
import {
  getGetProjectTaskRevisionsQueryKey,
  getGetProjectTasksQueryKey,
  useUpdateProjectTask,
} from "@/lib/api/generated/projects/projects";
import {
  assigneeKey,
  assigneeRequestOf,
  type AssigneeChoice,
  type AssigneeValue,
} from "@/lib/assignees/describe";
import { toast } from "@/lib/ui/toast";
import { CONFLICT_MESSAGE } from "@/lib/api/error-message";
import { TASK_STATUS_LABEL } from "@/lib/tasks/task-groups";
import { cn } from "@/lib/utils";

/** 제안 한 줄의 틀. 무엇에 대한 제안인지 · 무엇이 바뀌는지 · 받을지를 한 줄에 둔다. */
function SuggestionShell({
  label,
  children,
  toggle,
  footer,
}: {
  label: string;
  children: ReactNode;
  toggle: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-control bg-[var(--el-canvas-soft)] px-3 py-2.5 text-[12.5px] text-[var(--el-body)]">
      <div className="grid grid-cols-1 items-center gap-x-3 gap-y-1.5 sm:grid-cols-[96px_minmax(0,1fr)_auto]">
        <span className="text-xs whitespace-nowrap text-[var(--el-muted)]">{label}</span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">{children}</span>
        {toggle}
      </div>
      {footer}
    </div>
  );
}

function Diff({ label, from, to }: { label: string; from: ReactNode; to: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <span className="text-[var(--el-muted-soft)] line-through">{from}</span>
      <span aria-hidden>→</span>
      {to}
    </span>
  );
}

export function ReplacementSuggestion({
  replacement,
  choice,
  disabled,
  onChoose,
}: {
  replacement: Replacement;
  choice: Choice | null;
  disabled: boolean;
  onChoose: (next: Choice) => void;
}) {
  const { target } = replacement;
  // 다른 확정이 먼저 끝낸 결정은 여기서 끝낼 것이 없다. 확정도 그 노드를 건너뛴다.
  const ended = target.endedAt !== null;
  return (
    <SuggestionShell
      label="이전 결정 대체"
      toggle={
        <ChoiceToggle
          label="이전 결정을 끝낼지"
          changeLabel="끝내기"
          value={choice}
          disabled={disabled || ended}
          onChange={onChoose}
        />
      }
      footer={<p className="mt-1.5 text-xs text-[var(--el-muted)]">{replacement.reason}</p>}
    >
      <span className={cn("text-[var(--el-ink)]", ended && "text-[var(--el-muted-soft)] line-through")}>
        {target.content}
      </span>
      <span className="text-xs text-[var(--el-muted)]">
        {target.noteTitle} · {formatAppDate(target.approvedAt, { month: "long", day: "numeric" })} 확정
        {ended ? " · 이미 끝남" : ""}
      </span>
    </SuggestionShell>
  );
}

/**
 * 기존 할 일 변경. 제안된 값을 사람이 칸에서 바꾼 뒤 「반영」하면 **할 일에 바로 저장한다** —
 * 확정을 기다리지 않는다. 할 일은 확정과 따로 사람이 다루는 대상이고, 저장한 사실은 할 일 이력에 남는다.
 */
export function TaskChangeSuggestion({
  change,
  task,
  workspaceId,
  projectId,
  choices,
  choice,
  taskState,
  onRetryTask,
  disabled,
  onChoose,
}: {
  change: TaskChange;
  task: ProjectTask | undefined;
  workspaceId: string;
  projectId: string;
  choices: AssigneeChoice[];
  choice: Choice | null;
  /** 프로젝트 할 일 조회 상태. 실패를 「할 일을 찾지 못했다」로 적지 않는다 */
  taskState: "pending" | "ready" | "failed";
  onRetryTask: () => void;
  disabled: boolean;
  /** 선택을 검토본에 저장한다. 저장했는지를 돌려준다 */
  onChoose: (next: Choice) => Promise<boolean>;
}) {
  const queryClient = useQueryClient();
  const tasksKey = getGetProjectTasksQueryKey(workspaceId, projectId);
  const update = useUpdateProjectTask({ mutation: { meta: { suppressErrorToast: true } } });
  const [assignee, setAssignee] = useState<AssigneeValue | null | undefined>(
    change.assignee ? change.assignee.value : undefined
  );
  const [due, setDue] = useState<string | null | undefined>(
    change.due ? change.due.value : undefined
  );
  const [conflict, setConflict] = useState(false);
  // 할 일에는 반영했는데 선택 저장이 거절됐다. 다시 누르면 할 일은 두고 선택만 저장한다.
  const [choiceUnsaved, setChoiceUnsaved] = useState(false);
  const applied = choice === "change";
  const locked = disabled || applied || choiceUnsaved || update.isPending || !task;

  const saveChoice = async () => setChoiceUnsaved(!(await onChoose("change")));

  const apply = async () => {
    if (choiceUnsaved) return saveChoice();
    if (!task) return;
    try {
      await update.mutateAsync({
        workspaceId,
        projectId,
        taskId: task.taskId,
        data: {
          content: task.content,
          taskStatus: change.status ?? task.taskStatus,
          assignee: assigneeRequestOf(assignee === undefined ? (task.assignee ?? null) : assignee),
          due: due === undefined ? task.due : due,
          revision: task.revision,
        },
      });
      setConflict(false);
      // 목록과 함께 그 할 일의 이력도 다시 읽는다. 이력 시트를 다시 열었을 때 바뀌기 전 판이 서면 안 된다.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tasksKey }),
        queryClient.invalidateQueries({
          queryKey: getGetProjectTaskRevisionsQueryKey(workspaceId, projectId, task.taskId),
        }),
      ]);
      await saveChoice();
    } catch (error) {
      if (errorCodeOf(error) === "PROJECT_KNOWLEDGE_CONFLICT") {
        setConflict(true);
        await queryClient.invalidateQueries({ queryKey: tasksKey });
      } else {
        toast.error(errorMessageOf(error, "할 일을 바꾸지 못했습니다."));
      }
    }
  };

  return (
    <SuggestionShell
      label="기존 할 일 변경"
      toggle={
        <ChoiceToggle
          label="기존 할 일에 반영할지"
          changeLabel={update.isPending ? "반영 중" : applied ? "반영됨" : "반영"}
          value={choice}
          // 반영한 뒤에는 잠근다 — 「유지」로 바꿔도 이미 바뀐 할 일은 되돌아가지 않아 기록과 실제가 갈린다.
          disabled={disabled || applied || update.isPending || !task}
          keepDisabled={choiceUnsaved}
          onChange={(next) => (next === "change" ? void apply() : onChoose("keep"))}
        />
      }
      footer={
        <>
          {conflict ? (
            <p role="alert" className="mt-2 text-xs text-[var(--el-muted)]">
              {CONFLICT_MESSAGE}
            </p>
          ) : null}
          {choiceUnsaved ? (
            <p role="alert" className="mt-2 text-xs text-[var(--el-muted)]">
              할 일에는 반영했지만 선택을 저장하지 못했습니다. 반영을 한 번 더 누르면 선택만 저장합니다.
            </p>
          ) : null}
          {taskState === "failed" ? (
            <InlineRetry
              variant="line"
              label="기존 할 일을 불러오지 못했습니다."
              onRetry={onRetryTask}
              className="mt-2 text-xs text-[var(--el-muted)]"
            />
          ) : taskState === "ready" && !task ? (
            <p className="mt-2 text-xs text-[var(--el-muted)]">바꿀 할 일을 찾지 못했습니다.</p>
          ) : null}
        </>
      }
    >
      {taskState === "pending" ? (
        <Skeleton aria-label="기존 할 일 불러오는 중" className="h-4 w-40 rounded-chip" />
      ) : (
        <span className="text-[var(--el-ink)]">{task?.content ?? change.reason}</span>
      )}
      {task && change.status ? (
        <Diff
          label="상태"
          from={TASK_STATUS_LABEL[task.taskStatus]}
          to={<Pick>{TASK_STATUS_LABEL[change.status]}</Pick>}
        />
      ) : null}
      {task && change.assignee ? (
        <Diff
          label="담당"
          from={task.assignee ? <AssigneeFace value={task.assignee} /> : "없음"}
          to={
            <Pick editable={!locked}>
              <AssigneeCell
                value={assignee ?? null}
                choices={choices}
                editable={!locked}
                placeholder="없음"
                onChange={(next) => setAssignee(next)}
              />
            </Pick>
          }
        />
      ) : null}
      {task && change.due ? (
        <Diff
          label="기한"
          from={task.due ? formatDueDate(task.due) : "없음"}
          to={
            <Pick editable={!locked}>
              <DueCell value={due ?? null} editable={!locked} placeholder="없음" onChange={setDue} />
            </Pick>
          }
        />
      ) : null}
      {task && assignee !== undefined && assigneeKey(assignee) === assigneeKey(task.assignee) && !change.status && !change.due ? (
        <span className="text-[var(--el-muted-soft)]">이미 같은 값입니다</span>
      ) : null}
    </SuggestionShell>
  );
}

function Pick({ children, editable = false }: { children: ReactNode; editable?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-chip border bg-[var(--el-surface-card)] px-2 text-xs font-semibold text-[var(--el-ink)] transition-colors",
        editable ? "border-[var(--el-hairline-strong)]" : "border-transparent"
      )}
    >
      {children}
    </span>
  );
}
