import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskChangeSuggestion } from "@/components/notes/review/suggestion-row";

type Props = Parameters<typeof TaskChangeSuggestion>[0];

const change: Props["change"] = {
  target: { itemId: "task", revision: 3, originalProposalRef: null },
  status: "COMPLETED", assignee: { value: null }, due: { value: null },
  reason: "회의에서 확인한 변경", decision: null, draft: null,
};
const task: Props["task"] = {
  taskId: "task", projectId: "project", projectName: "프로젝트", content: "기존 업무",
  taskStatus: "OPEN", assignee: { type: "USER", id: "user", name: "민수" },
  due: "2026-10-20", revision: 3,
};

function props(over: Partial<Props> = {}): Props {
  return {
    change, task, noteId: "note", choices: [{ type: "USER", id: "user", name: "민수" }],
    choice: null, taskState: "ready", onRetryTask: vi.fn(), disabled: false,
    onChoose: vi.fn().mockResolvedValue(true), ...over,
  };
}

afterEach(cleanup);

describe("기존 할 일 변경 초안", () => {
  it("업무 mutation 없이 검토 초안만 저장하고 반영에서 넘기기로 다시 고를 수 있다", () => {
    const initial = props();
    const { rerender } = render(<TaskChangeSuggestion {...initial} />);
    fireEvent.click(screen.getByRole("radio", { name: "반영" }));
    const draft = { expectedRevision: 3, status: "COMPLETED" as const, assignee: { value: null }, due: { value: null } };
    expect(initial.onChoose).toHaveBeenCalledWith("change", draft);

    rerender(<TaskChangeSuggestion {...initial} choice="change" change={{ ...change, decision: "APPLY", draft }} />);
    expect(screen.getByText("검토 완료 때 적용됩니다.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "반영 예정" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "넘기기" }));
    expect(initial.onChoose).toHaveBeenLastCalledWith("keep", draft);
  });

  it("편집한 기한을 즉시 초안에 저장하며 대상의 원래 판을 유지한다", () => {
    const initial = props();
    const { container } = render(<TaskChangeSuggestion {...initial} />);
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: "2026-10-30" } });
    expect(initial.onChoose).toHaveBeenCalledWith("change", expect.objectContaining({
      expectedRevision: 3, due: { value: "2026-10-30" },
    }));
  });

  it("대상 업무의 판이 바뀌면 반영과 편집을 막고 넘기기로 회복할 수 있다", () => {
    const initial = props({ task: { ...task!, revision: 9 }, choice: "change", change: { ...change, decision: "APPLY" } });
    const { container } = render(<TaskChangeSuggestion {...initial} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/넘기기/);
    expect(screen.getByRole("radio", { name: "반영 예정" })).toBeDisabled();
    expect(container.querySelector('input[type="date"]')).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "넘기기" }));
    expect(initial.onChoose).toHaveBeenCalledWith("keep", expect.objectContaining({ expectedRevision: 3 }));
  });

  it("재조회한 초안의 사람 참조를 이름으로 표시하고 제안 원문보다 초안을 우선한다", () => {
    const draft = { expectedRevision: 3, status: null, assignee: { value: { type: "USER" as const, id: "user", label: null } }, due: { value: "2026-10-30" } };
    const initial = props({ choice: "keep", change: { ...change, decision: "KEEP", draft } });
    render(<TaskChangeSuggestion {...initial} />);
    expect(screen.getByRole("combobox", { name: "담당 민수 바꾸기" })).toBeInTheDocument();
    expect(screen.queryByText("완료", { exact: true })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "반영" }));
    expect(initial.onChoose).toHaveBeenCalledWith("change", { ...draft, assignee: { value: { type: "USER", id: "user" } } });
  });

  it("늦게 도착한 담당·기한 제안을 새 값으로 표시한다", () => {
    const initial = props({ change: { ...change, assignee: null, due: null } });
    const { rerender } = render(<TaskChangeSuggestion {...initial} />);
    expect(screen.queryByRole("combobox", { name: "담당 민수 바꾸기" })).not.toBeInTheDocument();
    rerender(<TaskChangeSuggestion {...initial} change={{ ...change, assignee: { value: task!.assignee! } }} />);
    expect(screen.getByRole("combobox", { name: "담당 민수 바꾸기" })).toBeInTheDocument();
  });

  it("예전에 이미 반영한 APPLIED는 다시 고르거나 편집할 수 없다", () => {
    const initial = props({ choice: "change", change: { ...change, decision: "APPLIED" } });
    const { container } = render(<TaskChangeSuggestion {...initial} />);
    expect(screen.getByRole("radio", { name: "반영됨" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "넘기기" })).toBeDisabled();
    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(screen.queryByText("검토 완료 때 적용됩니다.")).not.toBeInTheDocument();
  });
});
