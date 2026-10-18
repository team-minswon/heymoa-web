import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TermEditor } from "@/components/terms/term-editor";

const terms = [
  { termId: "1", term: "결제 승인" },
  { termId: "2", term: "핀볼" },
];

function setup(overrides: Partial<Parameters<typeof TermEditor>[0]> = {}) {
  const onAdd = vi.fn();
  const onRemove = vi.fn();
  render(
    <TermEditor
      inputId="t"
      terms={terms}
      limit={100}
      onAdd={onAdd}
      onRemove={onRemove}
      {...overrides}
    />
  );
  return { onAdd, onRemove, input: screen.getByRole("textbox") };
}

afterEach(cleanup);

describe("TermEditor", () => {
  it("입력하는 동안 같은 사전·워크스페이스 사전의 중복을 알리고 추가를 막는다", () => {
    const { input, onAdd } = setup({
      blockedReason: (term) =>
        term.toLowerCase() === "mcp"
          ? "워크스페이스 용어 사전에 이미 있어요"
          : null,
    });
    fireEvent.change(input, { target: { value: " 핀볼 " } });
    expect(screen.getByText("이미 있어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "추가" })).toBeDisabled();

    fireEvent.change(input, { target: { value: "MCP" } });
    expect(
      screen.getByText("워크스페이스 용어 사전에 이미 있어요")
    ).toBeInTheDocument();
    fireEvent.submit(input.closest("form")!);
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "PG사" } });
    fireEvent.submit(input.closest("form")!);
    expect(onAdd).toHaveBeenCalledWith("PG사", expect.any(Function));
    expect(input).toHaveValue("");
  });

  it("여러 줄을 붙여 넣으면 남은 자리만큼 줄마다 더하고 결과를 알린다", () => {
    const { input, onAdd } = setup({ limit: 4 });
    fireEvent.paste(input, {
      clipboardData: { getData: () => "A\n핀볼\nB\nC" },
    });
    expect(onAdd.mock.calls.map(([term]) => term)).toEqual(["A", "B"]);
    expect(
      screen.getByText(
        "2개를 더했어요 · 1개는 이미 있어요 · 1개는 한도를 넘어 못 넣었어요"
      )
    ).toBeInTheDocument();
  });

  it("한도에 닿으면 입력을 막고 남은 개수를 본문에 보인다", () => {
    const { input } = setup({ limit: 2 });
    expect(input).toBeDisabled();
    expect(screen.getByText(/다 채웠어요/)).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 2/)).toBeInTheDocument();
  });

  it("워크스페이스에도 있는 칩을 세어 목록 아래 한 줄로 알린다", () => {
    setup({
      isDimmed: (item) => item.term === "핀볼",
      dimmedNote: (count) => `${count}개는 워크스페이스 사전에도 있어요`,
    });
    expect(
      screen.getByText("1개는 워크스페이스 사전에도 있어요")
    ).toBeInTheDocument();
  });
});
