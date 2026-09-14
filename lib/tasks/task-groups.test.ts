import { describe, expect, it } from "vitest";

import {
  endOfWeek,
  filterTasks,
  groupTasks,
  tasksWithStatus,
  type TaskEntry,
} from "@/lib/tasks/task-groups";

const entry = (
  content: string,
  due: string | null,
  taskStatus: "OPEN" | "COMPLETED" | "CANCELLED" = "OPEN"
): TaskEntry => ({
  projectId: "p1",
  projectName: "제품",
  task: { taskId: content, content, taskStatus, assignee: null, due, revision: 1 },
});

describe("filterTasks", () => {
  const mine: TaskEntry = {
    projectId: "p1",
    projectName: "제품",
    task: {
      taskId: "a",
      content: "내 것",
      taskStatus: "OPEN",
      assignee: { type: "USER", id: "me", name: "나" },
      due: null,
      revision: 1,
    },
  };
  const speaker: TaskEntry = {
    projectId: "p2",
    projectName: "리서치",
    task: {
      taskId: "b",
      content: "화자 것",
      taskStatus: "OPEN",
      assignee: { type: "SPEAKER_LABEL", noteId: "n", label: "C" },
      due: null,
      revision: 1,
    },
  };

  it("내 할 일은 계정으로 풀린 담당만, 프로젝트는 그 프로젝트만 남긴다", () => {
    const all = [mine, speaker];
    expect(filterTasks(all, { assigneeUserId: "me", projectId: null })).toEqual([mine]);
    expect(filterTasks(all, { assigneeUserId: null, projectId: "p2" })).toEqual([speaker]);
    expect(filterTasks(all, { assigneeUserId: "me", projectId: "p2" })).toEqual([]);
    expect(filterTasks(all, { assigneeUserId: null, projectId: null })).toEqual(all);
  });
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

    expect(groups.map((group) => [group.label, group.entries.map((e) => e.task.content)])).toEqual([
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
    expect(tasksWithStatus(all, "COMPLETED").map((e) => e.task.content)).toEqual([
      "먼저 끝남",
      "늦게 끝남",
    ]);
    expect(tasksWithStatus(all, "CANCELLED").map((e) => e.task.content)).toEqual(["취소"]);
  });
});
