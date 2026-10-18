"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { AssigneeCell, AssigneeFace } from "@/components/heymoa/assignee-cell";
import { ChoiceToggle } from "@/components/heymoa/choice-toggle";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import type { Choice } from "@/lib/notes/review/confirm";
import { DueCell } from "@/components/heymoa/due-cell";
import { formatAppDate, formatDueDate } from "@/lib/format/date";
import type {
  MeetingReviewResponseDataItemsItemReplacementsItem as Replacement,
  MeetingReviewResponseDataItemsItemTaskChangesItem as TaskChange,
  ProjectTaskListResponseDataTasksItem as ProjectTask,
  TranscriptResponseDataSegmentsItem,
  UpdateMeetingReviewItemRequest,
} from "@/lib/api/generated/models";
import { LINK_LABEL, type MeetingRelation } from "@/lib/notes/review/meeting-links";
import { KIND_LABEL } from "@/lib/notes/review/sections";
import { formatOffset } from "@/lib/transcription/presentation";
import {
  assigneeImageOf,
  assigneeKey,
  type AssigneeChoice,
  type AssigneeValue,
} from "@/lib/assignees/describe";
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
  toggle?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="rounded-control bg-[var(--el-canvas-soft)] px-3 py-2.5 text-[12.5px] text-[var(--el-body)]">
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

type TaskDraft = NonNullable<NonNullable<UpdateMeetingReviewItemRequest["decisions"]>[number]["taskChange"]>;

/** 회의 라벨은 이 회의 소유입니다. 응답의 nullable 참조를 요청 모양으로 돌립니다. */
function taskAssigneeRequestOf(box: NonNullable<TaskChange["draft"]>["assignee"]): TaskDraft["assignee"] {
  if (!box) return null;
  const value = box.value;
  return { value: !value ? null : value.type === "SPEAKER_LABEL"
    ? { type: value.type, label: value.label ?? undefined }
    : { type: value.type, id: value.id ?? undefined } };
}

/** 기존 할 일의 변경 초안. 실제 업무는 검토 완료에서만 바뀝니다. */
export function TaskChangeSuggestion({
  change,
  task,
  noteId,
  choices,
  choice,
  taskState,
  onRetryTask,
  disabled,
  onChoose,
  context,
  duplicate = false,
  confirmed = false,
  included = true,
}: {
  change: TaskChange;
  task: ProjectTask | undefined;
  noteId: string;
  choices: AssigneeChoice[];
  choice: Choice | null;
  /** 프로젝트 할 일 조회 상태. 실패를 「할 일을 찾지 못했다」로 적지 않는다 */
  taskState: "pending" | "ready" | "failed";
  onRetryTask: () => void;
  disabled: boolean;
  /** 선택을 검토본에 저장한다. 저장했는지를 돌려준다 */
  onChoose: (next: Choice, draft: TaskDraft) => Promise<boolean>;
  context?: ReactNode;
  duplicate?: boolean;
  confirmed?: boolean;
  included?: boolean;
}) {
  const saved = change.draft;
  const draft: TaskDraft = saved ? {
    ...saved,
    assignee: taskAssigneeRequestOf(saved.assignee),
  } : {
    expectedRevision: change.target.revision,
    status: change.status,
    assignee: taskAssigneeRequestOf(change.assignee),
    due: change.due,
  };
  // 초안은 표시 이름이 아닌 참조로 옵니다. UI에서만 선택 목록과 이어 이름을 붙입니다.
  const reference = draft.assignee?.value;
  const assignee: AssigneeValue | null = reference
    ? reference.type === "SPEAKER_LABEL"
      ? { type: "SPEAKER_LABEL", noteId, label: reference.label ?? undefined }
      : choices.find((row) => row.type === reference.type && "id" in row && row.id === reference.id)
        ?? (change.assignee?.value?.type === reference.type && change.assignee.value.id === reference.id
          ? change.assignee.value
          : { type: reference.type, id: reference.id ?? undefined, name: "선택한 멤버" })
    : null;
  const applied = change.decision === "APPLIED" || (confirmed && included && change.decision === "APPLY");
  const stale = taskState !== "pending" && !confirmed && !applied && task !== undefined && task.revision !== draft.expectedRevision;
  const locked = disabled || applied || confirmed;
  const fieldsLocked = locked || !task || stale || taskState === "pending";
  const saveDraft = (next: TaskDraft) => onChoose(choice ?? "change", next);

  return (
    <SuggestionShell
      label="기존 할 일 변경"
      toggle={
        <ChoiceToggle
          label="기존 할 일에 반영할지"
          changeLabel={applied ? "반영됨" : choice === "change" ? confirmed ? "제외됨" : "반영 예정" : "반영"}
          keepLabel="넘기기"
          value={choice}
          disabled={locked || taskState === "pending"}
          changeDisabled={!task || stale}
          onChange={(next) => void onChoose(next, draft)}
        />
      }
      footer={
        <>
          {context}
          {stale ? (
            <p role="alert" className="mt-2 text-xs text-[var(--el-muted)]">기존 할 일이 변경되어 이 제안을 반영할 수 없습니다. 넘기기를 선택해 주세요.</p>
          ) : duplicate && !confirmed ? (
            <p role="alert" className="mt-2 text-xs text-[var(--el-muted)]">같은 할 일의 다른 제안도 반영 예정입니다. 하나만 반영하고 나머지는 넘겨 주세요.</p>
          ) : null}
          {!confirmed && !applied && choice === "change" ? (
            <p className="mt-2 text-xs text-[var(--el-muted)]">검토 완료 때 적용됩니다.</p>
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
      {task && draft.status ? (
        <Diff
          label="상태"
          from={TASK_STATUS_LABEL[task.taskStatus]}
          to={<Pick>{TASK_STATUS_LABEL[draft.status]}</Pick>}
        />
      ) : null}
      {task && draft.assignee ? (
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
            <Pick editable={!fieldsLocked}>
              <AssigneeCell
                value={assignee ?? null}
                choices={choices}
                editable={!fieldsLocked}
                placeholder="없음"
                onChange={(next) => void saveDraft({ ...draft, assignee: taskAssigneeRequestOf({ value: next }) })}
              />
            </Pick>
          }
        />
      ) : null}
      {task && draft.due ? (
        <Diff
          label="기한"
          from={task.due ? formatDueDate(task.due) : "없음"}
          to={
            <Pick editable={!fieldsLocked}>
              <DueCell value={draft.due.value ?? null} editable={!fieldsLocked} placeholder="없음" onChange={(value) => void saveDraft({ ...draft, due: { value } })} />
            </Pick>
          }
        />
      ) : null}
      {task && draft.assignee && assigneeKey(assignee) === assigneeKey(task.assignee) && !draft.status && !draft.due ? (
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
