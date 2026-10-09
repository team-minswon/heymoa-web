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

export const TASK_LIST_PAGE_SIZE = 30;

const COUNT_KEY = { OPEN: "open", COMPLETED: "completed", CANCELLED: "cancelled" } as const;

/** 목록 캐시 키의 둘째 칸. 갱신기(`task-list-cache`)가 키에서 거르기를 읽는다. */
export type TaskListKeyParams = {
  status: TaskStatus;
  assigneeUserId?: string;
  projectId?: string;
  limit: number;
  pages: number;
};

/**
 * 할 일 **전체 화면**의 목록. 상태 탭 하나의 거르기 안에서 쪽 수만큼 이어 붙인 한 응답을 돌려준다 (APP-1043).
 *
 * 거르기와 정렬은 서버가 한다 — 화면이 전건을 받아 거르던 때와 같은 규칙이고(「내 할 일」은 푼 담당이 그 계정인 것), 정렬은
 * `(기한, id)` 다. 쪽 수가 키에 들어가고 응답은 한 덩어리라, 목록 캐시를 만지는 쪽은 `{ tasks, counts … }` 한 모양을 읽는다.
 * 키의 첫 칸은 생성 훅과 같은 경로라 `getGetWorkspaceTasksQueryKey(id)` 무효화가 이 목록도 집는다.
 *
 * **전건이 필요한 호출은 이걸 쓰지 않는다.** 프로젝트 단위 목록(검토 보드)은 `limit` 없이 부르는 생성 훅 그대로다.
 * 매번 처음부터 쪽 수만큼 다시 읽고 커서를 보관하지 않는다 — 읽는 도중 기한이 바뀐 줄의 어긋남이 한 번의 읽기 연쇄 안에 갇힌다.
 */
export function useTaskListPages({
  workspaceId,
  status,
  assigneeUserId,
  projectId,
  pages,
}: {
  workspaceId: string;
  status: TaskStatus;
  assigneeUserId?: string;
  projectId?: string;
  pages: number;
}) {
  const keyParams: TaskListKeyParams = {
    status,
    ...(assigneeUserId ? { assigneeUserId } : {}),
    ...(projectId ? { projectId } : {}),
    limit: TASK_LIST_PAGE_SIZE,
    pages,
  };

  return useQuery<getWorkspaceTasksResponse>({
    queryKey: [...getGetWorkspaceTasksQueryKey(workspaceId), keyParams],
    queryFn: async ({ signal }): Promise<getWorkspaceTasksResponse> => {
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
          // 첫 쪽이 아니면 이미 읽은 것까지만 돌려준다 — 던지면 보던 목록이 통째로 사라진다. 남은 커서가 그대로 `hasMore` 라
          // 「더 보기」가 다시 읽는다.
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
      // 개수는 가장 나중에 읽은 쪽의 값이다(가장 새롭다). 쪽 사이에 줄이 상태를 옮겼으면 읽은 줄 수보다 작아질 수 있어 그 밑으로는
      // 내리지 않는다 — 응답이 스스로 모순되지 않게(APP-1039).
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
    // 쪽 수가 바뀌면 키가 바뀐다. 같은 거르기 안에서는 이전 목록을 붙들어 「더 보기」마다 목록이 비었다 차지 않게 한다. 탭만
    // 바뀐 경우에는 개수(상태를 뺀 거르기 값)만 쓰도록 이전 응답을 주고, 줄은 화면이 상태로 걸러 쓴다.
    placeholderData: (previous, previousQuery) => {
      const before = previousQuery?.queryKey[1] as TaskListKeyParams | undefined;
      // 다른 워크스페이스의 응답은 줄도 개수도 남의 것이다.
      return before &&
        previousQuery?.queryKey[0] === getGetWorkspaceTasksQueryKey(workspaceId)[0] &&
        before.assigneeUserId === assigneeUserId &&
        before.projectId === projectId
        ? previous
        : undefined;
    },
    refetchOnMount: "always",
  });
}

