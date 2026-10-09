import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { ProjectTaskListResponseDataTasksItemAssignee } from "@/lib/api/generated/models";
import {
  getGetProjectTasksQueryKey,
  getGetWorkspaceTasksQueryKey,
} from "@/lib/api/generated/projects/projects";
import type { AssigneeChoice, AssigneeValue } from "@/lib/assignees/describe";
import { compareTasks, type TaskEntry, type TaskStatus } from "@/lib/tasks/task-groups";

/**
 * 할 일 목록 캐시를 **응답 전에** 고치는 자리 (APP-1033). 목록이 둘이다 — 워크스페이스 단위와 프로젝트 단위(APP-685).
 * 한쪽만 고치면 다른 화면의 줄이 낡은 채 남는다.
 */
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

/** 목록 응답(`200 success`)이면 그 행들을 `fn` 으로 바꾼 사본을, 아니면 그대로 돌려준다. */
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

/** 사람이 고른 담당을 목록 행의 담당 모양으로. 사진은 서버가 안 싣는 값이라 비운다 */
export function assigneeRowOf(
  choice: AssigneeValue | AssigneeChoice | null
): ProjectTaskListResponseDataTasksItemAssignee | null {
  if (!choice) return null;
  return choice.type === "SPEAKER_LABEL"
    ? { type: choice.type, noteId: choice.noteId, label: choice.label }
    : { type: choice.type, id: choice.id, name: choice.name };
}

/**
 * 이 할 일이 선 목록 캐시 둘(워크스페이스 단위·프로젝트 단위)의 행을 바꾸고, 되돌릴 사본을 돌려준다.
 * 키는 생성 헬퍼의 한 칸짜리라 `…/tasks/{id}/revisions` 같은 다른 키는 집지 않는다.
 */
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

/** 워크스페이스 목록 한 캐시 항목이 담는 거르기. 키의 둘째 칸(`useTaskListPages`)에서 읽는다. */
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

/** 상태를 뺀 거르기 — 프로젝트와 「내 할 일」(푼 담당이 그 계정). 서버의 `counts` 가 세는 범위다. */
function inScope(row: TaskEntry, scope: ListScope) {
  return (
    (!scope.projectId || row.projectId === scope.projectId) &&
    (!scope.assigneeUserId ||
      (row.assignee?.type === "USER" && row.assignee.id === scope.assigneeUserId))
  );
}

/**
 * 정렬된 목록에 줄을 끼운다. 쪽이 더 남았고 자리가 읽은 범위 뒤라면 끼우지 않는다 — 다음 쪽이 데려온다. 단 [wasLast](읽은
 * 범위의 마지막 줄이던 줄을 고친 경우)는 그 자리에 남긴다.
 */
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

/**
 * 줄 하나가 **저장되어 상태·담당·기한이 달라진 것**을 워크스페이스 목록 캐시 항목마다 반영한다 (APP-1043). 목록은 상태 탭 ×
 * 거르기마다 따로 캐시이고 서버가 줄을 걸러 주므로, 한 줄의 변화가 항목마다 다르게 보인다.
 *
 * - **개수(`counts`·`totalCount`)는 줄이 읽은 쪽에 있는지와 무관하다.** 이전·이후 줄을 그 항목의 상태 외 거르기에 견줘 센다 —
 *   다른 탭의 로드되지 않은 줄도 개수는 옮겨 간다.
 * - 줄은 항목의 거르기(상태 포함)에 맞을 때만 정렬 자리에 서고, 아니면 빠진다.
 *
 * [before] 가 없으면 새로 생긴 줄이다. **저장 응답이 온 뒤에만 부른다** — 낙관 단계는 줄 필드를 제자리에서만 고치므로 되돌릴 것이
 * 없다. 어긋나면 마지막 저장 뒤 재조회가 서버 값으로 맞춘다.
 */
export function moveTaskAcrossLists(
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

      // 이 항목이 이미 이 판(이상)의 줄을 들고 있으면 재조회가 저장 반영 뒤의 서버 값을 먼저 가져온 것이다 — 개수와 자리를 다시
      // 옮기면 두 번 센다. 줄이 읽은 쪽에 없는 항목의 어긋남은 마지막 저장 뒤 재조회가 맞춘다.
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
      // 읽은 범위의 마지막 줄을 고쳤다면 그 자리에 남긴다 — 단 뒤로 밀렸으면(기한이 늦어짐) 읽지 않은 줄 너머일 수 있어 뺀다.
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

/**
 * 저장 응답을 목록에 반영한다. 프로젝트 단위 목록(거르기 없음)은 그 줄을 갈아 끼우고, 워크스페이스 목록은 항목마다
 * [moveTaskAcrossLists] 가 한다.
 */
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

/**
 * 방금 만든 할 일을 목록에 끼운다. 프로젝트 단위 목록에는 맨 앞에(이미 있으면 바꾼다), 워크스페이스 목록에는 항목마다
 * 거르기가 맞을 때만 정렬 자리에 끼우고 개수를 올린다. 캐시에 없는 목록은 그냥 지나간다.
 */
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
