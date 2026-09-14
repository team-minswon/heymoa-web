import { describe, expect, it } from "vitest";

import {
  getGetProjectsQueryKey,
  getGetProjectTaskRevisionsQueryKey,
  getGetProjectTasksQueryKey,
} from "@/lib/api/generated/projects/projects";
import { isProjectTaskQueryKey } from "@/lib/tasks/task-groups";

describe("isProjectTaskQueryKey", () => {
  it("프로젝트 할 일 목록과 할 일 이력만 고른다", () => {
    expect(isProjectTaskQueryKey(getGetProjectTasksQueryKey("w1", "p1"))).toBe(true);
    expect(isProjectTaskQueryKey(getGetProjectTaskRevisionsQueryKey("w1", "p1", "t1"))).toBe(true);
    expect(isProjectTaskQueryKey(getGetProjectsQueryKey("w1"))).toBe(false);
    expect(isProjectTaskQueryKey([])).toBe(false);
  });
});
