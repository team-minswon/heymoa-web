import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { revisionChanges, TaskHistorySheet } from "@/components/tasks/task-history-sheet";
import type { TaskEntry } from "@/lib/tasks/task-groups";

const revisionsQuery = vi.hoisted(() => ({ fetch: vi.fn() }));

// 생성 훅 자리에 같은 모양의 쿼리를 둔다 — 불러오는 중 · 실패 · 다시 시도가 실제 쿼리대로 돈다.
vi.mock("@/lib/api/generated/projects/projects", async (importOriginal) => {
  const { useQuery } = await import("@tanstack/react-query");
  return {
    ...(await importOriginal<object>()),
    useGetProjectTaskRevisions: () =>
      useQuery({ queryKey: ["revisions"], queryFn: () => revisionsQuery.fetch() }),
  };
});

type Revision = Parameters<typeof revisionChanges>[1];

const revision = (over: Partial<Revision>): Revision => ({
  revision: 1,
  content: "스테이징에 올린다",
  taskStatus: "OPEN",
  assignee: null,
  due: null,
  changedAt: "2026-09-16T05:00:00Z",
  changedBy: null,
  approvalId: null,
  ...over,
});

describe("revisionChanges", () => {
  it("첫 판은 무엇으로 시작했는지 담당과 기한만 보인다", () => {
    expect(
      revisionChanges(
        undefined,
        revision({
          assignee: { type: "SPEAKER_LABEL", noteId: "n1", label: "C" },
          due: "2026-09-19",
        })
      )
    ).toEqual([
      { label: "담당", before: null, after: "화자 C" },
      { label: "기한", before: null, after: "9월 19일 (토)" },
    ]);
  });

  it("다음 판부터는 달라진 칸만 앞뒤 값으로 보인다", () => {
    expect(
      revisionChanges(
        revision({}),
        revision({
          revision: 2,
          taskStatus: "COMPLETED",
          assignee: { type: "USER", id: "u1", name: "이민형" },
        })
      )
    ).toEqual([
      { label: "상태", before: "진행 중", after: "완료" },
      { label: "담당", before: "없음", after: "이민형" },
    ]);
    expect(revisionChanges(revision({}), revision({ revision: 2 }))).toEqual([]);
  });
});

describe("TaskHistorySheet", () => {
  afterEach(() => {
    cleanup();
    revisionsQuery.fetch.mockReset();
  });

  const entry = (task: Record<string, unknown> = {}) =>
    ({
      projectId: "p1",
      projectName: "제품",
      task: {
        taskId: "t1",
        content: "스테이징에 올린다",
        taskStatus: "OPEN",
        assignee: null,
        due: "2026-09-19",
        revision: 2,
        ...task,
      },
    }) as unknown as TaskEntry;

  const answer = (revisions: Revision[]) => ({
    status: 200,
    data: { success: true, data: { revisions } },
  });

  function renderSheet(props: Partial<Parameters<typeof TaskHistorySheet>[0]> = {}) {
    const onSave = vi.fn().mockResolvedValue(true);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <TaskHistorySheet
          workspaceId="w1"
          entry={entry()}
          choices={[{ type: "USER", id: "u1", name: "이민형" }]}
          pending={false}
          conflict={false}
          onSave={onSave}
          onOpenChange={vi.fn()}
          {...props}
        />
      </QueryClientProvider>
    );
    return { onSave };
  }

  it("이력을 최근 것부터 세우고, 누가 무엇을 바꿨는지 말한다", async () => {
    revisionsQuery.fetch.mockResolvedValue(
      answer([revision({ approvalId: "a1" }), revision({ revision: 2, changedBy: "u1", due: "2026-09-19" })])
    );
    renderSheet();

    const items = await screen.findAllByRole("listitem");
    expect(items[0]).toHaveTextContent("이민형이 바꿨습니다");
    expect(items[0]).toHaveTextContent(/기한없음.*9월 19일 \(토\)/);
    expect(items[1]).toHaveTextContent("회의 확정으로 생겼습니다");
  });

  it("이력을 불러오지 못하면 다시 시도를 두고, 누르면 다시 묻는다", async () => {
    revisionsQuery.fetch.mockResolvedValue({ status: 500, data: { success: false } });
    renderSheet();

    fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(revisionsQuery.fetch).toHaveBeenCalledTimes(2));
  });

  it("수정은 내용 · 담당 · 기한을 한 번에 저장하고, 빈 내용은 저장할 수 없다", async () => {
    revisionsQuery.fetch.mockResolvedValue(answer([]));
    const { onSave } = renderSheet();

    fireEvent.click(await screen.findByRole("button", { name: "수정" }));
    const input = screen.getByRole("textbox", { name: "내용" });
    fireEvent.change(input, { target: { value: "  " } });
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();

    fireEvent.change(input, { target: { value: " 운영에 올린다 " } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith({ content: "운영에 올린다", assignee: null, due: "2026-09-19" });
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "내용" })).not.toBeInTheDocument());
  });

  it("저장이 거절되면 고친 내용을 그대로 남긴다", async () => {
    revisionsQuery.fetch.mockResolvedValue(answer([]));
    renderSheet({ onSave: vi.fn().mockResolvedValue(false) });

    fireEvent.click(await screen.findByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByRole("textbox", { name: "내용" }), { target: { value: "운영에 올린다" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "저장" })).toBeEnabled());
    expect(screen.getByRole("textbox", { name: "내용" })).toHaveValue("운영에 올린다");
  });

  it("끝낸 할 일은 고칠 수 없고 다시 열 수 있으며, 판이 낡아 거절됐으면 알린다", async () => {
    revisionsQuery.fetch.mockResolvedValue(answer([]));
    const { onSave } = renderSheet({ entry: entry({ taskStatus: "COMPLETED" }), conflict: true });

    expect(await screen.findByRole("button", { name: "수정" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "취소" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 열기" }));
    expect(onSave).toHaveBeenCalledWith({ taskStatus: "OPEN" });
    expect(screen.getByRole("alert")).toHaveTextContent("다른 사람이 먼저 수정해");
  });
});
