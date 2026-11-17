import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTaskUpdate } from "@/components/tasks/use-task-update";
import type { TaskEntry } from "@/lib/tasks/task-groups";

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
  externalAgentChange: null,
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

    expect(rowsOf(client, ["/workspaces/w1/tasks"]).map((row) => row.taskId)).toEqual([
      "t2",
      "t1",
    ]);
    expect(
      rowsOf(client, ["/workspaces/w1/tasks"]).find((row) => row.taskId === "t1")
    ).toMatchObject({ due: "2026-09-30", revision: 4 });
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

  it("충돌이어도 다른 줄이 저장 중이면 목록 재조회를 지금 하지 않는다", async () => {
    let finishA!: (value: unknown) => void;
    mutate.impl = (...args: unknown[]) => {
      const { taskId } = args[0] as { taskId: string };
      if (taskId === "t1") return new Promise((resolve) => (finishA = resolve));
      return Promise.reject({
        success: false,
        data: null,
        error: { code: "PROJECT_KNOWLEDGE_CONFLICT", message: "x" },
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

    const lists = () =>
      invalidate.mock.calls.filter(([filters]) =>
        ["/workspaces/w1/tasks", "/projects/p1/tasks"].includes(
          (filters as { queryKey: string[] }).queryKey[0]
        )
      );
    expect(lists()).toHaveLength(0);

    finishA({
      status: 200,
      data: { success: true, data: task({ due: "2026-09-30", revision: 4 }) },
    });
    await act(async () => void (await savedA));
    expect(lists().length).toBeGreaterThan(0);
  });

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

describe("useTaskUpdate — 거른 목록과 개수", () => {
  beforeEach(() => {
    mutate.impl = async () => undefined;
    mutate.calls = [];
  });

  const counts = { open: 5, completed: 2, cancelled: 1 };
  const keyOf = (scope: Record<string, unknown>) => [
    "/workspaces/w1/tasks",
    { limit: 30, pages: 1, ...scope },
  ];
  const paged = (tasks: TaskEntry[], over: Record<string, unknown> = {}) => ({
    status: 200,
    data: {
      success: true,
      data: { tasks, counts, totalCount: 0, hasMore: false, ...over },
    },
  });
  const dataOf = (client: QueryClient, key: unknown[]) =>
    (
      client.getQueryData(key) as {
        data: { data: { tasks: TaskEntry[]; counts: typeof counts; totalCount: number } };
      }
    ).data.data;

  function setupPaged() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const mine = task({ assignee: { type: "USER", id: "me", name: "나" } });
    client.setQueryData(keyOf({ status: "OPEN" }), paged([mine, task({ taskId: "t2" })], { totalCount: 5 }));
    client.setQueryData(keyOf({ status: "OPEN", assigneeUserId: "me" }), paged([mine], { totalCount: 5 }));
    client.setQueryData(keyOf({ status: "COMPLETED" }), paged([], { totalCount: 2 }));
    client.setQueryData(keyOf({ status: "OPEN", projectId: "p9" }), paged([], { totalCount: 5 }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, mine, ...renderHook(() => useTaskUpdate("w1"), { wrapper }) };
  }

  it("끝내면 진행 중 탭에서 빠지고 개수가 옮겨 가며, 읽지 않은 다른 탭의 개수도 같이 옮겨 간다", async () => {
    const { client, mine, result } = setupPaged();
    mutate.impl = async () => ({
      status: 200,
      data: { success: true, data: { ...mine, taskStatus: "COMPLETED", revision: 4 } },
    });

    await act(async () => void (await result.current.save(mine, { taskStatus: "COMPLETED" })));

    const open = dataOf(client, keyOf({ status: "OPEN" }));
    expect(open.tasks.map((row) => row.taskId)).toEqual(["t2"]);
    expect(open.counts).toEqual({ open: 4, completed: 3, cancelled: 1 });
    expect(open.totalCount).toBe(4);
    const completed = dataOf(client, keyOf({ status: "COMPLETED" }));
    expect(completed.tasks.map((row) => row.taskId)).toEqual(["t1"]);
    expect(completed.totalCount).toBe(3);
    expect(dataOf(client, keyOf({ status: "OPEN", assigneeUserId: "me" })).counts).toEqual({
      open: 4,
      completed: 3,
      cancelled: 1,
    });
    expect(dataOf(client, keyOf({ status: "OPEN", projectId: "p9" })).counts).toEqual(counts);
  });

  it("담당을 다른 사람으로 바꾸면 내 할 일 탭에서 빠지고, 응답이 오기 전에는 건드리지 않는다", async () => {
    const { client, mine, result } = setupPaged();
    let finish!: (value: unknown) => void;
    mutate.impl = () => new Promise((resolve) => (finish = resolve));

    let saved!: Promise<boolean>;
    act(() => {
      saved = result.current.save(mine, { assignee: { type: "USER", id: "you", name: "너" } });
    });
    await waitFor(() =>
      expect(dataOf(client, keyOf({ status: "OPEN", assigneeUserId: "me" })).tasks[0].assignee).toMatchObject({
        id: "you",
      })
    );
    expect(dataOf(client, keyOf({ status: "OPEN", assigneeUserId: "me" })).counts).toEqual(counts);

    finish({
      status: 200,
      data: {
        success: true,
        data: { ...mine, assignee: { type: "USER", id: "you", name: "너" }, revision: 4 },
      },
    });
    await act(async () => void (await saved));

    const mineTab = dataOf(client, keyOf({ status: "OPEN", assigneeUserId: "me" }));
    expect(mineTab.tasks).toEqual([]);
    expect(mineTab.counts.open).toBe(4);
    expect(dataOf(client, keyOf({ status: "OPEN" })).counts.open).toBe(5);
  });

  it("쪽이 남았고 정렬 자리가 읽은 범위 뒤인 줄은 끼우지 않고 개수만 옮긴다", async () => {
    const { client, mine, result } = setupPaged();
    client.setQueryData(
      keyOf({ status: "COMPLETED" }),
      paged([task({ taskId: "t7", taskStatus: "COMPLETED", due: "2026-09-01" })], {
        hasMore: true,
        totalCount: 40,
        counts: { open: 5, completed: 40, cancelled: 1 },
      })
    );
    mutate.impl = async () => ({
      status: 200,
      data: { success: true, data: { ...mine, taskStatus: "COMPLETED", revision: 4 } },
    });

    await act(async () => void (await result.current.save(mine, { taskStatus: "COMPLETED" })));

    const completed = dataOf(client, keyOf({ status: "COMPLETED" }));
    expect(completed.tasks.map((row) => row.taskId)).toEqual(["t7"]);
    expect(completed.totalCount).toBe(41);
  });

  it("이미 그 판의 줄을 든 항목은 개수를 다시 옮기지 않는다", async () => {
    const { client, mine, result } = setupPaged();
    const done = { ...mine, taskStatus: "COMPLETED" as const, revision: 4 };
    client.setQueryData(keyOf({ status: "COMPLETED" }), paged([done], { totalCount: 3, counts: { open: 4, completed: 3, cancelled: 1 } }));
    mutate.impl = async () => ({ status: 200, data: { success: true, data: done } });

    await act(async () => void (await result.current.save(mine, { taskStatus: "COMPLETED" })));

    const completed = dataOf(client, keyOf({ status: "COMPLETED" }));
    expect(completed.counts).toEqual({ open: 4, completed: 3, cancelled: 1 });
    expect(completed.totalCount).toBe(3);
  });

  it("읽은 범위의 마지막 줄을 뒤로 밀면 빼고, 내용만 고치면 그 자리에 남긴다", async () => {
    const { client, result } = setupPaged();
    const t1 = task({ taskId: "t1", due: "2026-09-10" });
    const t2 = task({ taskId: "t2", due: "2026-09-11" });
    client.setQueryData(keyOf({ status: "OPEN" }), paged([t1, t2], { hasMore: true, totalCount: 5 }));

    mutate.impl = async () => ({ status: 200, data: { success: true, data: { ...t2, due: null, revision: 4 } } });
    await act(async () => void (await result.current.save(t2, { due: null })));
    expect(dataOf(client, keyOf({ status: "OPEN" })).tasks.map((row) => row.taskId)).toEqual(["t1"]);

    client.setQueryData(keyOf({ status: "OPEN" }), paged([t1, t2], { hasMore: true, totalCount: 5 }));
    mutate.impl = async () => ({ status: 200, data: { success: true, data: { ...t2, content: "고침", revision: 4 } } });
    await act(async () => void (await result.current.save(t2, { content: "고침" })));
    expect(dataOf(client, keyOf({ status: "OPEN" })).tasks.map((row) => row.taskId)).toEqual(["t1", "t2"]);
  });
});
