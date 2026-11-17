import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ui/toast", () => ({ toast: { error: toastError } }));

import { ChatComposer } from "@/components/chat/chat-composer";
import type { MentionHandle } from "@/components/chat/mention-input";
import type { ScopeChip } from "@/lib/chat/scope-chip";
import type { ScopeCandidate } from "@/lib/chat/use-scope-catalog";

afterEach(cleanup);

const CANDIDATES = {
  projects: [
    { kind: "project", id: "p1", title: "결제 개편" } as ScopeCandidate,
  ],
  notes: [
    {
      kind: "note",
      id: "n1",
      title: "주간 배포 회의",
      projectId: "p1",
    } as ScopeCandidate,
  ],
};

function renderComposer(
  props: Partial<React.ComponentProps<typeof ChatComposer>> = {}
) {
  const ref = createRef<MentionHandle>();
  const utils = render(
    <ChatComposer
      inputRef={ref}
      onSubmit={vi.fn()}
      onStop={vi.fn()}
      isBusy={false}
      isStreaming={false}
      placeholder="@로 프로젝트나 회의록을 붙여 물어보세요"
      onChipsChange={vi.fn()}
      scope={{
        candidates: CANDIDATES,
        isPending: false,
        taken: new Set<string>(),
      }}
      {...props}
    />
  );
  return { ...utils, ref, input: screen.getByRole("textbox") };
}

function write(input: HTMLElement, text: string) {
  input.textContent = text;
  const range = document.createRange();
  range.selectNodeContents(input);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  fireEvent.input(input);
}

describe("ChatComposer", () => {
  it("Enter로 보내고 Shift+Enter는 줄바꿈이다", () => {
    const onSubmit = vi.fn();
    const { input } = renderComposer({ onSubmit });
    write(input, "안녕");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith({ text: "안녕", chips: [] });
  });

  it("한글 조합 중 Enter는 전송하지 않는다", () => {
    const onSubmit = vi.fn();
    const { input } = renderComposer({ onSubmit });
    write(input, "네");
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("isComposing 플래그만 오는 브라우저에서도 막는다", () => {
    const onSubmit = vi.fn();
    const { input } = renderComposer({ onSubmit });
    write(input, "네");
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("빈 문장은 보내지 않는다", () => {
    const onSubmit = vi.fn();
    const { input } = renderComposer({ onSubmit });
    write(input, "   ");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("답변이 흐르는 동안에도 입력은 열려 있다", () => {
    const { input } = renderComposer({ isBusy: true, isStreaming: true });
    expect(input.getAttribute("contenteditable")).toBe("true");
  });

  it("답변이 흐르는 동안 Enter는 보내지 않는다", () => {
    const onSubmit = vi.fn();
    const { input } = renderComposer({ isBusy: true, onSubmit });
    write(input, "다음 질문");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("@ 뒤 글자로 프로젝트와 회의록을 함께 좁힌다", () => {
    const { input } = renderComposer();
    write(input, "지난 @주간");
    expect(screen.getByTestId("scope-picker")).toBeTruthy();
    expect(screen.getByText("주간 배포 회의")).toBeTruthy();
    expect(screen.queryByText("결제 개편")).toBeNull();
  });

  it("제목에 공백이 있어도 이어서 좁힐 수 있다", () => {
    const { input } = renderComposer();
    write(input, "@주간 배포");
    expect(screen.getByTestId("scope-picker")).toBeTruthy();
    expect(screen.getByText("주간 배포 회의")).toBeTruthy();
  });

  it("맞는 것이 없으면 멘션이 끝난 것으로 본다", () => {
    const onSubmit = vi.fn();
    const { input } = renderComposer({ onSubmit });
    write(input, "@주간 배포 회의에서 정한 게 뭐야");
    expect(screen.queryByTestId("scope-picker")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalled();
  });

  it("목록이 오기 전에는 Enter 를 잡아 둔다", () => {
    const onSubmit = vi.fn();
    const { input } = renderComposer({
      onSubmit,
      scope: {
        candidates: { projects: [], notes: [] },
        isPending: true,
        taken: new Set<string>(),
      },
    });
    write(input, "이 @주간");
    expect(screen.getByTestId("scope-picker").textContent).toContain(
      "불러오는 중"
    );
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("scope가 없으면 @를 쳐도 피커가 안 열린다", () => {
    const { input } = renderComposer({ scope: undefined });
    write(input, "@주간");
    expect(screen.queryByTestId("scope-picker")).toBeNull();
  });

  it("피커가 열려 있으면 Enter가 전송하지 않는다", () => {
    const onSubmit = vi.fn();
    const { input } = renderComposer({ onSubmit });
    write(input, "이 @주간");
    expect(screen.getByTestId("scope-picker")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("피커가 먹은 Enter는 편집기까지 가지 않는다", () => {
    const onSubmit = vi.fn();
    const { input } = renderComposer({ onSubmit });
    write(input, "이 @주간");

    const seen: string[] = [];
    const spy = (event: Event) => seen.push((event as KeyboardEvent).key);
    document.addEventListener("keydown", spy);
    fireEvent.keyDown(input, { key: "Enter" });
    document.removeEventListener("keydown", spy);

    expect(seen).toEqual([]);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.querySelectorAll("[data-scope-chip]")).toHaveLength(1);
  });

  it("피커를 닫으면 Enter가 다시 전송한다", () => {
    const onSubmit = vi.fn();
    const { input } = renderComposer({ onSubmit });
    write(input, "이 @주간");
    fireEvent.keyDown(document, { key: "Escape" });
    write(input, "이 회의");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith({ text: "이 회의", chips: [] });
  });

  it("고르면 @질의가 문장에서 사라지고 그 자리가 마커가 된다", () => {
    const { input, ref } = renderComposer();
    write(input, "이 @주간");
    fireEvent.click(screen.getByText("주간 배포 회의"));

    expect(ref.current?.read().text).toBe("이 @[주간 배포 회의](noteId:n1)");
    expect(screen.queryByTestId("scope-picker")).toBeNull();
    expect(input.querySelectorAll("[data-scope-chip]")).toHaveLength(1);
  });

  it("칩 뒤에 공백이 하나 붙고 캐럿이 그 뒤에 선다", () => {
    const { input, ref } = renderComposer();
    write(input, "이 @주간");
    fireEvent.click(screen.getByText("주간 배포 회의"));

    const chip = input.querySelector("[data-scope-chip]");
    expect(chip?.nextSibling?.textContent).toBe(" ");
    expect(ref.current?.read().chips).toHaveLength(1);
  });

  it("고르면 칩이 문장 안에 박힌다", () => {
    const onChipsChange = vi.fn();
    const { input, ref } = renderComposer({ onChipsChange });
    write(input, "이 @주간");
    fireEvent.click(screen.getByText("주간 배포 회의"));

    expect(input.querySelector("[data-scope-chip]")).toBeTruthy();
    expect(ref.current?.read().chips).toEqual([
      { kind: "note", id: "n1", title: "주간 배포 회의" },
    ]);
  });

  it("프로젝트와 회의록 칩을 갈라 그린다", () => {
    const { input, ref } = renderComposer();
    ref.current?.prepend({ kind: "note", id: "n1", title: "주간 배포 회의" });
    ref.current?.prepend({ kind: "project", id: "p1", title: "결제 개편" });
    const note = input.querySelector('[data-scope-chip="note"]');
    const project = input.querySelector('[data-scope-chip="project"]');
    expect(note).toBeTruthy();
    expect(project).toBeTruthy();
    expect(note?.className).not.toBe(project?.className);
  });

  it("같은 것을 두 번 박아도 배열에는 한 번이다", () => {
    const { ref } = renderComposer();
    ref.current?.prepend({ kind: "note", id: "n1", title: "주간 배포 회의" });
    ref.current?.prepend({ kind: "note", id: "n1", title: "주간 배포 회의" });
    expect(ref.current?.read().chips).toHaveLength(1);
  });

  it("범위를 20개 넘게 못 붙인다", () => {
    const many = Array.from({ length: 25 }, (_, index) => ({
      kind: "note",
      id: `n${index}`,
      title: `회의 ${index}`,
    })) as ScopeCandidate[];
    const { input, ref } = renderComposer({
      scope: {
        candidates: { projects: [], notes: many },
        isPending: false,
        taken: new Set<string>(),
      },
    });

    write(input, "@회의 24");
    expect(screen.getByTestId("scope-picker")).toBeTruthy();

    act(() => {
      for (let index = 0; index < 20; index += 1) {
        ref.current?.prepend(many[index] as ScopeChip);
      }
    });
    expect(input.querySelectorAll("[data-scope-chip]")).toHaveLength(20);

    fireEvent.click(screen.getByText("회의 24"));

    expect(input.querySelectorAll("[data-scope-chip]")).toHaveLength(20);
    expect(toastError).toHaveBeenCalledWith(
      "범위는 20개까지 붙일 수 있습니다."
    );
  });

  it("칩을 지우면 부모가 바로 안다", () => {
    const onChipsChange = vi.fn();
    const { input, ref } = renderComposer({ onChipsChange });
    ref.current?.prepend({ kind: "note", id: "n1", title: "주간 배포 회의" });
    expect(onChipsChange).toHaveBeenLastCalledWith([
      { kind: "note", id: "n1", title: "주간 배포 회의" },
    ]);

    input.querySelector("[data-scope-chip]")?.remove();
    fireEvent.input(input);
    expect(onChipsChange).toHaveBeenLastCalledWith([]);
  });

  it("맞는 것이 없으면 피커가 닫힌다", () => {
    const { input } = renderComposer();
    write(input, "@없는것");
    expect(screen.queryByTestId("scope-picker")).toBeNull();
  });

  it("스트리밍 중에는 보내기가 중지로 바뀐다", () => {
    const onStop = vi.fn();
    renderComposer({ isStreaming: true, onStop });
    expect(screen.queryByRole("button", { name: "보내기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "중지" }));
    expect(onStop).toHaveBeenCalled();
  });

  it("append 는 이미 있는 칩을 안 건드린다", () => {
    const { input, ref } = renderComposer();
    ref.current?.prepend({ kind: "note", id: "n1", title: "주간 배포 회의" });
    ref.current?.append("남은 액션 아이템이 뭐야?");

    expect(ref.current?.read().chips).toHaveLength(1);
    expect(input.textContent).toContain("남은 액션 아이템이 뭐야?");
  });

  // 글자를 다 지우면 Chrome 이 자리표시 `<br>` 을 남깁니다.
  it("칩 앞 글자를 다 지워도 빈 줄이 안 남는다", () => {
    const { input, ref } = renderComposer();
    ref.current?.prepend({ kind: "note", id: "n1", title: "주간 배포 회의" });
    input.prepend(document.createElement("br"));
    fireEvent.input(input);

    expect(input.querySelector("br")).toBeNull();
    expect(ref.current?.read().chips).toHaveLength(1);
  });

  it("문장 중간의 줄바꿈은 지우지 않는다", () => {
    const { input } = renderComposer();
    write(input, "첫 줄");
    input.append(
      document.createElement("br"),
      document.createTextNode("둘째 줄")
    );
    fireEvent.input(input);

    expect(input.querySelector("br")).toBeTruthy();
  });

  it("clear가 문장과 칩을 함께 비운다", () => {
    const { input, ref } = renderComposer();
    write(input, "안녕");
    ref.current?.prepend({ kind: "note", id: "n1", title: "주간 배포 회의" });
    ref.current?.clear();
    expect(ref.current?.read()).toEqual({ text: "", chips: [] });
  });
});

describe("범위 칩 줄바꿈", () => {
  it("★ 범위 칩은 제목을 자르지 않는다 — 길면 칩 안에서 줄을 바꾼다", () => {
    const { ref, input } = renderComposer();
    const long = "강상진 멘토님 특강 - 쿠버네티스_2 실습 환경과 포트 설정 정리";
    act(() => ref.current?.prepend({ kind: "note", id: "n9", title: long }));
    const chip = input.querySelector("[data-scope-chip]")!;
    expect(chip.textContent).toBe(long);
    expect(chip.className).toContain("whitespace-normal");
    expect(chip.className).toContain("[word-break:keep-all]");
    expect(chip.className).toContain("[overflow-wrap:anywhere]");
    expect(chip.className).not.toContain("max-w-[13rem]");
    expect(chip.innerHTML).not.toContain("truncate");
  });

  it("회의록 줄 오른쪽에 회의한 날을 흐리게 적는다", () => {
    const { input } = renderComposer({
      scope: {
        candidates: {
          projects: [],
          notes: [
            {
              kind: "note",
              id: "n1",
              title: "주간 배포 회의",
              at: "2026-10-24T03:00:00Z",
            },
          ],
        },
        isPending: false,
        taken: new Set<string>(),
      },
    });
    write(input, "@");
    expect(screen.getByRole("option").textContent).toMatch(
      /주간 배포 회의10\/2[45]/
    );
  });
});
