import { useQuery } from "@tanstack/react-query";

import type {
  GetWorkspaceTasksParams,
  WorkspaceTaskListResponseData,
  WorkspaceTaskListResponseDataTasksItem,
} from "@/lib/api/generated/models";
import {
  getGetWorkspaceTasksQueryKey,
  getWorkspaceTasks,
  type getWorkspaceTasksResponse,
} from "@/lib/api/generated/projects/projects";
import type { TaskStatus } from "@/lib/tasks/task-groups";

const TASK_LIST_PAGE_SIZE = 30;

const COUNT_KEY = { OPEN: "open", COMPLETED: "completed", CANCELLED: "cancelled" } as const;

type TaskListKeyParams = {
  status: TaskStatus;
  assigneeUserId?: string;
  projectId?: string;
  limit: number;
  pages: number;
};

type TaskListArgs = {
  workspaceId: string;
  status: TaskStatus;
  assigneeUserId?: string;
  projectId?: string;
  pages: number;
};

export function useTaskListPages(args: TaskListArgs) {
  return useQuery<getWorkspaceTasksResponse>({
    ...taskListQuery(args),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[0] === getGetWorkspaceTasksQueryKey(args.workspaceId)[0] ? previous : undefined,
    refetchOnMount: "always",
  });
}

export function taskListQuery({ workspaceId, status, assigneeUserId, projectId, pages }: TaskListArgs) {
  const keyParams: TaskListKeyParams = {
    status,
    ...(assigneeUserId ? { assigneeUserId } : {}),
    ...(projectId ? { projectId } : {}),
    limit: TASK_LIST_PAGE_SIZE,
    pages,
  };

  return {
    queryKey: [...getGetWorkspaceTasksQueryKey(workspaceId), keyParams],
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<getWorkspaceTasksResponse> => {
      const merged: WorkspaceTaskListResponseDataTasksItem[] = [];
      let last: getWorkspaceTasksResponse | undefined;
      for (let page = 0; page < pages; page += 1) {
        const tail = last?.status === 200 ? last.data.data : undefined;
        const params: GetWorkspaceTasksParams = {
          status,
          ...(assigneeUserId ? { assigneeUserId } : {}),
          ...(projectId ? { projectId } : {}),
          limit: String(TASK_LIST_PAGE_SIZE),
          ...(tail?.nextTaskId
            ? {
                afterTaskId: tail.nextTaskId,
                ...(tail.nextDue ? { afterDue: tail.nextDue } : {}),
              }
            : {}),
        };
        let response: getWorkspaceTasksResponse;
        try {
          response = await getWorkspaceTasks(workspaceId, params, { signal });
        } catch (error) {
          if (page > 0 && !signal.aborted) break;
          throw error;
        }
        if (response.status !== 200 || !response.data.success) {
          if (page > 0) break;
          return response;
        }
        for (const task of response.data.data.tasks) {
          if (!merged.some((seen) => seen.taskId === task.taskId)) {
            merged.push(task);
          }
        }
        last = response;
        if (!response.data.data.hasMore) break;
      }
      const tail = last?.status === 200 ? last.data.data : undefined;
      const counts = { open: 0, completed: 0, cancelled: 0, ...tail?.counts };
      counts[COUNT_KEY[status]] = Math.max(counts[COUNT_KEY[status]], merged.length);
      const data: WorkspaceTaskListResponseData = {
        tasks: merged,
        totalCount: Math.max(tail?.totalCount ?? 0, merged.length),
        counts,
        hasMore: tail?.hasMore ?? false,
        nextDue: tail?.nextDue ?? null,
        nextTaskId: tail?.nextTaskId ?? null,
      };
      return {
        status: 200,
        headers: last?.headers ?? new Headers(),
        data: { success: true, error: null, data },
      };
    },
  };
}
