import type { ProjectTaskListResponseDataTasksItem } from "@/lib/api/generated/models";
import { getAppDateKey } from "@/lib/format/date";

export type ProjectTask = ProjectTaskListResponseDataTasksItem;
export type TaskStatus = ProjectTask["taskStatus"];

export type TaskEntry = ProjectTask;

export type TaskGroupKey = "OVERDUE" | "THIS_WEEK" | "LATER" | "NO_DUE";

type TaskGroup = { key: TaskGroupKey; entries: TaskEntry[] };

const GROUPS: readonly TaskGroupKey[] = ["OVERDUE", "THIS_WEEK", "LATER", "NO_DUE"];

export function endOfWeek(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? 0 : 7 - weekday));
  return date.toISOString().slice(0, 10);
}

/** 서버 정렬 키(기한 오름차순·기한 없음 뒤, taskId)와 같아야 합니다. DB 콜레이션과 브라우저 한국어 정렬이 달라 글 내용으로 가르지 않습니다. */
export const compareTasks = (a: TaskEntry, b: TaskEntry) => {
  if ((a.due === null) !== (b.due === null)) return a.due === null ? 1 : -1;
  if (a.due !== null && b.due !== null && a.due !== b.due) return a.due < b.due ? -1 : 1;
  return a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0;
};

function groupOf(task: ProjectTask, today: string, weekEnd: string): TaskGroupKey {
  if (!task.due) return "NO_DUE";
  if (task.due < today) return "OVERDUE";
  return task.due <= weekEnd ? "THIS_WEEK" : "LATER";
}

export function groupTasks(
  entries: readonly TaskEntry[],
  today: string = getAppDateKey(new Date())
): TaskGroup[] {
  const weekEnd = endOfWeek(today);
  const open = entries.filter((task) => task.taskStatus === "OPEN").sort(compareTasks);
  return GROUPS.map((key) => ({
    key,
    entries: open.filter((task) => groupOf(task, today, weekEnd) === key),
  })).filter((group) => group.entries.length > 0);
}

export function tasksWithStatus(
  entries: readonly TaskEntry[],
  status: Exclude<TaskStatus, "OPEN">
) {
  return entries.filter((task) => task.taskStatus === status).sort(compareTasks);
}

export function isProjectTaskQueryKey(queryKey: readonly unknown[]) {
  return (
    typeof queryKey[0] === "string" &&
    (/\/projects\/[^/]+\/tasks(\/|$)/.test(queryKey[0]) ||
      /\/workspaces\/[^/]+\/tasks(\/|$)/.test(queryKey[0]))
  );
}
