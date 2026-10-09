import { describe, expect, it } from "vitest";

import {
  compareTasks,
  endOfWeek,
  groupTasks,
  tasksWithStatus,
  type TaskEntry,
} from "@/lib/tasks/task-groups";

const entry = (
  content: string,
  due: string | null,
  taskStatus: "OPEN" | "COMPLETED" | "CANCELLED" = "OPEN"
): TaskEntry => ({
  taskId: content,
  projectId: "p1",
  projectName: "제품",
  content,
  taskStatus,
  assignee: null,
  due,
  revision: 1,
});

describe("groupTasks", () => {
  it("진행 중인 할 일만 기한으로 나눈다", () => {
    // 2026-09-16 은 수요일이고 그 주는 20일(일)에 끝난다.
    const groups = groupTasks(
      [
        entry("다음 주", "2026-09-21"),
        entry("기한 없음", null),
        entry("나중 이번 주", "2026-09-20"),
        entry("지남", "2026-09-15"),
        entry("오늘", "2026-09-16"),
        entry("끝남", "2026-09-10", "COMPLETED"),
        entry("취소", null, "CANCELLED"),
      ],
      "2026-09-16"
    );

    expect(groups.map((group) => [group.label, group.entries.map((e) => e.content)])).toEqual([
      ["기한 지남", ["지남"]],
      ["이번 주", ["오늘", "나중 이번 주"]],
      ["다음 주 이후", ["다음 주"]],
      ["기한 없음", ["기한 없음"]],
    ]);
  });

  it("빈 묶음은 세우지 않고, 일요일은 그 주의 끝이다", () => {
    expect(groupTasks([entry("a", "2026-09-17")], "2026-09-16").map((g) => g.key)).toEqual([
      "THIS_WEEK",
    ]);
    expect(endOfWeek("2026-09-20")).toBe("2026-09-20");
    expect(endOfWeek("2026-09-14")).toBe("2026-09-20");
  });
});

describe("tasksWithStatus", () => {
  it("그 상태의 할 일만 기한 순으로 늘어놓는다", () => {
    const all = [
      entry("늦게 끝남", null, "COMPLETED"),
      entry("먼저 끝남", "2026-09-10", "COMPLETED"),
      entry("취소", null, "CANCELLED"),
      entry("진행", null),
    ];
    expect(tasksWithStatus(all, "COMPLETED").map((e) => e.content)).toEqual([
      "먼저 끝남",
      "늦게 끝남",
    ]);
    expect(tasksWithStatus(all, "CANCELLED").map((e) => e.content)).toEqual(["취소"]);
  });
});

describe("compareTasks", () => {
  const row = (taskId: string, due: string | null) => ({ ...entry(taskId, due), taskId });

  /** 서버 정렬 `(기한 오름차순·기한 없음 뒤, taskId 오름차순)` 과 같은 순서여야 쪽을 이어 붙인 목록이 어긋나지 않는다. */
  it("기한 순이고 기한 없음이 뒤이며 같은 기한 안에서는 id 순이다", () => {
    const sorted = [
      row("01B", null),
      row("01C", "2026-10-05"),
      row("01A", "2026-10-05"),
      row("0Z9", "2026-10-03"),
      row("01A0", null),
    ].sort(compareTasks);

    expect(sorted.map((task) => task.taskId)).toEqual(["0Z9", "01A", "01C", "01A0", "01B"]);
  });

  it("기한 없음은 가장 늦은 실제 날짜보다도 뒤다", () => {
    const sorted = [row("01A", null), row("01B", "9999-12-31")].sort(compareTasks);
    expect(sorted.map((task) => task.taskId)).toEqual(["01B", "01A"]);
  });

  it("글 내용은 순서에 영향을 주지 않는다", () => {
    const first = { ...row("01A", "2026-10-05"), content: "하" };
    const second = { ...row("01B", "2026-10-05"), content: "가" };
    expect([second, first].sort(compareTasks)).toEqual([first, second]);
  });
});
