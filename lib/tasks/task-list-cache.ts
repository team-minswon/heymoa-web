import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { Assignee } from "@/lib/api/generated/models";
import {
  getGetProjectTasksQueryKey,
  getGetWorkspaceTasksQueryKey,
} from "@/lib/api/generated/projects/projects";
import type { AssigneeChoice, AssigneeValue } from "@/lib/assignees/describe";
import { compareTasks, type TaskEntry, type TaskStatus } from "@/lib/tasks/task-groups";

export const taskListKeys = (workspaceId: string, projectId: string) =>
  [
    getGetProjectTasksQueryKey(workspaceId, projectId),
    getGetWorkspaceTasksQueryKey(workspaceId),
  ] as const;

type TaskListData = { tasks: TaskEntry[] };
type CachedList = {
  status?: number;
  data?: { success?: boolean; data?: TaskListData };
};

function mapListRows(
  cached: unknown,
  fn: (row: TaskEntry) => TaskEntry
): unknown {
  const list = cached as CachedList | undefined;
  if (list?.status !== 200 || !list.data?.success || !list.data.data)
    return cached;
  return {
    ...list,
    data: {
      ...list.data,
      data: { ...list.data.data, tasks: list.data.data.tasks.map(fn) },
    },
  };
}

export function assigneeRowOf(
  choice: AssigneeValue | AssigneeChoice | null
): Assignee | null {
  if (!choice) return null;
  return choice.type === "SPEAKER_LABEL"
    ? { type: choice.type, noteId: choice.noteId, label: choice.label }
    : { type: choice.type, id: choice.id, name: choice.name };
}

export function patchTaskLists(
  queryClient: QueryClient,
  keys: readonly QueryKey[],
  taskId: string,
  fn: (row: TaskEntry) => TaskEntry
): Array<[QueryKey, unknown]> {
  const snapshot = keys.flatMap((key) =>
    queryClient.getQueriesData({ queryKey: key })
  );
  for (const key of keys) {
    queryClient.setQueriesData({ queryKey: key }, (cached: unknown) =>
      mapListRows(cached, (row) => (row.taskId === taskId ? fn(row) : row))
    );
  }
  return snapshot;
}

type ListScope = {
  status?: TaskStatus;
  assigneeUserId?: string;
  projectId?: string;
};

type Counts = { open: number; completed: number; cancelled: number };
type WorkspaceListData = TaskListData & {
  counts?: Counts;
  totalCount?: number;
  hasMore?: boolean;
};
type CachedWorkspaceList = {
  status?: number;
  data?: { success?: boolean; data?: WorkspaceListData };
};

const COUNT_KEY: Record<TaskStatus, keyof Counts> = {
  OPEN: "open",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

function scopeOf(queryKey: QueryKey): ListScope {
  const scope = queryKey[1];
  return scope && typeof scope === "object" ? (scope as ListScope) : {};
}

function inScope(row: TaskEntry, scope: ListScope) {
  return (
    (!scope.projectId || row.projectId === scope.projectId) &&
    (!scope.assigneeUserId ||
      (row.assignee?.type === "USER" && row.assignee.id === scope.assigneeUserId))
  );
}

function insertSorted(
  tasks: TaskEntry[],
  row: TaskEntry,
  hasMore: boolean,
  wasLast: boolean
) {
  const at = tasks.findIndex((task) => compareTasks(row, task) < 0);
  if (at < 0) return hasMore && !wasLast ? tasks : [...tasks, row];
  return [...tasks.slice(0, at), row, ...tasks.slice(at)];
}

function moveTaskAcrossLists(
  queryClient: QueryClient,
  workspaceId: string,
  before: TaskEntry | null,
  after: TaskEntry
) {
  const queries = queryClient
    .getQueryCache()
    .findAll({ queryKey: getGetWorkspaceTasksQueryKey(workspaceId) });
  for (const query of queries) {
    const scope = scopeOf(query.queryKey);
    queryClient.setQueryData(query.queryKey, (cached: unknown) => {
      const list = cached as CachedWorkspaceList | undefined;
      const data = list?.data?.data;
      if (list?.status !== 200 || !list.data?.success || !data) return cached;

      const known = data.tasks.find((task) => task.taskId === after.taskId);
      if (known && known.revision >= after.revision) return cached;

      let counts = data.counts;
      let totalCount = data.totalCount;
      if (counts) {
        counts = { ...counts };
        if (before && inScope(before, scope)) {
          const key = COUNT_KEY[before.taskStatus];
          counts[key] = Math.max(0, counts[key] - 1);
        }
        if (inScope(after, scope)) counts[COUNT_KEY[after.taskStatus]] += 1;
        totalCount = scope.status
          ? counts[COUNT_KEY[scope.status]]
          : counts.open + counts.completed + counts.cancelled;
      }

      const rest = data.tasks.filter((task) => task.taskId !== after.taskId);
      const belongs =
        inScope(after, scope) && (!scope.status || after.taskStatus === scope.status);
      const wasLast =
        data.tasks.at(-1)?.taskId === after.taskId &&
        (!before || compareTasks(after, before) <= 0);
      const tasks = belongs
        ? insertSorted(rest, after, data.hasMore ?? false, wasLast)
        : rest;
      return {
        ...list,
        data: {
          ...list.data,
          data: { ...data, tasks, ...(counts ? { counts, totalCount } : {}) },
        },
      };
    });
  }
}

export function applySavedTask(
  queryClient: QueryClient,
  workspaceId: string,
  before: TaskEntry,
  saved: TaskEntry
) {
  patchTaskLists(
    queryClient,
    [getGetProjectTasksQueryKey(workspaceId, saved.projectId)],
    saved.taskId,
    (row) => ({ ...row, ...saved })
  );
  moveTaskAcrossLists(queryClient, workspaceId, before, saved);
}

export function insertTaskIntoLists(
  queryClient: QueryClient,
  workspaceId: string,
  row: TaskEntry
) {
  queryClient.setQueriesData(
    { queryKey: getGetProjectTasksQueryKey(workspaceId, row.projectId) },
    (cached: unknown) => {
      const list = cached as CachedList | undefined;
      if (list?.status !== 200 || !list.data?.success || !list.data.data)
        return cached;
      const tasks = list.data.data.tasks;
      return {
        ...list,
        data: {
          ...list.data,
          data: {
            ...list.data.data,
            tasks: tasks.some((task) => task.taskId === row.taskId)
              ? tasks.map((task) => (task.taskId === row.taskId ? row : task))
              : [row, ...tasks],
          },
        },
      };
    }
  );
  moveTaskAcrossLists(queryClient, workspaceId, null, row);
}
