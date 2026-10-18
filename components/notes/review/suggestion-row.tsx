"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import Link from "next/link";

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
  TranscriptResponseDataSegmentsItem,
} from "@/lib/api/generated/models";
import { LINK_LABEL, type MeetingRelation } from "@/lib/notes/review/meeting-links";
import { KIND_LABEL } from "@/lib/notes/review/sections";
import { formatOffset } from "@/lib/transcription/presentation";
import {
  getGetProjectTaskRevisionsQueryKey,
  useUpdateProjectTask,
} from "@/lib/api/generated/projects/projects";
import {
  assigneeImageOf,
  assigneeKey,
  assigneeRequestOf,
  type AssigneeChoice,
  type AssigneeValue,
} from "@/lib/assignees/describe";
import { toast } from "@/lib/ui/toast";
import { CONFLICT_MESSAGE } from "@/lib/api/error-message";
import { isProjectTaskQueryKey, TASK_STATUS_LABEL } from "@/lib/tasks/task-groups";
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
  toggle?: ReactNode;
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
  context,
}: {
  replacement: Replacement;
  choice: Choice | null;
  disabled: boolean;
  onChoose: (next: Choice) => void;
  context?: ReactNode;
}) {
  const { target } = replacement;
  // 다른 확정이 먼저 끝낸 결정은 여기서 끝낼 것이 없다. 확정도 그 노드를 건너뛴다.
  const ended = target.endedAt !== null;
  return (
    <SuggestionShell
      label={`이전 ${KIND_LABEL[target.kind]} ${replacement.label}`}
      toggle={
        <ChoiceToggle
          label="이전 결정을 끝낼지"
          changeLabel="끝내기"
          keepLabel="이어가기"
          value={choice}
          disabled={disabled || ended}
          onChange={onChoose}
        />
      }
      footer={context ?? <p className="mt-1.5 text-xs text-[var(--el-muted)]">{replacement.reason}</p>}
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

/** 승인 제안의 근거를 그 제안 안에 둔다. 관계 조회만으로 선택이나 대상 상태를 바꾸지 않는다. */
export function RelationContext({
  relation,
  segments,
  onOpenScript,
  fallbackReason,
  showKind = false,
}: {
  relation: MeetingRelation;
  segments: readonly TranscriptResponseDataSegmentsItem[];
  onOpenScript: (segmentId: string) => void;
  fallbackReason?: string;
  showKind?: boolean;
}) {
  const sequences = new Set(relation.evidenceSequences);
  const quotes = segments.filter((segment) => sequences.has(segment.sequence));
  return (
    <div className="mt-1.5 space-y-1 text-xs text-[var(--el-muted)]">
      <p>
        {showKind ? `${LINK_LABEL[relation.kind]} · ` : ""}
        {relation.scope === "same" ? "같은 회의" : relation.scope === "approved" ? "프로젝트 확정 항목" : relation.targetTitle}
        {` · 판 ${relation.target.revision}`}
      </p>
      {relation.reason || fallbackReason ? (
        <p className="whitespace-pre-wrap break-words">{relation.reason || fallbackReason}</p>
      ) : null}
      {quotes.length > 0 ? (
        <ul aria-label="관계 근거 발언" className="space-y-1 border-l border-[var(--el-hairline)] pl-3">
          {quotes.map((segment) => (
            <li key={segment.segmentId}>
              <button type="button" className="text-left leading-5 hover:text-[var(--el-ink)]" onClick={() => onOpenScript(segment.segmentId)}>
                {formatOffset(segment.startedAtMs)} · {segment.text}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** 승인 API에 제안이 없는 관계도 해당 결정·할 일 아래에서 읽는다. */
export function RelationSuggestion({
  relation,
  workspaceId,
  onSelectItem,
  ...context
}: {
  relation: MeetingRelation;
  workspaceId?: string;
  onSelectItem: (itemId: string) => void;
  segments: readonly TranscriptResponseDataSegmentsItem[];
  onOpenScript: (segmentId: string) => void;
}) {
  return (
    <SuggestionShell label={LINK_LABEL[relation.kind]} footer={<RelationContext relation={relation} {...context} />}>
      {relation.targetItemId ? (
        <button type="button" aria-label={`관계 대상 항목 보기 · ${relation.target.content}`} className="text-left underline underline-offset-4" onClick={() => onSelectItem(relation.targetItemId!)}>
          {relation.target.content}
        </button>
      ) : <span className="break-words text-[var(--el-ink)]">{relation.target.content}</span>}
      {relation.scope === "past" && workspaceId && relation.target.noteId ? (
        <Link className="text-xs underline underline-offset-4" href={`/w/${workspaceId}/notes/${relation.target.noteId}?view=full&tab=summary`}>
          {relation.targetTitle}
        </Link>
      ) : null}
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
  context,
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
  context?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const update = useUpdateProjectTask({
    mutation: {
      meta: { suppressErrorToast: true },
      // 목록과 함께 그 할 일의 이력도 다시 읽는다. 이력 시트를 다시 열었을 때 바뀌기 전 판이 서면 안 된다.
      // **목록은 둘이다** (APP-685) — 프로젝트 키만 비우면 「모든 할 일」이 낡은 값을 들고 남는다.
      // onSuccess 에서 기다려야 그동안 반영이 진행 중으로 남는다 — 검토 화면은 이것으로 확정을 막고,
      // 끝나면 곧바로 선택 저장이 이어받는다. 밖에서 기다리면 그 틈에 확정이 열린다.
      onSuccess: (_, { workspaceId, projectId, taskId }) =>
        Promise.all([
          queryClient.invalidateQueries({
            predicate: ({ queryKey }) => isProjectTaskQueryKey(queryKey),
          }),
          queryClient.invalidateQueries({
            queryKey: getGetProjectTaskRevisionsQueryKey(workspaceId, projectId, taskId),
          }),
        ]),
    },
  });
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
      await saveChoice();
    } catch (error) {
      if (errorCodeOf(error) === "PROJECT_KNOWLEDGE_CONFLICT") {
        setConflict(true);
        await queryClient.invalidateQueries({
          predicate: ({ queryKey }) => isProjectTaskQueryKey(queryKey),
        });
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
          keepLabel="넘기기"
          value={choice}
          // 반영한 뒤에는 잠근다 — 「넘기기」로 바꿔도 이미 바뀐 할 일은 되돌아가지 않아 기록과 실제가 갈린다.
          disabled={disabled || applied || update.isPending || !task}
          keepDisabled={choiceUnsaved}
          onChange={(next) => (next === "change" ? void apply() : onChoose("keep"))}
        />
      }
      footer={
        <>
          {context}
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
          from={
            task.assignee ? (
              <AssigneeFace
                value={task.assignee}
                image={assigneeImageOf(choices, task.assignee)}
              />
            ) : (
              "없음"
            )
          }
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
