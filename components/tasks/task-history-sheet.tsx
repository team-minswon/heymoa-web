"use client";

import { assigneeKey } from "@/lib/assignees/describe";
import { Circle, CircleCheck, CircleSlash } from "lucide-react";
import { useState } from "react";

import { AssigneeCell, AssigneeFace } from "@/components/heymoa/assignee-cell";
import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { DueCell } from "@/components/heymoa/due-cell";
import { formatDueDate } from "@/lib/format/date";
import { ARRIVE_CLASS } from "@/components/heymoa/motion";
import type { TaskPatch } from "@/components/tasks/use-task-update";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import type { TaskEntry } from "@/lib/tasks/task-groups";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";
import { useTranslations } from "next-intl";

type Revision = ProjectTaskRevisionListResponseDataRevisionsItem;

type Field = "content" | "status" | "assignee" | "due";

function fieldsOf(revision: Revision, speakerName: (label: string) => string) {
  return {
    content: revision.content,
    status: revision.taskStatus,
    assignee: describeAssignee(revision.assignee, speakerName)?.name ?? null,
    due: revision.due ?? null,
  } satisfies Record<Field, string | null>;
}

export type RevisionChange = {
  field: Field;
  before?: string | null;
  after: string | null;
};

export function revisionChanges(
  previous: Revision | undefined,
  current: Revision,
  speakerName: (label: string) => string
): RevisionChange[] {
  const after = fieldsOf(current, speakerName);
  if (!previous) {
    return (["assignee", "due"] as const).map((field) => ({ field, after: after[field] }));
  }
  const before = fieldsOf(previous, speakerName);
  return (Object.keys(after) as Field[])
    .filter((field) => before[field] !== after[field])
    .map((field) => ({ field, before: before[field], after: after[field] }));
}

function subjectParticle(name: string) {
  const code = name.charCodeAt(name.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "이(가)";
  return code % 28 === 0 ? "가" : "이";
}

function useChangeText() {
  const tFields = useTranslations("common.fields");
  const tStatus = useTranslations("common.taskStatus");
  const tCell = useTranslations("common.assigneeCell");
  const t = useTranslations("tasks.sheet");
  const locale = useDisplayLocale();
  return {
    speakerName: (label: string) => tCell("speaker", { label }),
    label: (field: Field) => tFields(field),
    value: (field: Field, value: string | null) => {
      if (value === null) return t("none");
      if (field === "status") return tStatus(value as Revision["taskStatus"]);
      if (field === "due") return formatDueDate(value, locale);
      return value;
    },
  };
}

const STATUS_ICON = {
  OPEN: Circle,
  COMPLETED: CircleCheck,
  CANCELLED: CircleSlash,
} as const;

function Author({
  revision,
  personOf,
}: {
  revision: Revision;
  personOf: (
    userId: string
  ) => { name: string; image?: string | null } | undefined;
}) {
  const t = useTranslations("tasks.sheet.author");
  if (revision.approvalId) {
    return <>{t(revision.revision === 1 ? "meetingCreated" : "meetingChanged")}</>;
  }
  const person = revision.changedBy ? personOf(revision.changedBy) : undefined;
  const name = person?.name || t("unknown");
  const values = {
    name,
    particle: subjectParticle(name),
    verb: revision.revision === 1 ? "created" : "changed",
    connection: revision.connection?.name ?? "",
    b: (chunks: React.ReactNode) => <b className="font-semibold">{chunks}</b>,
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <PersonAvatar
        name={revision.changedBy ?? name}
        image={person?.image}
        size={18}
      />
      <span>
        {t.rich(
          revision.changeSource === "EXTERNAL_AGENT"
            ? revision.connection
              ? "agentNamed"
              : "agent"
            : revision.changeSource === "AGENT_CHAT"
              ? "chat"
              : "self",
          values
        )}
      </span>
    </span>
  );
}

function RevertAgentChange({
  latest,
  previous,
  pending,
  onSave,
}: {
  latest: Revision;
  previous: Revision;
  pending: boolean;
  onSave: (patch: TaskPatch) => Promise<boolean>;
}) {
  const t = useTranslations("tasks.revert");
  const tSheet = useTranslations("tasks.sheet");
  const text = useChangeText();
  const [open, setOpen] = useState(false);
  const changes = revisionChanges(latest, previous, text.speakerName);
  if (changes.length === 0) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 rounded-full px-3 text-xs"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        {t("button")}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
            {changes.map((change) => (
              <div key={change.field} className="contents">
                <dt className="text-[var(--el-muted)]">{text.label(change.field)}</dt>
                <dd className="min-w-0 text-[var(--el-body)]">
                  <span className="text-[var(--el-muted-soft)] line-through">
                    {text.value(change.field, change.before ?? null)}
                  </span>
                  <span aria-hidden className="px-1.5 text-[var(--el-muted-soft)]">
                    →
                  </span>
                  <span className="sr-only">{tSheet("changedTo")}</span>
                  <span className="font-semibold text-[var(--el-ink)]">
                    {text.value(change.field, change.after)}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t("keep")}</AlertDialogCancel>
            <AlertDialogAction
              loading={pending}
              disabled={pending}
              onClick={async () => {
                await onSave({
                  content: previous.content,
                  taskStatus: previous.taskStatus,
                  assignee: previous.assignee,
                  due: previous.due,
                });
                setOpen(false);
              }}
            >
              {t("button")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

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
  startEditing?: boolean;
  choices: AssigneeChoice[];
  pending: boolean;
  conflict: boolean;
  onSave: (patch: TaskPatch) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
}) {
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
  const t = useTranslations("tasks");
  const tFields = useTranslations("common.fields");
  const tStatus = useTranslations("common.taskStatus");
  const tActions = useTranslations("common.actions");
  const tError = useTranslations("errors");
  const text = useChangeText();
  const dateLocale = useDisplayLocale();
  const task = entry;
  const done = task.taskStatus !== "OPEN";
  const StatusIcon = STATUS_ICON[task.taskStatus];
  const draftOf = (from: TaskEntry) => ({
    content: from.content,
    assignee: (from.assignee ?? null) as TaskPatch["assignee"],
    due: from.due,
    base: {
      content: from.content,
      assignee: (from.assignee ?? null) as TaskPatch["assignee"],
      due: from.due,
    },
  });
  const [draft, setDraft] = useState<{
    content: string;
    assignee: TaskPatch["assignee"];
    due: string | null;
    base: {
      content: string;
      assignee: TaskPatch["assignee"];
      due: string | null;
    };
  } | null>(() => (startEditing && !done ? draftOf(task) : null));
  const query = useGetProjectTaskRevisions(
    workspaceId,
    entry.projectId,
    task.taskId
  );
  const revisions = okData(query.data)?.revisions ?? null;
  const personOf = (userId: string) => {
    for (const choice of choices) {
      if (choice.type === "USER" && choice.id === userId) return choice;
    }
    return undefined;
  };

  const finishEdit = async () => {
    if (!draft?.content.trim()) return;
    const content = draft.content.trim();
    const patch: TaskPatch = {};
    if (content !== draft.base.content) patch.content = content;
    if (assigneeKey(draft.assignee) !== assigneeKey(draft.base.assignee))
      patch.assignee = draft.assignee;
    if (draft.due !== draft.base.due) patch.due = draft.due;
    if (Object.keys(patch).length === 0) {
      setDraft(null);
      return;
    }
    const saved = await onSave(patch);
    if (saved) setDraft(null);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex h-14 items-center border-b border-[var(--el-hairline)] px-6 text-[13px] font-semibold text-[var(--el-ink)]">
        {t("title")}
      </div>
      <SheetHeader className="gap-3 border-b border-[var(--el-hairline)] px-6 pb-6 pt-5">
        <span className="inline-flex h-5 w-fit items-center gap-1 rounded-chip bg-[var(--el-surface-strong)] px-2 text-[11px] font-semibold text-[var(--el-ink)]">
          <StatusIcon aria-hidden className="size-3" />
          {tStatus(task.taskStatus)}
        </span>
        {draft ? (
          <Input
            aria-label={tFields("content")}
            autoFocus
            value={draft.content}
            onChange={(event) =>
              setDraft({ ...draft, content: event.target.value })
            }
          />
        ) : (
          <SheetTitle className="text-panel-title font-medium leading-[26px] text-[var(--el-ink)]">
            {task.content}
          </SheetTitle>
        )}
        <SheetDescription className="sr-only">
          {t("sheet.description")}
        </SheetDescription>
        <dl className="mt-2 grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 text-[13px]">
          <dt className="text-[var(--el-muted)]">{tFields("assignee")}</dt>
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
                placeholder={t("sheet.none")}
                image={assigneeImageOf(choices, task.assignee)}
              />
            )}
          </dd>
          <dt className="text-[var(--el-muted)]">{tFields("due")}</dt>
          <dd className="text-[var(--el-ink)]">
            {draft ? (
              <DueCell
                value={draft.due}
                editable
                onChange={(due) => setDraft({ ...draft, due })}
              />
            ) : (
              text.value("due", task.due)
            )}
          </dd>
          <dt className="text-[var(--el-muted)]">{tFields("project")}</dt>
          <dd className="truncate text-[var(--el-ink)]">{entry.projectName}</dd>
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {draft ? (
            <>
              <Button
                className="h-10 rounded-full sm:h-8"
                disabled={pending || !draft.content.trim()}
                onClick={finishEdit}
              >
                {tActions("save")}
              </Button>
              <Button
                variant="ghost"
                className="h-10 text-[var(--el-muted)] sm:h-8"
                onClick={() => setDraft(null)}
              >
                {t("sheet.discard")}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="h-10 rounded-full sm:h-8"
                disabled={pending || done}
                onClick={() => setDraft(draftOf(task))}
              >
                {tActions("edit")}
              </Button>
              <Button
                className="h-10 rounded-full sm:h-8"
                disabled={pending}
                onClick={() =>
                  onSave({ taskStatus: done ? "OPEN" : "COMPLETED" })
                }
              >
                {t(done ? "sheet.reopen" : "sheet.markDone")}
              </Button>
              {task.taskStatus === "OPEN" ? (
                <Button
                  variant="ghost"
                  className="h-10 text-[var(--el-muted)] sm:h-8"
                  disabled={pending}
                  onClick={() => onSave({ taskStatus: "CANCELLED" })}
                >
                  {t("sheet.cancelTask")}
                </Button>
              ) : null}
            </>
          )}
        </div>
        {conflict ? (
          <p
            role="alert"
            className={`text-xs text-[var(--el-error-strong)] ${ARRIVE_CLASS}`}
          >
            {tError("conflict")}
          </p>
        ) : null}
      </SheetHeader>

      <section aria-label={t("sheet.history")} className="px-6 py-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[13px] font-semibold text-[var(--el-ink)]">
            {t("sheet.history")}
          </h3>
          <span className="text-xs text-[var(--el-muted-soft)]">
            {t("sheet.newestFirst")}
          </span>
        </div>

        {query.isPending ? (
          <div aria-label={t("sheet.historyLoading")} className="mt-4 space-y-5">
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
            label={t("sheet.historyFailed")}
            onRetry={() => void query.refetch()}
            className="mt-4"
          />
        ) : (
          <ol className="mt-4 space-y-5 border-l border-[var(--el-hairline)] pl-4">
            {[...revisions].reverse().map((revision, index) => {
              const previous = revisions.find(
                (row) => row.revision === revision.revision - 1
              );
              return (
                <li
                  key={revision.revision}
                  className={`relative ${ARRIVE_CLASS}`}
                >
                  <span
                    aria-hidden
                    className={`absolute -left-[21px] top-1.5 size-2 rounded-full border ${
                      index === 0
                        ? "border-[var(--el-ink)] bg-[var(--el-ink)]"
                        : "border-[var(--el-hairline-strong)] bg-[var(--el-surface-card)]"
                    }`}
                  />
                  <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-[var(--el-ink)]">
                    <Author revision={revision} personOf={personOf} />
                    <span className="text-xs text-[var(--el-muted-soft)]">
                      {formatAppDate(revision.changedAt, {
                        month: "long",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }, dateLocale)}
                    </span>
                    {index === 0 &&
                    revision.changeSource === "EXTERNAL_AGENT" &&
                    previous ? (
                      <RevertAgentChange
                        latest={revision}
                        previous={previous}
                        pending={pending}
                        onSave={onSave}
                      />
                    ) : null}
                  </p>
                  <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
                    {revisionChanges(previous, revision, text.speakerName).map((change) => (
                      <div key={change.field} className="contents">
                        <dt className="text-[var(--el-muted)]">
                          {text.label(change.field)}
                        </dt>
                        <dd className="min-w-0 text-[var(--el-body)]">
                          {change.before !== undefined ? (
                            <>
                              <span className="text-[var(--el-muted-soft)] line-through">
                                {text.value(change.field, change.before)}
                              </span>
                              <span
                                aria-hidden
                                className="px-1.5 text-[var(--el-muted-soft)]"
                              >
                                →
                              </span>
                              <span className="sr-only">{t("sheet.changedTo")}</span>
                            </>
                          ) : null}
                          <span
                            className={
                              change.before !== undefined
                                ? "font-semibold text-[var(--el-ink)]"
                                : "text-[var(--el-ink)]"
                            }
                          >
                            {text.value(change.field, change.after)}
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
