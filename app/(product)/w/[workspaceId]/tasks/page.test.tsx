import { describe, expect, it, vi } from "vitest";

import WorkspaceTasksRoute from "./page";

vi.mock("@/components/tasks/all-tasks", () => ({ AllTasks: () => null }));
vi.mock("@/lib/workspace/prefetch", () => ({
  prefetchTasksRoute: () => {
    throw new Error("할 일 route는 서버 데이터 조회를 기다리지 않아야 합니다.");
  },
}));

describe("WorkspaceTasksRoute", () => {
  it("task API 응답 없이 요청한 워크스페이스 화면을 반환한다", async () => {
    const route = await WorkspaceTasksRoute({
      params: Promise.resolve({ workspaceId: "workspace" }),
    });
    expect(route.props).toEqual({ workspaceId: "workspace" });
  });
});
