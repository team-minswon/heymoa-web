import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { ProjectTaskListResponseDataTasksItemAssignee } from "@/lib/api/generated/models";
import {
  getGetProjectTasksQueryKey,
  getGetWorkspaceTasksQueryKey,
} from "@/lib/api/generated/projects/projects";
import type { AssigneeChoice, AssigneeValue } from "@/lib/assignees/describe";
import type { TaskEntry } from "@/lib/tasks/task-groups";

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

/** 방금 만든 할 일을 두 목록에 끼운다. 이미 있으면(재조회가 먼저 데려왔다) 바꾼다. 캐시에 없는 목록은 그냥 지나간다. */
export function insertTaskIntoLists(
  queryClient: QueryClient,
  keys: readonly QueryKey[],
  row: TaskEntry
) {
  for (const key of keys) {
    queryClient.setQueriesData({ queryKey: key }, (cached: unknown) => {
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
    });
  }
}
