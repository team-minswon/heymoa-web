import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  changeSource: null,
  connection: null,
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
      taskId: "t1",
      content: "스테이징에 올린다",
      taskStatus: "OPEN",
      assignee: null,
      due: "2026-09-19",
      revision: 2,
      ...task,
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

  it("에이전트가 바꾼 판은 누구의 에이전트인지와 연결 이름을 붙여 말한다", async () => {
    revisionsQuery.fetch.mockResolvedValue(
      answer([
        revision({ changedBy: "u1", changeSource: "AGENT_CHAT" }),
        revision({
          revision: 2,
          changedBy: "u1",
          due: "2026-09-19",
          changeSource: "EXTERNAL_AGENT",
          connection: null,
        }),
        revision({
          revision: 3,
          changedBy: "u1",
          due: "2026-09-20",
          changeSource: "EXTERNAL_AGENT",
          connection: { delegationId: "d1", name: "노트북 Claude Code" },
        }),
      ])
    );
    renderSheet({ entry: entry({ revision: 3 }) });

    const items = await screen.findAllByRole("listitem");
    expect(items[0]).toHaveTextContent("이민형의 에이전트(노트북 Claude Code)가 바꿨습니다");
    expect(items[1]).toHaveTextContent("이민형의 에이전트가 바꿨습니다");
    expect(items[2]).toHaveTextContent("이민형이 HeyMoa 에이전트로 만들었습니다");
  });

  it("가장 최근 판이 외부 에이전트 변경이면 확인을 거쳐 바로 앞 판의 네 값으로 되돌린다", async () => {
    const speaker = { type: "SPEAKER_LABEL" as const, noteId: "n1", label: "C" };
    revisionsQuery.fetch.mockResolvedValue(
      answer([
        revision({ changedBy: "u1", changeSource: "MEMBER", assignee: speaker, due: "2026-09-19" }),
        revision({
          revision: 2,
          changedBy: "u1",
          changeSource: "EXTERNAL_AGENT",
          connection: { delegationId: "d1", name: "노트북 Claude Code" },
          taskStatus: "COMPLETED",
          assignee: speaker,
          due: "2026-09-25",
        }),
      ])
    );
    const { onSave } = renderSheet({ entry: entry({ taskStatus: "COMPLETED", due: "2026-09-25" }) });

    const [latest, first] = await screen.findAllByRole("listitem");
    expect(first).not.toHaveTextContent("되돌리기");
    fireEvent.click(within(latest).getByRole("button", { name: "되돌리기" }));
    const dialog = await screen.findByRole("alertdialog");
    // 바뀐 칸만 지금 → 앞 값으로 보인다
    expect(dialog).toHaveTextContent(/상태완료.*진행 중/);
    expect(dialog).toHaveTextContent(/기한9월 25일.*9월 19일/);
    expect(dialog).not.toHaveTextContent("담당");
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "되돌리기" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        content: "스테이징에 올린다",
        taskStatus: "OPEN",
        assignee: speaker,
        due: "2026-09-19",
      })
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("되돌리기는 외부 에이전트가 바꾼 가장 최근 판에만 있다", async () => {
    const agent = { changedBy: "u1", changeSource: "EXTERNAL_AGENT" as const };
    // 에이전트가 만든 판(1)은 되돌릴 앞 값이 없다
    revisionsQuery.fetch.mockResolvedValueOnce(answer([revision(agent)]));
    renderSheet({ entry: entry({ revision: 1 }) });
    await screen.findAllByRole("listitem");
    expect(screen.queryByRole("button", { name: "되돌리기" })).not.toBeInTheDocument();
    cleanup();

    // 에이전트 뒤에 사람이 고쳤으면 사람의 변경을 덮지 않는다
    revisionsQuery.fetch.mockResolvedValueOnce(
      answer([
        revision({ changedBy: "u1" }),
        revision({ ...agent, revision: 2, due: "2026-09-19" }),
        revision({ revision: 3, changedBy: "u1", changeSource: "MEMBER", due: "2026-09-20" }),
      ])
    );
    renderSheet({ entry: entry({ revision: 3 }) });
    await screen.findAllByRole("listitem");
    expect(screen.queryByRole("button", { name: "되돌리기" })).not.toBeInTheDocument();
  });

  it("이력을 불러오지 못하면 다시 시도를 두고, 누르면 다시 묻는다", async () => {
    revisionsQuery.fetch.mockResolvedValue({ status: 500, data: { success: false } });
    renderSheet();

    fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(revisionsQuery.fetch).toHaveBeenCalledTimes(2));
  });

  it("수정은 사람이 바꾼 칸만 저장하고, 빈 내용은 저장할 수 없다", async () => {
    revisionsQuery.fetch.mockResolvedValue(answer([]));
    const { onSave } = renderSheet();

    fireEvent.click(await screen.findByRole("button", { name: "수정" }));
    const input = screen.getByRole("textbox", { name: "내용" });
    fireEvent.change(input, { target: { value: "  " } });
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();

    fireEvent.change(input, { target: { value: " 운영에 올린다 " } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    // **바꾸지 않은 담당·기한은 싣지 않는다** — 편집하는 사이 남이 바꾼 값을 낡은 값으로 덮지 않게(APP-1033).
    expect(onSave).toHaveBeenCalledWith({ content: "운영에 올린다" });
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "내용" })).not.toBeInTheDocument());
  });

  it("바꾼 것이 없으면 저장하지 않고 편집만 닫는다", async () => {
    revisionsQuery.fetch.mockResolvedValue(answer([]));
    const { onSave } = renderSheet();

    fireEvent.click(await screen.findByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(onSave).not.toHaveBeenCalled();
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
