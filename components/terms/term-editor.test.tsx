import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TERM_EXAMPLE, TermEditor } from "@/components/terms/term-editor";

const terms = [
  { termId: "1", term: "결제 승인" },
  { termId: "2", term: "핀볼" },
];

function setup(overrides: Partial<Parameters<typeof TermEditor>[0]> = {}) {
  const onAddMany = vi.fn();
  const onRemove = vi.fn();
  render(
    <TermEditor
      inputId="t"
      terms={terms}
      limit={100}
      onAddMany={onAddMany}
      onRemove={onRemove}
      {...overrides}
    />
  );
  return {
    onAddMany,
    onRemove,
    input: screen.getByRole("textbox", { name: "추가할 용어" }),
  };
}

const type = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });

afterEach(cleanup);

describe("TermEditor 여러 개 한 번에", () => {
  it("쉼표로 나눈 글을 쓰면 미리보기 칩과 요약이 생기고 버튼이 「n개 추가」가 된다", () => {
    const { input } = setup();
    expect(input).toHaveAttribute(
      "placeholder",
      expect.stringContaining(TERM_EXAMPLE)
    );
    expect(screen.getByRole("button", { name: "추가" })).toBeDisabled();

    type(input, "kubernetes, k8s, 헬름 차트");
    const preview = screen.getByLabelText("추가할 용어 미리보기");
    expect(preview).toHaveTextContent("kubernetes");
    expect(preview).toHaveTextContent("헬름 차트");
    expect(screen.getByText("새로 3개")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3개 추가" })).toBeEnabled();
  });

  it("이미 있는 것 · 입력 안 중복 · 40자 초과는 건너뛰고 요약에 센다", () => {
    const { input } = setup();
    type(input, `핀볼, PG사, pg사, ${"가".repeat(41)}`);
    expect(screen.getByText("새로 1개")).toBeInTheDocument();
    expect(screen.getByText("이미 있어요 2개")).toBeInTheDocument();
    expect(screen.getByText("40자를 넘어 제외 1개")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1개 추가" })).toBeEnabled();
  });

  it("Enter 로 새 용어만 한 번에 넘기고 입력란을 비운다. Shift+Enter·한글 조합 중 Enter 는 추가하지 않는다", () => {
    const { input, onAddMany } = setup();
    type(input, "A,\nB;\tC, 핀볼");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 });
    expect(onAddMany).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAddMany).toHaveBeenCalledTimes(1);
    expect(onAddMany.mock.calls[0][0]).toEqual(["A", "B", "C"]);
    expect(input).toHaveValue("");
  });

  it("용어 하나만 적어도 Enter 로 들어간다", () => {
    const { input, onAddMany } = setup();
    type(input, "PG사");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAddMany.mock.calls[0][0]).toEqual(["PG사"]);
  });

  it("추가할 새 용어가 없으면 Enter 도 버튼도 아무 일 없다", () => {
    const { input, onAddMany } = setup();
    type(input, "핀볼");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAddMany).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "추가" })).toBeDisabled();
  });

  it("한도 직전이면 남은 자리만큼만 새 용어로 세고 나머지는 한도 초과로 알린다", () => {
    const { input, onAddMany } = setup({ limit: 4 });
    type(input, "A, B, C");
    expect(screen.getByText("새로 2개")).toBeInTheDocument();
    expect(screen.getByText("한도를 넘어 못 넣어요 1개")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2개 추가" }));
    expect(onAddMany.mock.calls[0][0]).toEqual(["A", "B"]);
  });

  it("실패하면 입력란이 비어 있을 때 보낸 용어를 돌려놓는다", () => {
    const { input, onAddMany } = setup();
    type(input, "A, B");
    fireEvent.keyDown(input, { key: "Enter" });
    onAddMany.mock.calls[0][1].onFailed(["A", "B"]);
    return screen.findByDisplayValue("A, B");
  });

  it("한도에 닿으면 입력을 막고 안내한다", () => {
    const { input } = setup({ limit: 2 });
    expect(input).toBeDisabled();
    expect(screen.getByText(/다 채웠어요/)).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 2/)).toBeInTheDocument();
  });

  it("비어 있으면 「예시 넣어 보기」가 예시를 입력란에 넣는다", () => {
    const { input } = setup({ terms: [] });
    fireEvent.click(screen.getByRole("button", { name: "예시 넣어 보기" }));
    expect(input).toHaveValue(TERM_EXAMPLE);
    expect(screen.getByText("새로 3개")).toBeInTheDocument();
  });

  it("용어 찾기로 등록한 칩을 거른다", async () => {
    setup();
    fireEvent.change(screen.getByRole("textbox", { name: "용어 찾기" }), {
      target: { value: "핀" },
    });
    const list = screen.getByRole("list", { name: "넣은 용어" });
    expect(list).toHaveTextContent("핀볼");
    // 빠지는 칩은 퇴장 애니메이션이 끝나야 사라진다
    await waitFor(() => expect(list).not.toHaveTextContent("결제 승인"));
  });

  it("진행 중이면 「12 / 40 추가 중」을 보인다", () => {
    setup({ progress: { done: 12, total: 40 } });
    expect(screen.getByText("12 / 40 추가 중")).toBeInTheDocument();
  });
});
