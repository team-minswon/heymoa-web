"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

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
  applySavedTask,
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

export function useTaskUpdate(
  workspaceId: string,
  onSaved?: (saved: TaskEntry) => void
) {
  const t = useTranslations("tasks");
  const queryClient = useQueryClient();
  const [conflictTaskId, setConflictTaskId] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState<ReadonlyMap<string, TaskStatus>>(
    new Map()
  );
  const active = useRef(0);
  const needsReconcile = useRef(false);
  const update = useUpdateProjectTask({
    mutation: { meta: { suppressErrorToast: true } },
  });

  const save = async (entry: TaskEntry, patch: TaskPatch): Promise<boolean> => {
    const task = entry;
    const listKeys = taskListKeys(workspaceId, entry.projectId);
    const revisionsKey = getGetProjectTaskRevisionsQueryKey(
      workspaceId,
      entry.projectId,
      task.taskId
    );
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

    active.current += 1;
    await Promise.all(
      listKeys.map((queryKey) => queryClient.cancelQueries({ queryKey }))
    );
    const touches = {
      content: "content" in patch && patch.content !== undefined,
      assignee: "assignee" in patch,
      due: "due" in patch,
    };
    const keepsRowInPlace = "taskStatus" in patch;
    if (!keepsRowInPlace) {
      patchTaskLists(queryClient, listKeys, task.taskId, (row) => ({
        ...row,
        ...(touches.content ? { content: patch.content } : {}),
        ...(touches.assignee
          ? { assignee: assigneeRowOf(patch.assignee ?? null) }
          : {}),
        ...(touches.due ? { due: patch.due ?? null } : {}),
      }));
    }
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
      const saved =
        response.status === 200 && response.data.success
          ? response.data.data
          : null;
      if (saved) {
        applySavedTask(queryClient, workspaceId, task, saved);
        onSaved?.(saved);
        needsReconcile.current = true;
        void queryClient.invalidateQueries({ queryKey: revisionsKey });
      } else {
        await refresh();
      }
      return true;
    } catch (error) {
      if (!keepsRowInPlace) {
        patchTaskLists(queryClient, listKeys, task.taskId, (row) => ({
          ...row,
          ...(touches.content ? { content: task.content } : {}),
          ...(touches.assignee ? { assignee: task.assignee ?? null } : {}),
          ...(touches.due ? { due: task.due } : {}),
        }));
      }
      if (errorCodeOf(error) === "PROJECT_KNOWLEDGE_CONFLICT") {
        setConflictTaskId(task.taskId);
        if (active.current > 1) {
          needsReconcile.current = true;
          void queryClient.invalidateQueries({ queryKey: revisionsKey });
        } else {
          await refresh();
        }
      } else {
        toast.error(errorMessageOf(error, t("saveFailed")));
      }
      return false;
    } finally {
      setInFlight((current) => {
        const next = new Map(current);
        next.delete(task.taskId);
        return next;
      });
      active.current -= 1;
      if (active.current === 0 && needsReconcile.current) {
        needsReconcile.current = false;
        for (const queryKey of listKeys) {
          void queryClient.invalidateQueries({ queryKey });
        }
      }
    }
  };

  return {
    save,
    pendingOf: (taskId: string) => inFlight.get(taskId) ?? null,
    conflictTaskId,
  };
}
