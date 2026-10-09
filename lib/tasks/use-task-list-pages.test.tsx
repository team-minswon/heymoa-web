import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTaskListPages } from "@/lib/tasks/use-task-list-pages";

const getWorkspaceTasks = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/generated/projects/projects", () => ({
  getGetWorkspaceTasksQueryKey: (id: string) => [`/v1/workspaces/${id}/tasks`],
  getWorkspaceTasks: (...args: unknown[]) => getWorkspaceTasks(...args),
}));

const task = (taskId: string, due: string | null) => ({
  taskId,
  projectId: "p1",
  projectName: "제품",
  content: taskId,
  taskStatus: "OPEN",
  assignee: null,
  due,
  revision: 1,
});
const counts = { open: 4, completed: 1, cancelled: 0 };
const page = (
  tasks: ReturnType<typeof task>[],
  hasMore: boolean,
  next: { due: string | null; id: string } | null = null
) => ({
  status: 200,
  headers: new Headers(),
  data: {
    success: true,
    error: null,
    data: {
      tasks,
      totalCount: 4,
      counts,
      hasMore,
      nextDue: next?.due ?? null,
      nextTaskId: next?.id ?? null,
    },
  },
});

function run(pages: number, over: { assigneeUserId?: string; projectId?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () => useTaskListPages({ workspaceId: "W1", status: "OPEN", pages, ...over }),
    { wrapper }
  );
}

describe("useTaskListPages", () => {
  beforeEach(() => getWorkspaceTasks.mockReset());

  it("쪽 수만큼 커서를 이어 읽어 한 응답으로 붙이고 개수는 마지막 쪽 값이다", async () => {
    getWorkspaceTasks
      .mockResolvedValueOnce(
        page([task("T1", "2026-10-01")], true, { due: "2026-10-01", id: "T1" })
      )
      .mockResolvedValueOnce(page([task("T2", null)], false));
    const { result } = run(2, { assigneeUserId: "me", projectId: "p1" });

    await waitFor(() => expect(result.current.data).toBeDefined());

    const data = result.current.data;
    expect(data?.status === 200 && data.data.data.tasks.map((t) => t.taskId)).toEqual(["T1", "T2"]);
    expect(data?.status === 200 && data.data.data.counts).toEqual(counts);
    expect(data?.status === 200 && data.data.data.hasMore).toBe(false);
    // 첫 요청은 커서 없이 거르기와 쪽 크기를 단다. 둘째는 첫 쪽의 다음 커서를 그대로 단다.
    expect(getWorkspaceTasks.mock.calls[0]?.[1]).toEqual({
      status: "OPEN",
      assigneeUserId: "me",
      projectId: "p1",
      limit: "30",
    });
    expect(getWorkspaceTasks.mock.calls[1]?.[1]).toMatchObject({
      afterDue: "2026-10-01",
      afterTaskId: "T1",
    });
  });

  /** 기한 없는 줄이 쪽 끝이면 `nextDue` 가 null 이다 — 보내지 않아야 서버가 「기한 없는 행 뒤」로 읽는다. */
  it("커서 행에 기한이 없으면 afterDue 를 보내지 않는다", async () => {
    getWorkspaceTasks
      .mockResolvedValueOnce(page([task("T1", null)], true, { due: null, id: "T1" }))
      .mockResolvedValueOnce(page([task("T2", null)], false));
    const { result } = run(2);

    await waitFor(() => expect(result.current.data).toBeDefined());

    const second = getWorkspaceTasks.mock.calls[1]?.[1] as Record<string, unknown>;
    expect(second.afterTaskId).toBe("T1");
    expect("afterDue" in second).toBe(false);
  });

  it("뒷쪽이 실패하면 읽은 곳까지만 돌려주고 더 있음을 남긴다", async () => {
    getWorkspaceTasks
      .mockResolvedValueOnce(page([task("T1", "2026-10-01")], true, { due: "2026-10-01", id: "T1" }))
      .mockRejectedValueOnce(new Error("network"));
    const { result } = run(2);

    await waitFor(() => expect(result.current.data).toBeDefined());

    const data = result.current.data;
    expect(data?.status === 200 && data.data.data.tasks).toHaveLength(1);
    expect(data?.status === 200 && data.data.data.hasMore).toBe(true);
  });

  /** 쪽 사이에 줄이 상태를 옮겨 마지막 쪽의 개수가 읽은 줄 수보다 작아도 응답이 스스로 모순되지 않는다. */
  it("개수는 읽은 줄 수 밑으로 내려가지 않는다", async () => {
    const small = page([task("T3", null)], false);
    small.data.data.counts = { open: 1, completed: 1, cancelled: 0 };
    small.data.data.totalCount = 1;
    getWorkspaceTasks
      .mockResolvedValueOnce(
        page([task("T1", "2026-10-01"), task("T2", "2026-10-02")], true, { due: "2026-10-02", id: "T2" })
      )
      .mockResolvedValueOnce(small);
    const { result } = run(2);

    await waitFor(() => expect(result.current.data).toBeDefined());

    const data = result.current.data;
    expect(data?.status === 200 && data.data.data.tasks).toHaveLength(3);
    expect(data?.status === 200 && data.data.data.counts.open).toBe(3);
    expect(data?.status === 200 && data.data.data.totalCount).toBe(3);
  });
});
