"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

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
import type { MeetingRelation } from "@/lib/notes/review/meeting-links";
import { formatOffset } from "@/lib/transcription/presentation";
import {
  assigneeImageOf,
  assigneeKey,
  type AssigneeChoice,
  type AssigneeValue,
} from "@/lib/assignees/describe";
import { cn } from "@/lib/utils";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";

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
    <div
      role="group"
      aria-label={label}
      className="rounded-control bg-[var(--el-canvas-soft)] px-3 py-2.5 text-[12.5px] text-[var(--el-body)]"
    >
      <div className="grid grid-cols-1 items-center gap-x-3 gap-y-1.5 sm:grid-cols-[96px_minmax(0,1fr)_auto]">
        <span className="text-xs whitespace-nowrap text-[var(--el-muted)]">
          {label}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {children}
        </span>
        {toggle ? (
          <span className="inline-flex justify-self-start sm:justify-self-end">
            {toggle}
          </span>
        ) : null}
      </div>
      {/* 근거는 라벨 칸이 아니라 내용 칸 아래에 선다 — 라벨 밑에 서면 내용과 따로 논다(APP-1587). */}
      {footer ? <div className="sm:pl-[108px]">{footer}</div> : null}
    </div>
  );
}

function Diff({
  label,
  from,
  to,
}: {
  label: string;
  from: ReactNode;
  to: ReactNode;
}) {
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
  newContent,
  choice,
  disabled,
  onChoose,
  context,
}: {
  replacement: Replacement;
  newContent: string;
  choice: Choice | null;
  disabled: boolean;
  onChoose: (next: Choice) => void;
  context?: ReactNode;
}) {
  const t = useTranslations("notes.review.suggestions");
  const tKind = useTranslations("notes.kinds");
  const dateLocale = useDisplayLocale();
  const { target } = replacement;
  // 다른 확정이 먼저 끝낸 결정은 여기서 끝낼 것이 없다. 확정도 그 노드를 건너뛴다.
  const ended = target.endedAt !== null;
  return (
    <SuggestionShell
      label={t("replacement.label", { kind: tKind(target.kind) })}
      toggle={
        ended ? undefined : (
          <ChoiceToggle
            label={t("replacement.question")}
            changeLabel={t("replacement.replace")}
            keepLabel={t("replacement.keep")}
            value={choice}
            disabled={disabled}
            onChange={onChoose}
          />
        )
      }
      footer={
        <>
          {!ended && choice !== null ? (
            <div
              role="group"
              aria-label={
                choice === "change"
                  ? t("replacement.afterReplace")
                  : t("replacement.keepBoth")
              }
              className="mt-3 border-t border-[var(--el-hairline)] pt-3"
            >
              <div className="mb-2 flex items-center justify-between text-xs text-[var(--el-muted)]">
                <span>{t("replacement.afterConfirm")}</span>
                <span>
                  {t("replacement.decisionCount", {
                    count: choice === "change" ? 1 : 2,
                  })}
                </span>
              </div>
              <ul className="space-y-2 border-l-2 border-[var(--el-success)]/50 pl-3">
                {choice === "keep" ? (
                  <li className="rounded-[6px] border border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-3 py-2">
                    <span className="mb-0.5 block text-[11px] text-[var(--el-muted)]">
                      {t("replacement.earlier")}
                    </span>
                    <span className="block text-[13px] leading-5 text-[var(--el-ink)]">
                      {target.content}
                    </span>
                  </li>
                ) : null}
                <li className="rounded-[6px] border border-[var(--el-success)]/25 bg-[var(--el-surface-card)] px-3 py-2">
                  <span className="mb-0.5 block text-[11px] text-[var(--el-success-strong)]">
                    {t("replacement.new")}
                  </span>
                  <span className="block text-[13px] leading-5 text-[var(--el-ink)]">
                    {newContent}
                  </span>
                </li>
              </ul>
            </div>
          ) : null}
          {!ended && (context || replacement.reason) ? (
            <details className="mt-1.5 text-xs text-[var(--el-muted)]">
              <summary className="w-fit cursor-pointer">
                {t("showReason")}
              </summary>
              {context ?? <p className="mt-1.5">{replacement.reason}</p>}
            </details>
          ) : null}
        </>
      }
    >
      {ended || choice === "change" ? (
        <del className="text-[var(--el-muted-soft)] decoration-[var(--el-muted-soft)]">
          {target.content}
        </del>
      ) : (
        <span className="text-[var(--el-ink)]">{target.content}</span>
      )}
      <span className="text-xs text-[var(--el-muted)]">
        {t("replacement.approved", {
          source: target.noteTitle ?? t("replacement.projectDecision"),
          date: formatAppDate(
            target.approvedAt,
            { month: "long", day: "numeric" },
            dateLocale
          ),
        })}
        {ended ? ` · ${t("replacement.ended")}` : ""}
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
  showSource = true,
}: {
  relation: MeetingRelation;
  segments: readonly TranscriptResponseDataSegmentsItem[];
  onOpenScript: (segmentId: string) => void;
  fallbackReason?: string;
  showKind?: boolean;
  showSource?: boolean;
}) {
  const t = useTranslations("notes.review.suggestions.relation");
  const sequences = new Set(relation.evidenceSequences);
  const quotes = segments.filter((segment) => sequences.has(segment.sequence));
  return (
    <div className="mt-1.5 space-y-1 text-xs text-[var(--el-muted)]">
      {showSource ? (
        <p>
          {showKind ? `${t(`kinds.${relation.kind}`)} · ` : ""}
          {relation.scope === "same"
            ? t("sameMeeting")
            : relation.scope === "approved"
              ? t("approved")
              : (relation.targetTitle ?? t("earlierMeeting"))}
        </p>
      ) : null}
      {relation.reason || fallbackReason ? (
        <p className="whitespace-pre-wrap break-words">
          {relation.reason || fallbackReason}
        </p>
      ) : null}
      {quotes.length > 0 ? (
        <ul
          aria-label={t("quotes")}
          className="space-y-1 border-l border-[var(--el-hairline)] pl-3"
        >
          {quotes.map((segment) => (
            <li key={segment.segmentId}>
              <button
                type="button"
                className="text-left leading-5 hover:text-[var(--el-ink)]"
                onClick={() => onOpenScript(segment.segmentId)}
              >
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
  const t = useTranslations("notes.review.suggestions.relation");
  const pastNoteLink =
    relation.scope === "past" && workspaceId && relation.target.noteId;
  return (
    <SuggestionShell
      label={t(`kinds.${relation.kind}`)}
      footer={
        // 지난 회의 이름은 위 링크가 이미 말한다. 근거 줄에서 한 번 더 적지 않는다(APP-1587).
        <RelationContext
          relation={relation}
          showSource={!pastNoteLink}
          {...context}
        />
      }
    >
      {relation.targetItemId ? (
        <button
          type="button"
          aria-label={t("openTarget", { content: relation.target.content })}
          className="text-left underline underline-offset-4"
          onClick={() => onSelectItem(relation.targetItemId!)}
        >
          {relation.target.content}
        </button>
      ) : (
        <span className="break-words text-[var(--el-ink)]">
          {relation.target.content}
        </span>
      )}
      {pastNoteLink ? (
        <Link
          className="text-xs underline underline-offset-4"
          href={`/w/${workspaceId}/notes/${relation.target.noteId}?view=full&tab=summary`}
        >
          {relation.targetTitle ?? t("earlierMeeting")}
        </Link>
      ) : null}
    </SuggestionShell>
  );
}

type TaskDraft = NonNullable<
  NonNullable<UpdateMeetingReviewItemRequest["decisions"]>[number]["taskChange"]
>;

/** 회의 라벨은 이 회의 소유입니다. 응답의 nullable 참조를 요청 모양으로 돌립니다. */
function taskAssigneeRequestOf(
  box: NonNullable<TaskChange["draft"]>["assignee"]
): TaskDraft["assignee"] {
  if (!box) return null;
  const value = box.value;
  return {
    value: !value
      ? null
      : value.type === "SPEAKER_LABEL"
        ? { type: value.type, label: value.label ?? undefined }
        : { type: value.type, id: value.id ?? undefined },
  };
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
  const t = useTranslations("notes.review.suggestions");
  const tStatus = useTranslations("common.taskStatus");
  const dateLocale = useDisplayLocale();
  const saved = change.draft;
  const draft: TaskDraft = saved
    ? {
        ...saved,
        assignee: taskAssigneeRequestOf(saved.assignee),
      }
    : {
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
      : (choices.find(
          (row) =>
            row.type === reference.type &&
            "id" in row &&
            row.id === reference.id
        ) ??
        (change.assignee?.value?.type === reference.type &&
        change.assignee.value.id === reference.id
          ? change.assignee.value
          : {
              type: reference.type,
              id: reference.id ?? undefined,
              name: t("task.selectedMember"),
            }))
    : null;
  const applied =
    change.decision === "APPLIED" ||
    (confirmed && included && change.decision === "APPLY");
  const stale =
    taskState === "ready" &&
    !confirmed &&
    !applied &&
    task !== undefined &&
    task.revision !== draft.expectedRevision;
  const locked = disabled || applied || confirmed;
  const fieldsLocked = locked || !task || stale || taskState !== "ready";
  const saveDraft = (next: TaskDraft) => onChoose(choice ?? "change", next);

  return (
    <SuggestionShell
      label={t("task.label")}
      toggle={
        <ChoiceToggle
          label={t("task.toggle")}
          changeLabel={t(
            applied
              ? "task.applied"
              : choice === "change"
                ? confirmed
                  ? "task.excluded"
                  : "task.planned"
                : "task.apply"
          )}
          keepLabel={t("task.skip")}
          value={choice}
          disabled={locked || taskState === "pending"}
          changeDisabled={!task || stale || taskState !== "ready"}
          onChange={(next) => {
            if (next !== choice) void onChoose(next, draft);
          }}
        />
      }
      footer={
        <>
          {context ? (
            <details className="mt-1.5 text-xs text-[var(--el-muted)]">
              <summary className="w-fit cursor-pointer">
                {t("showReason")}
              </summary>
              {context}
            </details>
          ) : null}
          {stale ? (
            <p role="alert" className="mt-2 text-xs text-[var(--el-muted)]">
              {t("task.stale")}
            </p>
          ) : duplicate && !confirmed ? (
            <p role="alert" className="mt-2 text-xs text-[var(--el-muted)]">
              {t("task.duplicate")}
            </p>
          ) : null}
          {taskState === "failed" ? (
            <InlineRetry
              variant="line"
              label={t("task.loadFailed")}
              onRetry={onRetryTask}
              className="mt-2 text-xs text-[var(--el-muted)]"
            />
          ) : taskState === "ready" && !task ? (
            <p className="mt-2 text-xs text-[var(--el-muted)]">
              {t("task.notFound")}
            </p>
          ) : null}
        </>
      }
    >
      {taskState === "pending" ? (
        <Skeleton
          aria-label={t("task.loading")}
          className="h-4 w-40 rounded-chip"
        />
      ) : (
        <span className="text-[var(--el-ink)]">
          {task?.content ?? change.reason}
        </span>
      )}
      {task && draft.status ? (
        <Diff
          label={t("task.status")}
          from={tStatus(task.taskStatus)}
          to={<Pick>{tStatus(draft.status)}</Pick>}
        />
      ) : null}
      {task && draft.assignee ? (
        <Diff
          label={t("task.assignee")}
          from={
            task.assignee ? (
              <AssigneeFace
                value={task.assignee}
                image={assigneeImageOf(choices, task.assignee)}
              />
            ) : (
              t("task.none")
            )
          }
          to={
            <Pick editable={!fieldsLocked}>
              <AssigneeCell
                value={assignee ?? null}
                choices={choices}
                editable={!fieldsLocked}
                placeholder={t("task.none")}
                onChange={(next) =>
                  void saveDraft({
                    ...draft,
                    assignee: taskAssigneeRequestOf({ value: next }),
                  })
                }
              />
            </Pick>
          }
        />
      ) : null}
      {task && draft.due ? (
        <Diff
          label={t("task.due")}
          from={task.due ? formatDueDate(task.due, dateLocale) : t("task.none")}
          to={
            <Pick editable={!fieldsLocked}>
              <DueCell
                value={draft.due.value ?? null}
                editable={!fieldsLocked}
                placeholder={t("task.none")}
                onChange={(value) =>
                  void saveDraft({ ...draft, due: { value } })
                }
              />
            </Pick>
          }
        />
      ) : null}
      {task &&
      draft.assignee &&
      assigneeKey(assignee) === assigneeKey(task.assignee) &&
      !draft.status &&
      !draft.due ? (
        <span className="text-[var(--el-muted-soft)]">
          {t("task.noChange")}
        </span>
      ) : null}
    </SuggestionShell>
  );
}

function Pick({
  children,
  editable = false,
}: {
  children: ReactNode;
  editable?: boolean;
}) {
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
