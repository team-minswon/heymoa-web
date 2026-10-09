"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  getGetProjectTaskRevisionsQueryKey,
  useUpdateProjectTask,
} from "@/lib/api/generated/projects/projects";
import {
  assigneeRequestOf,
  type AssigneeChoice,
  type AssigneeValue,
} from "@/lib/assignees/describe";
import {
  assigneeRowOf,
  patchTaskLists,
  taskListKeys,
} from "@/lib/tasks/task-list-cache";
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
  const [inFlight, setInFlight] = useState<ReadonlyMap<string, TaskStatus>>(
    new Map()
  );
  // 거절 코드마다 그리는 자리가 달라 전역 토스트를 끄고 아래에서 직접 가른다.
  const update = useUpdateProjectTask({
    mutation: { meta: { suppressErrorToast: true } },
  });

  /** 저장이 받아들여졌는지를 돌려준다. 편집을 닫을지 부르는 쪽이 이것으로 정한다 */
  const save = async (entry: TaskEntry, patch: TaskPatch): Promise<boolean> => {
    const task = entry;
    const listKeys = taskListKeys(workspaceId, entry.projectId);
    const revisionsKey = getGetProjectTaskRevisionsQueryKey(
      workspaceId,
      entry.projectId,
      task.taskId
    );
    /** 목록을 다시 읽는다 — 거절돼서 서버 값을 알아야 할 때만 쓴다 */
    const refresh = () =>
      Promise.all([
        ...listKeys.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        ),
        queryClient.invalidateQueries({ queryKey: revisionsKey }),
      ]);
    setConflictTaskId(null);
    setInFlight((current) =>
      new Map(current).set(task.taskId, patch.taskStatus ?? task.taskStatus)
    );

    // **담당·기한·내용은 응답 전에 줄에 먼저 건다** (APP-1033). 끝내기·취소는 여기서 건드리지 않는다 — 줄은 그 자리에
    // 두고 먼저 긋기만 하는 연출(`completing`)이 있고, 상태를 바꾸면 줄이 곧바로 다른 보기로 떠나 그 연출이 사라진다.
    // 이미 도는 목록 조회가 낡은 값으로 덮지 못하게 먼저 멈춘다.
    await Promise.all(
      listKeys.map((queryKey) => queryClient.cancelQueries({ queryKey }))
    );
    const keepsRowInPlace = "taskStatus" in patch;
    const snapshot = keepsRowInPlace
      ? []
      : patchTaskLists(queryClient, listKeys, task.taskId, (row) => ({
          ...row,
          ...("content" in patch && patch.content !== undefined
            ? { content: patch.content }
            : {}),
          ...("assignee" in patch
            ? { assignee: assigneeRowOf(patch.assignee ?? null) }
            : {}),
          ...("due" in patch ? { due: patch.due ?? null } : {}),
        }));
    try {
      const response = await update.mutateAsync({
        workspaceId,
        projectId: entry.projectId,
        taskId: task.taskId,
        data: {
          content: patch.content ?? task.content,
          taskStatus: patch.taskStatus ?? task.taskStatus,
          assignee: assigneeRequestOf(
            "assignee" in patch
              ? (patch.assignee ?? null)
              : (task.assignee ?? null)
          ),
          due: "due" in patch ? (patch.due ?? null) : task.due,
          revision: task.revision,
        },
      });
      // **응답이 곧 갱신된 행이다.** 목록을 다시 읽지 않고 그대로 갈아 끼운다 — 재조회가 실패하면 저장은 됐는데
      // 옛 값이 남고, 재조회가 끝날 때까지 칸이 잠겨 연속 수정이 느리다. 이력만 낡으므로 그것만 다시 읽힌다.
      const saved =
        response.status === 200 && response.data.success
          ? response.data.data
          : null;
      if (saved) {
        patchTaskLists(queryClient, listKeys, task.taskId, (row) => ({
          ...row,
          ...saved,
        }));
        void queryClient.invalidateQueries({ queryKey: revisionsKey });
      } else {
        await refresh();
      }
      return true;
    } catch (error) {
      // 먼저 건 값을 되돌린다. 거절이면 서버 값으로 다시 맞춘다.
      for (const [queryKey, cached] of snapshot)
        queryClient.setQueryData(queryKey, cached);
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
