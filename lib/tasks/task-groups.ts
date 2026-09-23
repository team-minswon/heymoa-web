import type { ProjectTaskListResponseDataTasksItem } from "@/lib/api/generated/models";
import { getAppDateKey } from "@/lib/format/date";

export type ProjectTask = ProjectTaskListResponseDataTasksItem;
export type TaskStatus = ProjectTask["taskStatus"];

/**
 * **할 일이 자기 프로젝트를 들고 온다** (APP-685). 전에는 프로젝트마다 따로 받아 합치느라
 * `{projectId, projectName, task}` 로 감쌌고, 그 짝을 `useQueries` 결과 배열의 **인덱스로**
 * 맞췄다 — 요청 하나가 실패해 배열이 밀리면 남의 프로젝트 이름이 붙는다.
 */
export type TaskEntry = ProjectTask;

export type TaskGroupKey = "OVERDUE" | "THIS_WEEK" | "LATER" | "NO_DUE";

export type TaskGroup = { key: TaskGroupKey; label: string; entries: TaskEntry[] };

const GROUPS: ReadonlyArray<{ key: TaskGroupKey; label: string }> = [
  { key: "OVERDUE", label: "기한 지남" },
  { key: "THIS_WEEK", label: "이번 주" },
  { key: "LATER", label: "다음 주 이후" },
  { key: "NO_DUE", label: "기한 없음" },
];

export type TaskFilter = { assigneeUserId: string | null; projectId: string | null };

/**
 * 「내 할 일」은 계정으로 풀린 담당만 본다. 이름 없는 화자에게 걸린 할 일은 아직 누구의 것인지
 * 모르므로 거기 들지 않는다.
 */
export function filterTasks(entries: readonly TaskEntry[], filter: TaskFilter) {
  return entries.filter(
    (task) =>
      (!filter.projectId || task.projectId === filter.projectId) &&
      (!filter.assigneeUserId ||
        (task.assignee?.type === "USER" && task.assignee.id === filter.assigneeUserId))
  );
}

/** `today`(YYYY-MM-DD)가 속한 주의 일요일. 주는 월요일에 시작한다. */
export function endOfWeek(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? 0 : 7 - weekday));
  return date.toISOString().slice(0, 10);
}

/** 기한은 날짜만 있는 값이라 문자열 비교가 곧 날짜 비교다. 기한 없는 것은 뒤로 간다. */
const byDueThenContent = (a: TaskEntry, b: TaskEntry) =>
  (a.due ?? "9999-12-31").localeCompare(b.due ?? "9999-12-31") ||
  a.content.localeCompare(b.content, "ko");

function groupOf(task: ProjectTask, today: string, weekEnd: string): TaskGroupKey {
  if (!task.due) return "NO_DUE";
  if (task.due < today) return "OVERDUE";
  return task.due <= weekEnd ? "THIS_WEEK" : "LATER";
}

/** 진행 중인 할 일을 기한으로 나눈다. 빈 묶음은 세우지 않는다. */
export function groupTasks(
  entries: readonly TaskEntry[],
  today: string = getAppDateKey(new Date())
): TaskGroup[] {
  const weekEnd = endOfWeek(today);
  const open = entries.filter((task) => task.taskStatus === "OPEN").sort(byDueThenContent);
  return GROUPS.map(({ key, label }) => ({
    key,
    label,
    entries: open.filter((task) => groupOf(task, today, weekEnd) === key),
  })).filter((group) => group.entries.length > 0);
}

/** 끝났거나 취소한 할 일. 더 할 일이 남은 것이 아니라 기한으로 나누지 않고 한 줄로 늘어놓는다. */
export function tasksWithStatus(
  entries: readonly TaskEntry[],
  status: Exclude<TaskStatus, "OPEN">
) {
  return entries.filter((task) => task.taskStatus === status).sort(byDueThenContent);
}

/** 할 일 상태의 이름. 목록 · 이력 · 검토 제안이 같은 상태를 같은 이름으로 부른다. */
export const TASK_STATUS_LABEL: Record<ProjectTask["taskStatus"], string> = {
  OPEN: "진행 중",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

/**
 * 할 일 목록·이력 조회의 키인가. 회의 확정은 프로젝트에 할 일을 만드는데, 그때 노트의
 * 프로젝트를 아직 모를 수도 있어 이 조회들을 통째로 다시 읽힌다.
 *
 * **URL 정규식이라 조용히 깨진다.** 워크스페이스 단위 경로(APP-685)가 생겼을 때 이 줄을 같이
 * 안 고쳤으면, 확정 뒤 할 일 목록 무효화가 **에러도 경고도 없이** 멈춘다 — 증상은 낡은 목록이
 * 남는 것뿐이라 사람이 눈으로 봐야 잡힌다. 두 모양을 다 본다.
 */
export function isProjectTaskQueryKey(queryKey: readonly unknown[]) {
  return (
    typeof queryKey[0] === "string" &&
    (/\/projects\/[^/]+\/tasks(\/|$)/.test(queryKey[0]) ||
      /\/workspaces\/[^/]+\/tasks(\/|$)/.test(queryKey[0]))
  );
}
