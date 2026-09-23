import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AllTasks } from "@/components/tasks/all-tasks";

const mutate = vi.hoisted(() => vi.fn());
const createTask = vi.hoisted(() => vi.fn());
const stalledProject = vi.hoisted(() => ({ id: "" }));
const TASKS = vi.hoisted(() => ({
  p1: [
    { taskId: "t1", content: "지난 할 일", taskStatus: "OPEN", assignee: null, due: "2026-09-15", revision: 3 },
    {
      taskId: "t2",
      content: "이번 주 할 일",
      taskStatus: "OPEN",
      assignee: { type: "USER", id: "me", name: "나" },
      due: "2026-09-18",
      revision: 1,
    },
  ],
  p2: [
    { taskId: "t3", content: "다음 주 할 일", taskStatus: "OPEN", assignee: null, due: "2026-09-25", revision: 1 },
    { taskId: "t4", content: "기한 없는 할 일", taskStatus: "OPEN", assignee: null, due: null, revision: 1 },
    { taskId: "t5", content: "끝낸 할 일", taskStatus: "COMPLETED", assignee: null, due: null, revision: 2 },
    { taskId: "t6", content: "접은 할 일", taskStatus: "CANCELLED", assignee: null, due: null, revision: 2 },
  ],
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { userId: "me", name: "나", email: "me@heymoa.com", image: null } }),
}));
vi.mock("@/components/workspace/workspace-app-shell", () => ({
  useWorkspaceShell: () => ({
    projects: [
      { projectId: "p1", name: "제품" },
      { projectId: "p2", name: "리서치" },
    ],
    isWorkspacePending: false,
  }),
}));
vi.mock("@/lib/assignees/use-assignee-choices", () => ({
  useAssigneeChoices: () => ({ choices: [], isPending: false }),
}));
vi.mock("@/lib/ui/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/api/generated/projects/projects", () => ({
  getGetProjectTasksQueryKey: (_: string, projectId: string) => [`tasks/${projectId}`],
  getGetProjectTasksQueryOptions: (_: string, projectId: "p1" | "p2") => ({
    queryKey: [`tasks/${projectId}`],
    queryFn: async () => {
      if (stalledProject.id === projectId) return new Promise(() => {});
      return {
        status: 200,
        data: { success: true, data: { tasks: TASKS[projectId] }, error: null },
      };
    },
  }),
  getGetProjectTaskRevisionsQueryKey: () => ["revisions"],
  useGetProjectTaskRevisions: () => ({
    data: { status: 200, data: { success: true, data: { revisions: [] } } },
    isPending: false,
    refetch: vi.fn(),
  }),
  useUpdateProjectTask: () => ({ mutateAsync: mutate, isPending: false, variables: undefined }),
  useCreateProjectTask: () => ({ mutate: createTask, isPending: false }),
}));

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AllTasks workspaceId="w1" />
    </QueryClientProvider>
  );
}

const savedData = () => mutate.mock.calls.at(-1)?.[0]?.data;

describe("AllTasks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-16T03:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    mutate.mockReset();
    createTask.mockReset();
    stalledProject.id = "";
    cleanup();
  });

  it("다른 프로젝트의 첫 조회가 남아 있어도 받은 할 일은 스켈레톤으로 덮지 않는다", async () => {
    stalledProject.id = "p2";
    renderScreen();

    expect(await screen.findByText("지난 할 일")).toBeTruthy();
    expect(screen.queryByLabelText("할 일 불러오는 중")).toBeNull();

    // 받은 행이 있어도 현재 보기에 맞는 행이 없다면 아직 빈 상태라고 단정할 수 없다.
    fireEvent.click(screen.getByRole("radio", { name: "완료" }));
    expect(screen.getByLabelText("할 일 불러오는 중")).toBeTruthy();
    expect(screen.queryByText("완료한 할 일이 없습니다.")).toBeNull();
  });

  it("프로젝트를 섞어 기한 묶음 차례로 세우고 개수를 붙인다", async () => {
    renderScreen();
    await screen.findByText("지난 할 일");

    const regions = screen.getAllByRole("region");
    expect(regions.map((region) => region.getAttribute("aria-label"))).toEqual([
      "기한 지남",
      "이번 주",
      "다음 주 이후",
      "기한 없음",
    ]);
    expect(within(regions[0]).getByText("1")).toBeTruthy();
    expect(within(regions[2]).getByText("리서치")).toBeTruthy();
    expect(screen.queryByText("끝낸 할 일")).toBeNull();
    expect(screen.getByText("프로젝트 2개 · 진행 중 4개")).toBeTruthy();
  });

  it("상태를 바꾸면 그 상태의 할 일만 한 줄로 늘어놓고, 거르기와 함께 개수가 바뀐다", async () => {
    renderScreen();
    await screen.findByText("지난 할 일");
    expect(screen.getByRole("radio", { name: "진행 중 4" })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("radio", { name: "완료 1" }));
    expect(screen.getByText("끝낸 할 일")).toBeTruthy();
    expect(screen.queryByText("지난 할 일")).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "취소 1" }));
    expect(screen.getByText("접은 할 일")).toBeTruthy();
    expect(screen.queryByText("끝낸 할 일")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "내 할 일" }));
    expect(screen.getByRole("radio", { name: "취소 0" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "진행 중 1" })).toBeTruthy();
    expect(screen.getByText("조건에 맞는 할 일이 없습니다.")).toBeTruthy();
  });

  it("내 할 일을 누르면 내게 걸린 할 일만 남는다", async () => {
    renderScreen();
    await screen.findByText("지난 할 일");

    fireEvent.click(screen.getByRole("button", { name: "내 할 일" }));

    expect(screen.queryByText("지난 할 일")).toBeNull();
    expect(screen.getByText("이번 주 할 일")).toBeTruthy();
    expect(screen.getByText("프로젝트 2개 · 진행 중 1개")).toBeTruthy();
  });

  it("기한을 고치면 읽은 판으로 전체 본문을 보낸다", async () => {
    renderScreen();
    const row = (await screen.findByText("지난 할 일")).closest("li")!;
    fireEvent.change(row.querySelector('input[type="date"]')!, {
      target: { value: "2026-09-30" },
    });

    expect(mutate).toHaveBeenCalledWith({
      workspaceId: "w1",
      projectId: "p1",
      taskId: "t1",
      data: {
        content: "지난 할 일",
        taskStatus: "OPEN",
        assignee: null,
        due: "2026-09-30",
        revision: 3,
      },
    });
  });

  it("줄의 동그라미는 완료로, 이력 시트의 취소는 취소로 같은 판을 보낸다", async () => {
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "지난 할 일 완료로 표시" }));
    expect(savedData()).toMatchObject({ taskStatus: "COMPLETED", revision: 3 });

    fireEvent.click(screen.getByRole("button", { name: "다음 주 할 일" }));
    fireEvent.click(await screen.findByRole("button", { name: "취소" }));
    expect(mutate.mock.calls.at(-1)?.[0]).toMatchObject({
      taskId: "t3",
      data: { taskStatus: "CANCELLED", revision: 1 },
    });
  });

  it("여러 줄을 잇달아 저장하면 각 줄이 제 저장이 끝날 때까지 잠긴다", async () => {
    let finishFirst!: () => void;
    mutate
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst = resolve)))
      .mockImplementationOnce(() => new Promise<void>(() => {}));
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "지난 할 일 완료로 표시" }));
    fireEvent.click(screen.getByRole("button", { name: "이번 주 할 일 완료로 표시" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "지난 할 일 완료로 표시" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "이번 주 할 일 완료로 표시" })).toBeDisabled();

    finishFirst();
    await waitFor(() => expect(screen.getByRole("button", { name: "지난 할 일 완료로 표시" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "이번 주 할 일 완료로 표시" })).toBeDisabled();
  });

  it("판이 낡아 거절되면 그 줄에 알린다", async () => {
    mutate.mockRejectedValue({
      success: false,
      data: null,
      error: { code: "PROJECT_KNOWLEDGE_CONFLICT", message: "프로젝트 승인 기준이 변경되었습니다." },
    });
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "지난 할 일 완료로 표시" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("다른 사람이 먼저 수정해");
    expect(screen.getByText("지난 할 일").closest("li")!.contains(alert)).toBe(true);
  });

  it("할 일 추가는 고른 프로젝트에 내용 · 담당 · 기한으로 만든다", async () => {
    renderScreen();
    await screen.findByText("지난 할 일");

    fireEvent.click(screen.getByRole("button", { name: "할 일 추가" }));
    fireEvent.change(await screen.findByLabelText("내용"), { target: { value: "  새 할 일 " } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(createTask).toHaveBeenCalledWith(
      { workspaceId: "w1", projectId: "p1", data: { content: "새 할 일", assignee: null, due: null } },
      expect.anything()
    );
  });
});
