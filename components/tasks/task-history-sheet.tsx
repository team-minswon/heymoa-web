"use client";

import { Circle, CircleCheck, CircleSlash } from "lucide-react";
import { useState } from "react";

import { AssigneeCell, AssigneeFace } from "@/components/heymoa/assignee-cell";
import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { DueCell } from "@/components/heymoa/due-cell";
import { formatDueDate } from "@/lib/format/date";
import { ARRIVE_CLASS } from "@/components/heymoa/motion";
import type { TaskPatch } from "@/components/tasks/use-task-update";
import { CONFLICT_MESSAGE } from "@/lib/api/error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectTaskRevisionListResponseDataRevisionsItem } from "@/lib/api/generated/models";
import { okData } from "@/lib/api/ok-data";
import { useGetProjectTaskRevisions } from "@/lib/api/generated/projects/projects";
import {
  assigneeImageOf,
  describeAssignee,
  type AssigneeChoice,
} from "@/lib/assignees/describe";
import { formatAppDate } from "@/lib/format/date";
import { TASK_STATUS_LABEL, type TaskEntry } from "@/lib/tasks/task-groups";

type Revision = ProjectTaskRevisionListResponseDataRevisionsItem;

function fieldsOf(revision: Revision) {
  return {
    내용: revision.content,
    상태: TASK_STATUS_LABEL[revision.taskStatus],
    담당: describeAssignee(revision.assignee)?.name ?? "없음",
    기한: revision.due ? formatDueDate(revision.due) : "없음",
  };
}

/** 앞 판과 달라진 칸. 첫 판은 무엇으로 시작했는지 담당·기한만 보인다. */
export function revisionChanges(previous: Revision | undefined, current: Revision) {
  const after = fieldsOf(current);
  if (!previous) {
    return (["담당", "기한"] as const).map((label) => ({
      label,
      before: null,
      after: after[label],
    }));
  }
  const before = fieldsOf(previous);
  return (Object.keys(after) as Array<keyof typeof after>)
    .filter((label) => before[label] !== after[label])
    .map((label) => ({ label, before: before[label], after: after[label] }));
}

/** 이름 뒤 주격 조사. 받침이 있으면 「이」, 없으면 「가」. */
function subject(name: string) {
  const code = name.charCodeAt(name.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${name}이(가)`;
  return `${name}${code % 28 === 0 ? "가" : "이"}`;
}

const STATUS_ICON = { OPEN: Circle, COMPLETED: CircleCheck, CANCELLED: CircleSlash } as const;

/** 누가 바꿨나. 사람은 얼굴과 굵은 이름으로, 회의 확정은 문장으로만 선다. */
function Author({ revision, nameOf }: { revision: Revision; nameOf: (userId: string) => string | undefined }) {
  if (revision.approvalId) {
    return <>{revision.revision === 1 ? "회의 확정으로 생겼습니다" : "회의 확정으로 바뀌었습니다"}</>;
  }
  const name = (revision.changedBy && nameOf(revision.changedBy)) || "알 수 없는 사람";
  return (
    <span className="inline-flex items-center gap-1.5">
      <PersonAvatar name={revision.changedBy ?? name} size={18} />
      <span>
        <b className="font-semibold">{name}</b>
        {subject(name).slice(name.length)} {revision.revision === 1 ? "만들었습니다" : "바꿨습니다"}
      </span>
    </span>
  );
}

/**
 * 할 일 한 줄의 담당 · 기한과 이력. 어느 회의에서 생겼는지는 조회가 알려 주지 않아
 * 「회의 확정」까지만 말한다. 고치기와 끝내기는 목록 칸과 같은 저장 길을 쓴다.
 */
export function TaskHistorySheet({
  workspaceId,
  entry,
  startEditing = false,
  choices,
  pending,
  conflict,
  onSave,
  onOpenChange,
}: {
  workspaceId: string;
  entry: TaskEntry | null;
  /** 열자마자 내용 고치기부터 세운다(목록 줄의 「수정」) */
  startEditing?: boolean;
  /** 담당 칸의 선택지이자, 바꾼 사람의 이름을 푸는 멤버 목록이다 */
  choices: AssigneeChoice[];
  pending: boolean;
  conflict: boolean;
  /** 저장이 받아들여졌는지를 돌려준다 */
  onSave: (patch: TaskPatch) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
}) {
  // 닫히는 동안에도 내용이 남아 있어야 빈 시트가 미끄러져 나가지 않는다.
  const [shown, setShown] = useState(entry);
  if (entry && entry !== shown) setShown(entry);

  return (
    <Sheet open={entry !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-[480px]">
        {shown ? (
          <HistoryBody
            key={`${shown.taskId}:${startEditing}`}
            workspaceId={workspaceId}
            entry={shown}
            startEditing={startEditing}
            choices={choices}
            pending={pending}
            conflict={conflict}
            onSave={onSave}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function HistoryBody({
  workspaceId,
  entry,
  startEditing,
  choices,
  pending,
  conflict,
  onSave,
}: {
  workspaceId: string;
  entry: TaskEntry;
  startEditing: boolean;
  choices: AssigneeChoice[];
  pending: boolean;
  conflict: boolean;
  onSave: (patch: TaskPatch) => Promise<boolean>;
}) {
  const task = entry;
  const done = task.taskStatus !== "OPEN";
  const StatusIcon = STATUS_ICON[task.taskStatus];
  const [draft, setDraft] = useState<{
    content: string;
    assignee: TaskPatch["assignee"];
    due: string | null;
  } | null>(() =>
    startEditing && !done ? { content: task.content, assignee: task.assignee ?? null, due: task.due } : null
  );
  const query = useGetProjectTaskRevisions(workspaceId, entry.projectId, task.taskId);
  const revisions = okData(query.data)?.revisions ?? null;
  const nameOf = (userId: string) => {
    for (const choice of choices) {
      if (choice.type === "USER" && choice.id === userId) return choice.name;
    }
    return undefined;
  };

  // 저장이 끝나 받아들여졌을 때만 편집을 닫는다. 실패하면 고친 내용이 그대로 남아야 다시 보낼 수 있다.
  const finishEdit = async () => {
    if (!draft?.content.trim()) return;
    const saved = await onSave({ content: draft.content.trim(), assignee: draft.assignee, due: draft.due });
    if (saved) setDraft(null);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex h-14 items-center border-b border-[var(--el-hairline)] px-6 text-[13px] font-semibold text-[var(--el-ink)]">
        할 일
      </div>
      <SheetHeader className="gap-3 border-b border-[var(--el-hairline)] px-6 pb-6 pt-5">
        <span className="inline-flex h-5 w-fit items-center gap-1 rounded-chip bg-[var(--el-surface-strong)] px-2 text-[11px] font-semibold text-[var(--el-ink)]">
          <StatusIcon aria-hidden className="size-3" />
          {TASK_STATUS_LABEL[task.taskStatus]}
        </span>
        {draft ? (
          <Input
            aria-label="내용"
            autoFocus
            value={draft.content}
            onChange={(event) => setDraft({ ...draft, content: event.target.value })}
          />
        ) : (
          <SheetTitle className="text-panel-title font-medium leading-[26px] text-[var(--el-ink)] [word-break:keep-all]">
            {task.content}
          </SheetTitle>
        )}
        <SheetDescription className="sr-only">할 일의 담당 · 기한과 바뀐 이력</SheetDescription>
        <dl className="mt-2 grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 text-[13px]">
          <dt className="text-[var(--el-muted)]">담당</dt>
          <dd>
            {draft ? (
              <AssigneeCell
                value={draft.assignee ?? null}
                choices={choices}
                editable
                onChange={(assignee) => setDraft({ ...draft, assignee })}
              />
            ) : (
              <AssigneeFace
                value={task.assignee}
                placeholder="없음"
                image={assigneeImageOf(choices, task.assignee)}
              />
            )}
          </dd>
          <dt className="text-[var(--el-muted)]">기한</dt>
          <dd className="text-[var(--el-ink)]">
            {draft ? (
              <DueCell value={draft.due} editable onChange={(due) => setDraft({ ...draft, due })} />
            ) : task.due ? (
              formatDueDate(task.due)
            ) : (
              "없음"
            )}
          </dd>
          <dt className="text-[var(--el-muted)]">프로젝트</dt>
          <dd className="truncate text-[var(--el-ink)]">{entry.projectName}</dd>
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {draft ? (
            <>
              <Button className="h-10 rounded-full sm:h-8" disabled={pending || !draft.content.trim()} onClick={finishEdit}>
                저장
              </Button>
              <Button variant="ghost" className="h-10 text-[var(--el-muted)] sm:h-8" onClick={() => setDraft(null)}>
                그대로 두기
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="h-10 rounded-full sm:h-8"
                disabled={pending || done}
                onClick={() =>
                  setDraft({ content: task.content, assignee: task.assignee ?? null, due: task.due })
                }
              >
                수정
              </Button>
              <Button
                className="h-10 rounded-full sm:h-8"
                disabled={pending}
                onClick={() => onSave({ taskStatus: done ? "OPEN" : "COMPLETED" })}
              >
                {done ? "다시 열기" : "완료로 표시"}
              </Button>
              {task.taskStatus === "OPEN" ? (
                <Button
                  variant="ghost"
                  className="h-10 text-[var(--el-muted)] sm:h-8"
                  disabled={pending}
                  onClick={() => onSave({ taskStatus: "CANCELLED" })}
                >
                  취소
                </Button>
              ) : null}
            </>
          )}
        </div>
        {conflict ? (
          <p role="alert" className={`text-xs text-[var(--el-error-strong)] ${ARRIVE_CLASS}`}>
            {CONFLICT_MESSAGE}
          </p>
        ) : null}
      </SheetHeader>

      <section aria-label="이력" className="px-6 py-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[13px] font-semibold text-[var(--el-ink)]">이력</h3>
          <span className="text-xs text-[var(--el-muted-soft)]">최근 것부터</span>
        </div>

        {query.isPending ? (
          <div aria-label="이력 불러오는 중" className="mt-4 space-y-5">
            {["70%", "55%", "62%"].map((width) => (
              <div key={width} className="space-y-2">
                <Skeleton className="h-4 rounded-chip" style={{ width }} />
                <Skeleton className="h-4 w-1/3 rounded-chip" />
              </div>
            ))}
          </div>
        ) : !revisions ? (
          <InlineRetry
            variant="line"
            label="이력을 불러오지 못했습니다."
            onRetry={() => void query.refetch()}
            className="mt-4"
          />
        ) : (
          <ol className="mt-4 space-y-5 border-l border-[var(--el-hairline)] pl-4">
            {[...revisions].reverse().map((revision, index) => {
              const previous = revisions.find((row) => row.revision === revision.revision - 1);
              return (
                <li key={revision.revision} className={`relative ${ARRIVE_CLASS}`}>
                  {/* 지금 값을 만든 가장 최근 판만 점을 칠한다 */}
                  <span
                    aria-hidden
                    className={`absolute -left-[21px] top-1.5 size-2 rounded-full border ${
                      index === 0
                        ? "border-[var(--el-ink)] bg-[var(--el-ink)]"
                        : "border-[var(--el-hairline-strong)] bg-[var(--el-surface-card)]"
                    }`}
                  />
                  <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-[var(--el-ink)]">
                    <Author revision={revision} nameOf={nameOf} />
                    <span className="text-xs text-[var(--el-muted-soft)]">
                      {formatAppDate(revision.changedAt, {
                        month: "long",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                  <dl className="mt-1.5 grid grid-cols-[32px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[13px]">
                    {revisionChanges(previous, revision).map((change) => (
                      <div key={change.label} className="contents">
                        <dt className="text-[var(--el-muted)]">{change.label}</dt>
                        <dd className="min-w-0 text-[var(--el-body)]">
                          {change.before !== null ? (
                            <>
                              <span className="text-[var(--el-muted-soft)] line-through">
                                {change.before}
                              </span>
                              <span aria-hidden className="px-1.5 text-[var(--el-muted-soft)]">
                                →
                              </span>
                              <span className="sr-only">에서 </span>
                            </>
                          ) : null}
                          <span className={change.before !== null ? "font-semibold text-[var(--el-ink)]" : "text-[var(--el-ink)]"}>
                            {change.after}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
