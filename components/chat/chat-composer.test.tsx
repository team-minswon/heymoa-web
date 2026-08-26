import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  projects: [{ kind: "project", id: "p1", title: "결제 개편" } as ScopeCandidate],
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
      placeholder="@로 프로젝트·회의록을 참조해 물어보세요"
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

/** 편집기에 글자를 넣는다. contenteditable 이라 value 가 아니라 DOM 이다. */
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
    // "네"를 치고 Enter로 확정하려던 것이 그대로 전송되면 안 된다.
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
    // 답을 읽으면서 다음 질문을 적어 두는 것이 자연스럽다.
    const { input } = renderComposer({ isBusy: true, isStreaming: true });
    expect(input.getAttribute("contenteditable")).toBe("true");
  });

  it("답변이 흐르는 동안 Enter는 보내지 않는다", () => {
    // 앞 턴이 끝나기 전에 보내면 그 스트림이 끊기고 부분 응답은 저장되지 않는다.
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
    // 회의록 제목은 거의 다 여러 낱말이다. 공백에서 멘션이 끝나면 두 번째 낱말을 치는
    // 순간 피커가 닫히고, 고르려고 누른 Enter 가 그대로 전송이 된다.
    const { input } = renderComposer();
    write(input, "@주간 배포");
    expect(screen.getByTestId("scope-picker")).toBeTruthy();
    expect(screen.getByText("주간 배포 회의")).toBeTruthy();
  });

  it("맞는 것이 없으면 멘션이 끝난 것으로 본다", () => {
    // 열려 있으면 Enter 를 삼키기만 한다. 고를 것이 없으면 Enter 는 문장의 것이다.
    const onSubmit = vi.fn();
    const { input } = renderComposer({ onSubmit });
    write(input, "@주간 배포 회의에서 정한 게 뭐야");
    expect(screen.queryByTestId("scope-picker")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalled();
  });

  it("목록이 오기 전에는 Enter 를 잡아 둔다", () => {
    // 조회가 늦은 몇백 ms 사이에 고르려던 Enter 가 반쯤 쓴 문장을 보내면 안 된다.
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
    // 고르려던 Enter 가 그대로 나가면 반쯤 쓴 문장이 전송된다.
    const onSubmit = vi.fn();
    const { input } = renderComposer({ onSubmit });
    write(input, "이 @주간");
    expect(screen.getByTestId("scope-picker")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("피커가 먹은 Enter는 편집기까지 가지 않는다", () => {
    // **이걸 안 막아서 고르기와 전송이 한 번에 일어났다.** 피커가 `preventDefault`만 하면
    // 같은 Enter가 편집기의 React 핸들러까지 가는데, 그 사이에 `onPick`이 부모 상태를
    // 바꿔 놓아서 편집기는 「피커가 없다」로 읽고 방금 완성된 문장을 보냈다.
    // 그래서 먹은 키는 캡처 단계에서 전파까지 끊는다.
    const onSubmit = vi.fn();
    const { input } = renderComposer({ onSubmit });
    write(input, "이 @주간");

    const seen: string[] = [];
    const spy = (event: Event) => seen.push((event as KeyboardEvent).key);
    // 버블 단계다 — 캡처에서 끊기면 여기까지 안 온다.
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
    // 남으면 피커가 다시 열려 같은 칩이 두 번 박힌다. 캐럿이 텍스트 노드가 아니라
    // 노드 사이에 서 있을 때도 지워져야 한다.
    //
    // ★ **칩은 마커로 나간다.** 맨살 제목으로 내면 id 도 구분자도 안 실려서
    // 말풍선이 제목을 정규식으로 되찾아야 하고, 되찾은 칩은 못 누른다.
    const { input, ref } = renderComposer();
    write(input, "이 @주간");
    fireEvent.click(screen.getByText("주간 배포 회의"));

    expect(ref.current?.read().text).toBe("이 @[주간 배포 회의](noteId:n1)");
    expect(screen.queryByTestId("scope-picker")).toBeNull();
    expect(input.querySelectorAll("[data-scope-chip]")).toHaveLength(1);
  });

  it("칩 뒤에 공백이 하나 붙고 캐럿이 그 뒤에 선다", () => {
    // 없으면 다음 글자가 칩에 딱 붙어 칩 안으로 들어간 것처럼 보인다.
    const { input, ref } = renderComposer();
    write(input, "이 @주간");
    fireEvent.click(screen.getByText("주간 배포 회의"));

    const chip = input.querySelector("[data-scope-chip]");
    expect(chip?.nextSibling?.textContent).toBe(" ");
    // 이어 쓴 글자가 칩 밖에 남는다.
    expect(ref.current?.read().chips).toHaveLength(1);
  });

  it("고르면 칩이 문장 안에 박힌다", () => {
    // 칩이 입력 밖에 있으면 「무엇을 붙였나」와 「무엇을 쓰나」가 두 덩어리로 갈린다.
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
    // 「프로젝트 하나」와 「그 안의 회의록 하나」는 범위 크기가 크게 다르다.
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
    // Tiro 는 텍스트 멘션이 원본이라 중복이 안 걸러진다. 여기서는 추출할 때 접는다.
    const { ref } = renderComposer();
    ref.current?.prepend({ kind: "note", id: "n1", title: "주간 배포 회의" });
    ref.current?.prepend({ kind: "note", id: "n1", title: "주간 배포 회의" });
    expect(ref.current?.read().chips).toHaveLength(1);
  });

  // 서버가 20을 넘으면 400이다. 여기서 안 세면 사용자는 다 붙인 뒤에야 그것을 안다.
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

    // **질의를 먼저 친다.** `write`는 `textContent`를 통째로 갈아 칩을 지우므로
    // 순서를 뒤집으면 방금 채운 스무 개가 사라진다.
    write(input, "@회의 24");
    expect(screen.getByTestId("scope-picker")).toBeTruthy();

    act(() => {
      for (let index = 0; index < 20; index += 1) {
        ref.current?.prepend(many[index] as ScopeChip);
      }
    });
    expect(input.querySelectorAll("[data-scope-chip]")).toHaveLength(20);

    // 스물한 번째 — 여기서 막혀야 한다.
    fireEvent.click(screen.getByText("회의 24"));

    expect(input.querySelectorAll("[data-scope-chip]")).toHaveLength(20);
    expect(toastError).toHaveBeenCalledWith("범위는 20개까지 붙일 수 있습니다.");
  });

  it("칩을 지우면 부모가 바로 안다", () => {
    // 삭제는 브라우저가 원자로 한다 — `contentEditable="false"` 라 백스페이스 한 번에
    // 통째로 지워지고, 「지웠다」 이벤트가 따로 없어 목록 변화로 알아낸다.
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
    // 「없습니다」 카드를 띄워 두면 Enter 가 그 카드에 묶여 아무것도 못 한다.
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
    // 추천 질문이 이걸 쓴다. 붙여 둔 칩이 딸려 나가거나 지워지면 뜻밖이다.
    const { input, ref } = renderComposer();
    ref.current?.prepend({ kind: "note", id: "n1", title: "주간 배포 회의" });
    ref.current?.append("남은 액션 아이템이 뭐야?");

    expect(ref.current?.read().chips).toHaveLength(1);
    expect(input.textContent).toContain("남은 액션 아이템이 뭐야?");
  });

  it("칩 앞 글자를 다 지워도 빈 줄이 안 남는다", () => {
    // 글자를 다 지우면 Chrome 이 자리표시 `<br>` 을 남긴다. 칩이 아직 있으면 편집기가
    // 비지 않았으므로 그 `<br>` 이 빈 첫 줄을 만들고, 칩이 둘째 줄로 밀려 상자가 두 줄
    // 높이로 벌어진다.
    const { input, ref } = renderComposer();
    ref.current?.prepend({ kind: "note", id: "n1", title: "주간 배포 회의" });
    input.prepend(document.createElement("br"));
    fireEvent.input(input);

    expect(input.querySelector("br")).toBeNull();
    expect(ref.current?.read().chips).toHaveLength(1);
  });

  it("문장 중간의 줄바꿈은 지우지 않는다", () => {
    // Shift+Enter 로 넣은 진짜 줄바꿈이다. 앞에 내용이 있으면 사용자가 넣은 것이다.
    const { input } = renderComposer();
    write(input, "첫 줄");
    input.append(document.createElement("br"), document.createTextNode("둘째 줄"));
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
