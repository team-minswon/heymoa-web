"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  getGetProjectTaskRevisionsQueryKey,
  getGetWorkspaceTasksQueryKey,
  getGetProjectTasksQueryKey,
  useUpdateProjectTask,
} from "@/lib/api/generated/projects/projects";
import {
  assigneeRequestOf,
  type AssigneeChoice,
  type AssigneeValue,
} from "@/lib/assignees/describe";
import type { ProjectTask, TaskEntry } from "@/lib/tasks/task-groups";
import { toast } from "@/lib/ui/toast";

export type TaskPatch = {
  content?: string;
  taskStatus?: ProjectTask["taskStatus"];
  assignee?: AssigneeValue | AssigneeChoice | null;
  due?: string | null;
};

type TaskStatus = ProjectTask["taskStatus"];

/**
 * 할 일 수정의 한 길. 목록의 칸과 이력 시트의 버튼이 같은 판 대조와 같은 거절 처리를 쓴다.
 * 판이 낡아 거절되면 그 할 일을 다시 읽고 그 자리에 알린다 — 나머지 실패만 토스트다.
 */
export function useTaskUpdate(workspaceId: string) {
  const queryClient = useQueryClient();
  const [conflictTaskId, setConflictTaskId] = useState<string | null>(null);
  /**
   * 저장 중이거나 저장 뒤 목록을 다시 읽는 중인 할 일과 그 저장이 향하는 상태. **할 일마다 따로 센다** —
   * 여러 줄을 잇달아 고칠 수 있고, 다시 읽기 전에 줄을 풀면 옛 판으로 또 보내 스스로 충돌한다.
   */
  const [inFlight, setInFlight] = useState<ReadonlyMap<string, TaskStatus>>(new Map());
  // 거절 코드마다 그리는 자리가 달라 전역 토스트를 끄고 아래에서 직접 가른다.
  const update = useUpdateProjectTask({ mutation: { meta: { suppressErrorToast: true } } });

  /** 저장이 받아들여졌는지를 돌려준다. 편집을 닫을지 부르는 쪽이 이것으로 정한다 */
  const save = async (entry: TaskEntry, patch: TaskPatch): Promise<boolean> => {
    const task = entry;
    const refresh = () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetProjectTasksQueryKey(workspaceId, entry.projectId),
        }),
        // 워크스페이스 단위 목록이 읽는 자리다 (APP-685). 프로젝트 키만 비우면 이 화면의
        // 목록이 안 바뀐다 — 에러도 경고도 없이 낡은 값이 남는다.
        queryClient.invalidateQueries({
          queryKey: getGetWorkspaceTasksQueryKey(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetProjectTaskRevisionsQueryKey(workspaceId, entry.projectId, task.taskId),
        }),
      ]);
    setConflictTaskId(null);
    setInFlight((current) => new Map(current).set(task.taskId, patch.taskStatus ?? task.taskStatus));
    try {
      await update.mutateAsync({
        workspaceId,
        projectId: entry.projectId,
        taskId: task.taskId,
        data: {
          content: patch.content ?? task.content,
          taskStatus: patch.taskStatus ?? task.taskStatus,
          assignee: assigneeRequestOf(
            "assignee" in patch ? (patch.assignee ?? null) : (task.assignee ?? null)
          ),
          due: "due" in patch ? (patch.due ?? null) : task.due,
          revision: task.revision,
        },
      });
      await refresh();
      return true;
    } catch (error) {
      if (errorCodeOf(error) === "PROJECT_KNOWLEDGE_CONFLICT") {
        setConflictTaskId(task.taskId);
        await refresh();
      } else {
        toast.error(errorMessageOf(error, "할 일을 저장하지 못했습니다."));
      }
      return false;
    } finally {
      setInFlight((current) => {
        const next = new Map(current);
        next.delete(task.taskId);
        return next;
      });
    }
  };

  return {
    save,
    /** 그 할 일이 저장 중이면 저장이 향하는 상태, 아니면 null */
    pendingOf: (taskId: string) => inFlight.get(taskId) ?? null,
    conflictTaskId,
  };
}
