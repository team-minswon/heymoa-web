"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { SegmentedControl } from "@/components/heymoa/segmented-control";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { TaskHistorySheet } from "@/components/tasks/task-history-sheet";
import { TASK_ROW_GRID, TASK_ROW_TRAIL, TaskRow } from "@/components/tasks/task-row";
import { useTaskUpdate } from "@/components/tasks/use-task-update";
import { Button } from "@/components/ui/button";
import { InlineRetry } from "@/components/ui/inline-retry";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { useGetWorkspaceTasks } from "@/lib/api/generated/projects/projects";
import { okData } from "@/lib/api/ok-data";
import { useAssigneeChoices } from "@/lib/assignees/use-assignee-choices";
import { getAppDateKey } from "@/lib/format/date";
import {
  filterTasks,
  groupTasks,
  tasksWithStatus,
  type TaskEntry,
  type TaskStatus,
} from "@/lib/tasks/task-groups";
import { cn } from "@/lib/utils";

const ALL_PROJECTS = "all";

const VIEWS: ReadonlyArray<{ value: TaskStatus; label: string; empty: string }> = [
  { value: "OPEN", label: "진행 중", empty: "할 일이 없습니다." },
  { value: "COMPLETED", label: "완료", empty: "완료한 할 일이 없습니다." },
  { value: "CANCELLED", label: "취소", empty: "취소한 할 일이 없습니다." },
];

/** 할 일 id → 상태. 직전 목록과 견줘 새로 생기거나 상태를 옮긴 줄만 등장을 그린다. */
type StatusSnapshot = Map<string, TaskStatus>;

/**
 * 프로젝트를 가로지르는 할 일.
 *
 * **팬아웃이 사라졌다** (APP-685). 전에는 프로젝트마다 요청을 보내고 결과를 합치면서
 * `useQueries` 결과 배열의 **인덱스로** 프로젝트를 대조해 이름을 붙였다 — 요청 하나가 실패해
 * 배열이 밀리면 남의 프로젝트 이름이 붙는다. 지금은 할 일이 자기 프로젝트를 들고 온다.
 */
export function AllTasks({ workspaceId }: { workspaceId: string }) {
  const { projects, isWorkspacePending } = useWorkspaceShell();
  const { user } = useAuth();
  const { choices, failed: choicesFailed, retry: retryChoices } = useAssigneeChoices(workspaceId);
  const result = useGetWorkspaceTasks(workspaceId);
  const today = getAppDateKey(new Date());

  const data = okData(result.data);
  const entries: TaskEntry[] = data?.tasks ?? [];
  // 읽어 둔 목록이 있어도 다시 읽기가 실패했으면 알린다 — 낡은 목록만 보이면 실패를 모른다.
  const failed =
    result.isError || (!data && !result.isPending) ? () => void result.refetch() : null;
  const isPending = isWorkspacePending || result.isPending;

  const [view, setView] = useState<TaskStatus>("OPEN");
  /** 사람이 보기를 바꿨는가. 첫 목록은 그대로 서고, 바꿀 때만 목록이 들어온다. */
  const [switched, setSwitched] = useState(false);
  const [mine, setMine] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  // 고른 프로젝트가 그사이 지워졌으면 전체로 돌아간다. 남겨 두면 없는 프로젝트로 할 일을 만들려다 거절된다.
  const activeProjectId =
    projectId !== null && projects.some((project) => project.projectId === projectId) ? projectId : null;
  const [adding, setAdding] = useState(false);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  /** 시트를 줄의 「수정」으로 열었나. 그러면 내용 고치기부터 선다 */
  const [historyEditing, setHistoryEditing] = useState(false);
  const { save, pendingOf, conflictTaskId } = useTaskUpdate(workspaceId);

  // 줄에 그리는 것이 바뀌면 목록도 새로 묶는다 — 판뿐 아니라 프로젝트 이름도 줄에 선다.
  const signature = entries.map((e) => `${e.taskId}:${e.revision}:${e.projectName}`).join("|");
  const filterKey = `${mine}:${activeProjectId}`;
  const visible = filterTasks(entries, {
    assigneeUserId: mine ? (user?.userId ?? null) : null,
    projectId: activeProjectId,
  });
  const countOf = (status: TaskStatus) =>
    visible.filter((task) => task.taskStatus === status).length;
  const groups = useMemo(
    () =>
      view === "OPEN"
        ? groupTasks(visible, today)
        : [{ key: view, label: "", entries: tasksWithStatus(visible, view) }],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 판 · 거르기 · 보기가 같으면 목록도 같다
    [signature, filterKey, view, today]
  ).filter((group) => group.entries.length > 0);

  // 첫 목록은 그대로 서고, 그 뒤로 달라진 줄만 들어온다.
  const [snapshot, setSnapshot] = useState<{ signature: string; statuses: StatusSnapshot } | null>(
    null
  );
  const [previous, setPrevious] = useState<StatusSnapshot | null>(null);
  if (!isPending && snapshot?.signature !== signature) {
    setPrevious(snapshot?.statuses ?? null);
    setSnapshot({
      signature,
      statuses: new Map(entries.map((e) => [e.taskId, e.taskStatus])),
    });
  }

  const historyEntry = entries.find((e) => e.taskId === historyTaskId) ?? null;
  const filtering = mine || activeProjectId !== null;

  const renderRows = (list: TaskEntry[]) => (
    <ul>
      {list.map((entry) => (
        <TaskRow
          key={entry.taskId}
          entry={entry}
          choices={choices}
          today={today}
          pending={pendingOf(entry.taskId) !== null}
          completing={![null, entry.taskStatus].includes(pendingOf(entry.taskId))}
          arrived={previous !== null && previous.get(entry.taskId) !== entry.taskStatus}
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
    </ul>
  );

  return (
    <>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="overflow-x-hidden!">
        <div className="mx-auto w-full max-w-4xl px-5 pb-16 pt-8 sm:px-8 sm:pt-11">
          <header className="border-b border-[var(--el-hairline)] pb-6">
            <h2 className="font-serif text-screen-title font-light leading-[1.05] tracking-[-0.035em] text-[var(--el-ink)]">
              할 일
            </h2>
            <p className="mt-3 min-h-6 text-sm leading-6 text-[var(--el-muted)]">
              {isPending ? null : `프로젝트 ${projects.length}개 · 진행 중 ${countOf("OPEN")}개`}
            </p>
          </header>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <SegmentedControl
              label="할 일 상태"
              value={view}
              options={VIEWS.map((option) => ({
                value: option.value,
                label: isPending ? option.label : `${option.label} ${countOf(option.value)}`,
              }))}
              onChange={(next) => {
                setView(next);
                setSwitched(true);
              }}
            />
            <button
              type="button"
              aria-pressed={mine}
              disabled={!user}
              onClick={() => setMine(!mine)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-[var(--el-ink)] motion-reduce:transition-none sm:h-[30px]",
                mine
                  ? "border-[var(--el-ink)] text-[var(--el-ink)]"
                  : "border-[var(--el-hairline-strong)] text-[var(--el-muted)] hover:text-[var(--el-ink)]"
              )}
            >
              {user ? <PersonAvatar name={user.userId} image={user.image} size={16} /> : null}
              내 할 일
            </button>
            <Select
              items={{
                [ALL_PROJECTS]: "프로젝트 전체",
                ...Object.fromEntries(projects.map((p) => [p.projectId, p.name])),
              }}
              value={activeProjectId ?? ALL_PROJECTS}
              onValueChange={(value) =>
                setProjectId(!value || value === ALL_PROJECTS ? null : (value as string))
              }
            >
              <SelectTrigger aria-label="프로젝트" className="h-9 text-xs sm:h-[30px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PROJECTS}>프로젝트 전체</SelectItem>
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
              할 일 추가
            </Button>
          </div>

          <div className="-mx-2 mt-3">
            {/* 좁은 화면에서는 칸이 둘째 줄로 내려가 머리글이 가리킬 칸이 없다. */}
            <div
              className={cn(
                TASK_ROW_GRID,
                "hidden h-8 text-xs font-medium text-[var(--el-muted)] sm:grid"
              )}
            >
              <span />
              <span>내용</span>
              <span>프로젝트</span>
              <span>담당</span>
              <span>기한</span>
            </div>

            {choicesFailed ? (
              <InlineRetry
                variant="line"
                label="담당으로 고를 사람 목록을 불러오지 못했습니다."
                onRetry={retryChoices}
                className="p-2"
              />
            ) : null}

            {failed ? (
              <InlineRetry
                variant="line"
                label="할 일을 불러오지 못했습니다."
                onRetry={failed}
                className="p-2"
              />
            ) : null}

            {isPending && groups.length === 0 ? (
              <ul aria-label="할 일 불러오는 중">
                {["62%", "48%", "71%", "55%", "66%", "40%"].map((width) => (
                  <li key={width} className={cn(TASK_ROW_GRID, "min-h-11")}>
                    <Skeleton className="size-[18px] rounded-full" />
                    <Skeleton className="h-4 rounded-chip" style={{ width }} />
                    <div className={TASK_ROW_TRAIL}>
                      <Skeleton className="h-4 w-16 rounded-chip" />
                      <Skeleton className="h-4 w-20 rounded-chip" />
                      <Skeleton className="h-4 w-16 rounded-chip" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div
                // 보기를 바꾸면 목록을 새로 세워 들어오게 한다. 첫 목록은 움직이지 않는다.
                key={view}
                className={cn(
                  switched && "animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none"
                )}
              >
                {groups.length === 0 && failed === null ? (
                  <p className="px-2 py-10 text-center text-sm text-[var(--el-muted)]">
                    {projects.length === 0
                      ? "프로젝트가 없습니다."
                      : filtering
                        ? "조건에 맞는 할 일이 없습니다."
                        : VIEWS.find((option) => option.value === view)!.empty}
                  </p>
                ) : view === "OPEN" ? (
                  groups.map((group) => (
                    <section key={group.key} aria-label={group.label} className="mt-4 first:mt-1">
                      <h3 className="flex h-8 items-center gap-1.5 px-2 text-xs font-medium text-[var(--el-muted)]">
                        {group.label}
                        <span
                          // 개수가 바뀌면 다시 들어오게 해 무엇이 옮겼는지 눈에 걸리게 한다.
                          key={previous ? group.entries.length : undefined}
                          className={cn(
                            "font-mono text-[11px] text-[var(--el-muted-soft)]",
                            previous &&
                              "animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none"
                          )}
                        >
                          {group.entries.length}
                        </span>
                      </h3>
                      {renderRows(group.entries)}
                    </section>
                  ))
                ) : (
                  <div className="mt-1">{renderRows(groups[0].entries)}</div>
                )}
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
        onSave={(patch) => (historyEntry ? save(historyEntry, patch) : Promise.resolve(false))}
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
