import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTaskUpdate } from "@/components/tasks/use-task-update";
import type { TaskEntry } from "@/lib/tasks/task-groups";

/**
 * `vi.fn()` 이 거절하는 프라미스를 따로 추적하다 **처리된 거절도 미처리 오류로 보고**해서, 거절 시험이 본문과 무관하게
 * 실패한다. 손으로 쓴 대역으로 바꿔 호출 기록만 남긴다.
 */
const mutate = vi.hoisted(() => ({
  impl: (async () => undefined) as (...args: unknown[]) => Promise<unknown>,
  calls: [] as unknown[][],
}));

vi.mock("@/lib/ui/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/api/generated/projects/projects", () => ({
  getGetProjectTasksQueryKey: (_w: string, projectId: string) => [
    `/projects/${projectId}/tasks`,
  ],
  getGetWorkspaceTasksQueryKey: (w: string) => [`/workspaces/${w}/tasks`],
  getGetProjectTaskRevisionsQueryKey: (_w: string, p: string, t: string) => [
    `/projects/${p}/tasks/${t}/revisions`,
  ],
  useUpdateProjectTask: () => ({
    mutateAsync: (...args: unknown[]) => {
      mutate.calls.push(args);
      return mutate.impl(...args);
    },
  }),
}));

const task = (over: Partial<TaskEntry> = {}): TaskEntry => ({
  projectId: "p1",
  projectName: "제품",
  taskId: "t1",
  content: "지난 할 일",
  taskStatus: "OPEN",
  assignee: null,
  due: "2026-09-15",
  revision: 3,
  ...over,
});
const list = (tasks: TaskEntry[]) => ({
  status: 200,
  data: { success: true, data: { tasks } },
});
const rowsOf = (client: QueryClient, key: string[]) =>
  (client.getQueryData(key) as ReturnType<typeof list>).data.data.tasks;

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(
    ["/workspaces/w1/tasks"],
    list([task(), task({ taskId: "t2", revision: 1 })])
  );
  client.setQueryData(
    ["/projects/p1/tasks"],
    list([task(), task({ taskId: "t2", revision: 1 })])
  );
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    invalidate,
    ...renderHook(() => useTaskUpdate("w1"), { wrapper }),
  };
}

describe("useTaskUpdate — 낙관적 적용", () => {
  beforeEach(() => {
    mutate.impl = async () => undefined;
    mutate.calls = [];
  });

  /** **응답을 기다리지 않고 줄에 걸린다.** 두 목록(워크스페이스·프로젝트)이 같이 바뀐다. */
  it("기한을 고치면 응답 전에 두 목록의 그 줄에 먼저 걸고, 다른 줄은 건드리지 않는다", async () => {
    let finish!: (value: unknown) => void;
    mutate.impl = () => new Promise((resolve) => (finish = resolve));
    const { client, result } = setup();

    let saved!: Promise<boolean>;
    act(() => {
      saved = result.current.save(task(), { due: "2026-09-30" });
    });

    await waitFor(() =>
      expect(rowsOf(client, ["/workspaces/w1/tasks"])[0].due).toBe("2026-09-30")
    );
    expect(rowsOf(client, ["/projects/p1/tasks"])[0].due).toBe("2026-09-30");
    expect(rowsOf(client, ["/workspaces/w1/tasks"])[1].due).toBe("2026-09-15");

    finish({
      status: 200,
      data: { success: true, data: task({ due: "2026-09-30", revision: 4 }) },
    });
    await act(async () => void (await saved));
  });

  it("성공하면 응답 행으로 갈아 끼우고, 마지막 저장이 끝난 뒤 목록을 한 번 맞춘다", async () => {
    mutate.impl = async () => ({
      status: 200,
      data: { success: true, data: task({ due: "2026-09-30", revision: 4 }) },
    });
    const { client, invalidate, result } = setup();

    await act(
      async () =>
        void (await result.current.save(task(), { due: "2026-09-30" }))
    );

    expect(rowsOf(client, ["/workspaces/w1/tasks"])[0]).toMatchObject({
      due: "2026-09-30",
      revision: 4,
    });
    expect(rowsOf(client, ["/projects/p1/tasks"])[0]).toMatchObject({
      revision: 4,
    });
    const keys = invalidate.mock.calls.map(
      ([filters]) => (filters as { queryKey: string[] }).queryKey[0]
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        "/projects/p1/tasks/t1/revisions",
        "/workspaces/w1/tasks",
        "/projects/p1/tasks",
      ])
    );
  });

  /** 한 줄이 저장 중일 때 다른 줄이 끝나도 목록을 다시 읽지 않는다 — 읽으면 저장 중인 줄의 먼저 건 값을 옛 값으로 덮는다. */
  it("다른 줄이 저장 중이면 목록 재조회를 미룬다", async () => {
    let finishA!: (value: unknown) => void;
    mutate.impl = (...args: unknown[]) => {
      const { taskId } = args[0] as { taskId: string };
      return taskId === "t1"
        ? new Promise((resolve) => (finishA = resolve))
        : Promise.resolve({
            status: 200,
            data: {
              success: true,
              data: task({ taskId: "t2", due: "2026-10-01", revision: 2 }),
            },
          });
    };
    const { invalidate, result } = setup();

    let savedA!: Promise<boolean>;
    act(() => {
      savedA = result.current.save(task(), { due: "2026-09-30" });
    });
    await waitFor(() => expect(mutate.calls.length).toBe(1));
    await act(
      async () =>
        void (await result.current.save(task({ taskId: "t2", revision: 1 }), {
          due: "2026-10-01",
        }))
    );

    const listKeysBefore = invalidate.mock.calls.filter(([filters]) =>
      ["/workspaces/w1/tasks", "/projects/p1/tasks"].includes(
        (filters as { queryKey: string[] }).queryKey[0]
      )
    );
    expect(listKeysBefore).toHaveLength(0);

    finishA({
      status: 200,
      data: { success: true, data: task({ due: "2026-09-30", revision: 4 }) },
    });
    await act(async () => void (await savedA));
    const listKeysAfter = invalidate.mock.calls.filter(([filters]) =>
      ["/workspaces/w1/tasks", "/projects/p1/tasks"].includes(
        (filters as { queryKey: string[] }).queryKey[0]
      )
    );
    expect(listKeysAfter.length).toBeGreaterThan(0);
  });

  /** 한 줄의 실패가 다른 줄의 성공을 되돌리지 않는다 — 되돌리면 그 줄의 판이 옛 값이 되어 다음 저장이 거절된다. */
  it("실패한 줄만 되돌리고 그사이 성공한 다른 줄은 그대로 둔다", async () => {
    let rejectA!: (reason: unknown) => void;
    mutate.impl = (...args: unknown[]) => {
      const { taskId } = args[0] as { taskId: string };
      return taskId === "t1"
        ? new Promise((_, reject) => (rejectA = reject))
        : Promise.resolve({
            status: 200,
            data: {
              success: true,
              data: task({ taskId: "t2", due: "2026-10-01", revision: 2 }),
            },
          });
    };
    const { client, result } = setup();

    let savedA!: Promise<boolean>;
    act(() => {
      savedA = result.current.save(task(), { due: "2026-09-30" });
    });
    await waitFor(() => expect(mutate.calls.length).toBe(1));
    await act(
      async () =>
        void (await result.current.save(task({ taskId: "t2", revision: 1 }), {
          due: "2026-10-01",
        }))
    );
    rejectA({
      success: false,
      data: null,
      error: { code: "X", message: "m" },
    });
    await act(async () => void (await savedA));

    const rows = rowsOf(client, ["/workspaces/w1/tasks"]);
    expect(rows[0].due).toBe("2026-09-15");
    expect(rows[1]).toMatchObject({ due: "2026-10-01", revision: 2 });
  });

  it("실패하면 먼저 건 값을 되돌린다", async () => {
    mutate.impl = async () => {
      throw {
        success: false,
        data: null,
        error: { code: "SOMETHING_ELSE", message: "x" },
      };
    };
    const { client, result } = setup();

    let ok = true;
    await act(
      async () =>
        void (ok = await result.current.save(task(), { due: "2026-09-30" }))
    );

    expect(ok).toBe(false);
    expect(rowsOf(client, ["/workspaces/w1/tasks"])[0].due).toBe("2026-09-15");
    expect(rowsOf(client, ["/projects/p1/tasks"])[0].due).toBe("2026-09-15");
  });

  it("판이 낡아 거절되면 되돌리고 목록을 서버 값으로 다시 읽는다", async () => {
    mutate.impl = async () => {
      throw {
        success: false,
        data: null,
        error: { code: "PROJECT_KNOWLEDGE_CONFLICT", message: "x" },
      };
    };
    const { client, invalidate, result } = setup();

    await act(
      async () =>
        void (await result.current.save(task(), { due: "2026-09-30" }))
    );

    expect(rowsOf(client, ["/workspaces/w1/tasks"])[0].due).toBe("2026-09-15");
    expect(result.current.conflictTaskId).toBe("t1");
    const keys = invalidate.mock.calls.map(
      ([filters]) => (filters as { queryKey: string[] }).queryKey[0]
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        "/workspaces/w1/tasks",
        "/projects/p1/tasks",
        "/projects/p1/tasks/t1/revisions",
      ])
    );
  });

  /** 끝내기·취소는 줄을 그 자리에 두고 먼저 긋는 연출이 있어, 응답 전에는 상태를 안 바꾼다. */
  it("끝내기는 응답 전에 상태를 바꾸지 않고 응답이 오면 바꾼다", async () => {
    let finish!: (value: unknown) => void;
    mutate.impl = () => new Promise((resolve) => (finish = resolve));
    const { client, result } = setup();

    let saved!: Promise<boolean>;
    act(() => {
      saved = result.current.save(task(), { taskStatus: "COMPLETED" });
    });
    await waitFor(() => expect(mutate.calls.length).toBeGreaterThan(0));
    expect(rowsOf(client, ["/workspaces/w1/tasks"])[0].taskStatus).toBe("OPEN");

    finish({
      status: 200,
      data: {
        success: true,
        data: task({ taskStatus: "COMPLETED", revision: 4 }),
      },
    });
    await act(async () => void (await saved));
    expect(rowsOf(client, ["/workspaces/w1/tasks"])[0]).toMatchObject({
      taskStatus: "COMPLETED",
      revision: 4,
    });
  });
});
