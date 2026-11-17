"use client";

import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { SegmentedControl } from "@/components/heymoa/segmented-control";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { TaskHistorySheet } from "@/components/tasks/task-history-sheet";
import { TASK_DUE_ALIGN, TASK_ROW_TRAIL, TaskRow, taskRowGrid } from "@/components/tasks/task-row";
import { useTaskUpdate } from "@/components/tasks/use-task-update";
import { assigneeKey } from "@/lib/assignees/describe";
import { Button } from "@/components/ui/button";
import { InlineRetry } from "@/components/ui/inline-retry";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { useAssigneeChoices } from "@/lib/assignees/use-assignee-choices";
import { getAppDateKey } from "@/lib/format/date";
import {
  groupTasks,
  tasksWithStatus,
  type TaskEntry,
  type TaskGroupKey,
  type TaskStatus,
} from "@/lib/tasks/task-groups";
import { taskListQuery, useTaskListPages } from "@/lib/tasks/use-task-list-pages";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";

const ALL_PROJECTS = "all";

const VIEWS: readonly TaskStatus[] = ["OPEN", "COMPLETED", "CANCELLED"];

const COUNT_KEY = { OPEN: "open", COMPLETED: "completed", CANCELLED: "cancelled" } as const;

type StatusSnapshot = Map<string, TaskStatus>;

export function AllTasks({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("tasks");
  const tFields = useTranslations("common.fields");
  const tStatus = useTranslations("common.taskStatus");
  const { projects, isWorkspacePending } = useWorkspaceShell();
  const { user } = useAuth();
  const { choices, failed: choicesFailed, retry: retryChoices } = useAssigneeChoices(workspaceId);
  const today = getAppDateKey(new Date());

  const [view, setView] = useState<TaskStatus>("OPEN");
  const [switched, setSwitched] = useState(false);
  const [mine, setMine] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [pages, setPages] = useState(1);
  const activeProjectId =
    projectId !== null && projects.some((project) => project.projectId === projectId) ? projectId : null;
  const [adding, setAdding] = useState(false);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [historyEditing, setHistoryEditing] = useState(false);
  const [savedRow, setSavedRow] = useState<TaskEntry | null>(null);
  const { save, pendingOf, conflictTaskId } = useTaskUpdate(workspaceId, setSavedRow);

  const filter = {
    workspaceId,
    assigneeUserId: mine ? (user?.userId ?? undefined) : undefined,
    projectId: activeProjectId ?? undefined,
  };
  const result = useTaskListPages({ ...filter, status: view, pages });
  const queryClient = useQueryClient();
  const prefetchViews = () => {
    for (const status of VIEWS) {
      if (status !== view) {
        void queryClient.prefetchQuery(taskListQuery({ ...filter, status, pages: 1 }));
      }
    }
  };
  const response = result.data;
  const data = response?.status === 200 && response.data.success ? response.data.data : null;
  const entries: TaskEntry[] = (data?.tasks ?? []).filter((task) => task.taskStatus === view);
  const counts = data?.counts;
  const countOf = (status: TaskStatus) => counts?.[COUNT_KEY[status]] ?? 0;
  const failed =
    result.isError || (!data && !result.isPending) ? () => void result.refetch() : null;
  const isPending = isWorkspacePending || result.isPending;
  const loadingRows = isPending || (result.isPlaceholderData && entries.length === 0);
  const resetPages = () => {
    setPages(1);
    setSwitched(true);
  };

  const signature = entries
    .map(
      (e) =>
        `${e.taskId}:${e.revision}:${e.projectName}:${e.taskStatus}:${e.due ?? ""}:${assigneeKey(e.assignee)}:${e.content}`
    )
    .join("|");
  const scopeKey = `${view}:${mine}:${activeProjectId}`;
  const groups = useMemo(
    () =>
      view === "OPEN"
        ? groupTasks(entries, today)
        : [{ key: view, entries: tasksWithStatus(entries, view) }],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 판 · 거르기 · 보기가 같으면 목록도 같다
    [signature, scopeKey, view, today]
  ).filter((group) => group.entries.length > 0);

  const [snapshot, setSnapshot] = useState<{
    signature: string;
    scopeKey: string;
    statuses: StatusSnapshot;
  } | null>(null);
  const [previous, setPrevious] = useState<StatusSnapshot | null>(null);
  if (
    !loadingRows &&
    !result.isPlaceholderData &&
    (snapshot?.signature !== signature || snapshot.scopeKey !== scopeKey)
  ) {
    setPrevious(snapshot && snapshot.scopeKey === scopeKey ? snapshot.statuses : null);
    setSnapshot({
      signature,
      scopeKey,
      statuses: new Map(entries.map((e) => [e.taskId, e.taskStatus])),
    });
  }
  const stale = result.isPlaceholderData && !loadingRows && snapshot?.scopeKey !== scopeKey;
  const isLoadingMore = result.isFetching && result.isPlaceholderData && entries.length > 0 && !stale;
  const hasMore = !loadingRows && !stale && data?.hasMore === true;

  const historyEntry =
    entries.find((e) => e.taskId === historyTaskId) ??
    (savedRow?.taskId === historyTaskId ? savedRow : null);
  const filtering = mine || activeProjectId !== null;
  const showProject = activeProjectId === null && projects.length > 1;
  const grid = taskRowGrid(showProject);

  const reduceMotion = useReducedMotion() ?? false;

  const renderRows = (list: TaskEntry[]) => (
    <ul>
      <AnimatePresence initial={false}>
        {list.map((entry) => (
          <TaskRow
            key={entry.taskId}
            entry={entry}
            showProject={showProject}
            choices={choices}
            today={today}
            pending={pendingOf(entry.taskId) !== null}
            completing={![null, entry.taskStatus].includes(pendingOf(entry.taskId))}
            arrived={previous !== null && previous.get(entry.taskId) !== entry.taskStatus}
            reduceMotion={reduceMotion}
            conflict={conflictTaskId === entry.taskId}
            onToggleDone={() =>
              save(entry, { taskStatus: entry.taskStatus === "OPEN" ? "COMPLETED" : "OPEN" })
            }
            onAssign={(assignee) => save(entry, { assignee })}
            onDue={(due) => save(entry, { due })}
            onOpenHistory={() => {
              setHistoryEditing(false);
              setHistoryTaskId(entry.taskId);
            }}
            onEdit={() => {
              setHistoryEditing(true);
              setHistoryTaskId(entry.taskId);
            }}
          />
        ))}
      </AnimatePresence>
    </ul>
  );

  return (
    <>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="overflow-x-hidden!">
        <div className="mx-auto w-full max-w-4xl px-5 pb-16 pt-8 sm:px-8 sm:pt-11">
          <header className="border-b border-[var(--el-hairline)] pb-6">
            <h2 className="text-screen-title font-light leading-[1.05] tracking-[-0.035em] text-[var(--el-ink)]">
              {t("title")}
            </h2>
            <p
              className={cn(
                "mt-3 min-h-6 text-sm leading-6 text-[var(--el-muted)] transition-opacity duration-150 ease-out motion-reduce:transition-none",
                stale && "opacity-60"
              )}
            >
              {isPending || !counts ? null : t("summary", { projects: projects.length, open: countOf("OPEN") })}
            </p>
          </header>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <div
              onPointerEnter={prefetchViews}
              onFocus={prefetchViews}
              className={cn(
                "inline-flex transition-opacity duration-150 ease-out motion-reduce:transition-none",
                stale && "opacity-60"
              )}
            >
              <SegmentedControl
                label={t("statusLabel")}
                value={view}
                options={VIEWS.map((status) => ({
                  value: status,
                  label: !counts ? tStatus(status) : `${tStatus(status)} ${countOf(status)}`,
                }))}
                onChange={(next) => {
                  setView(next);
                  resetPages();
                }}
              />
            </div>
            <button
              type="button"
              aria-pressed={mine}
              disabled={!user}
              onClick={() => {
                setMine(!mine);
                resetPages();
              }}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-[var(--el-ink)] motion-reduce:transition-none sm:h-[30px]",
                mine
                  ? "border-[var(--el-ink)] text-[var(--el-ink)]"
                  : "border-[var(--el-hairline-strong)] text-[var(--el-muted)] hover:text-[var(--el-ink)]"
              )}
            >
              {user ? <PersonAvatar name={user.userId} image={user.image} size={16} /> : null}
              {t("mine")}
            </button>
            <Select
              items={{
                [ALL_PROJECTS]: t("allProjects"),
                ...Object.fromEntries(projects.map((p) => [p.projectId, p.name])),
              }}
              value={activeProjectId ?? ALL_PROJECTS}
              onValueChange={(value) => {
                setProjectId(!value || value === ALL_PROJECTS ? null : (value as string));
                resetPages();
              }}
            >
              <SelectTrigger aria-label={tFields("project")} className="h-9 text-xs sm:h-[30px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PROJECTS}>{t("allProjects")}</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.projectId} value={project.projectId}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="ml-auto h-9 rounded-full sm:h-[30px]"
              disabled={projects.length === 0}
              onClick={() => setAdding(true)}
            >
              <Plus aria-hidden className="size-3.5" />
              {t("add")}
            </Button>
          </div>

          <div className="-mx-2 mt-3">
            <div
              className={cn(
                grid,
                "mx-2 hidden h-8 border-b border-[var(--el-hairline)] px-0 text-xs text-[var(--el-muted)] sm:grid"
              )}
            >
              <span />
              <span>{tFields("content")}</span>
              {showProject ? <span>{tFields("project")}</span> : null}
              <span>{tFields("assignee")}</span>
              <span className={TASK_DUE_ALIGN}>{tFields("due")}</span>
            </div>

            {choicesFailed ? (
              <InlineRetry
                variant="line"
                label={t("choicesFailed")}
                onRetry={retryChoices}
                className="p-2"
              />
            ) : null}

            {failed ? (
              <InlineRetry
                variant="line"
                label={t("loadFailed")}
                onRetry={failed}
                className="p-2"
              />
            ) : null}

            {loadingRows ? (
              <div aria-label={t("loading")} className={view === "OPEN" ? "mt-3" : "mt-1"}>
                {view === "OPEN" ? (
                  <div className="flex h-8 items-center px-2">
                    <Skeleton className="h-3.5 w-14 rounded-chip" />
                  </div>
                ) : null}
                <ul>
                  {["62%", "48%", "71%", "55%", "66%", "40%"].map((width) => (
                    <li key={width} className={cn(grid, "min-h-11")}>
                      <Skeleton className="size-[18px] rounded-full" />
                      <Skeleton className="h-4 rounded-chip" style={{ width }} />
                      <div className={TASK_ROW_TRAIL}>
                        {showProject ? <Skeleton className="h-4 w-16 rounded-chip" /> : null}
                        <Skeleton className="h-4 w-20 rounded-chip" />
                        <Skeleton className={cn("h-4 w-16 rounded-chip", TASK_DUE_ALIGN)} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div
                key={snapshot?.scopeKey ?? scopeKey}
                aria-busy={stale || undefined}
                inert={stale}
                className={cn(
                  "transition-opacity duration-150 ease-out motion-reduce:transition-none",
                  switched && "animate-in fade-in-60 duration-150 ease-out motion-reduce:animate-none",
                  stale && "opacity-60"
                )}
              >
                {groups.length === 0 && failed === null ? (
                  <p className="px-2 py-10 text-center text-sm text-[var(--el-muted)]">
                    {projects.length === 0
                      ? t("noProjects")
                      : filtering
                        ? t("noMatch")
                        : t(`empty.${view}`)}
                  </p>
                ) : view === "OPEN" ? (
                  groups.map((group) => {
                    const name = t(`groups.${group.key as TaskGroupKey}`);
                    return (
                      <section key={group.key} aria-label={name} className="mt-6 first:mt-3">
                        <h3
                          className={cn(
                            "flex h-8 items-center gap-2 px-2 text-[13px] font-medium",
                            group.key === "OVERDUE" ? "text-[var(--el-error-strong)]" : "text-[var(--el-ink)]"
                          )}
                        >
                          {name}
                          <span
                            key={previous ? group.entries.length : undefined}
                            className={cn(
                              "text-xs font-normal tabular-nums text-[var(--el-muted-soft)]",
                              previous &&
                                "animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none"
                            )}
                          >
                            {group.entries.length}
                            {hasMore && group === groups.at(-1) ? "+" : ""}
                          </span>
                        </h3>
                        {renderRows(group.entries)}
                      </section>
                    );
                  })
                ) : (
                  <div className="mt-1">{renderRows(groups[0].entries)}</div>
                )}
                {hasMore ? (
                  <div className="mt-4 flex justify-center">
                    <LoadMoreButton
                      loading={isLoadingMore}
                      loadingLabel={t("loadingMore")}
                      onClick={() => setPages((current) => current + 1)}
                    >
                      {t("loadMore")}
                    </LoadMoreButton>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <TaskHistorySheet
        workspaceId={workspaceId}
        entry={historyEntry}
        startEditing={historyEditing}
        choices={choices}
        pending={historyEntry !== null && pendingOf(historyEntry.taskId) !== null}
        conflict={historyEntry !== null && conflictTaskId === historyEntry.taskId}
        onSave={async (patch) => {
          if (!historyEntry) return false;
          const ok = await save(historyEntry, patch);
          if (!ok && !entries.some((e) => e.taskId === historyEntry.taskId)) {
            setHistoryTaskId(null);
            toast.error(t("sheetClosed"));
          }
          return ok;
        }}
        onOpenChange={(open) => !open && setHistoryTaskId(null)}
      />
      <NewTaskDialog
        workspaceId={workspaceId}
        open={adding}
        onOpenChange={setAdding}
        projects={projects}
        defaultProjectId={activeProjectId ?? projects[0]?.projectId ?? null}
        choices={choices}
      />
    </>
  );
}
