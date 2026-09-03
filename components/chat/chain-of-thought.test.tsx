import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnswerRefs, ChainOfThought } from "@/components/chat/chain-of-thought";
import type { Block } from "@/lib/chat/blocks";

afterEach(cleanup);

/**
 * 서랍을 펴고 본다. `live={false}` 로 그리면 접힌 채로 서므로(끝난 턴의 기본), 안쪽 줄을
 * 단언하려면 머리글을 한 번 눌러야 한다. 「접혀 있다」 자체를 보는 검사는 이걸 안 쓴다.
 */
function open() {
  fireEvent.click(screen.getByRole("button", { name: /생각 과정/ }));
}

function tool(
  id: string,
  target: Block extends never ? never : unknown = null
) {
  return {
    kind: "tool" as const,
    toolCallId: id,
    tool: "transcripts.search",
    summary: `${id} 검색`,
    target: target as Extract<Block, { kind: "tool" }>["target"],
    args: null,
    status: "success" as const,
    url: null,
  };
}
const NOTE = { kind: "note", id: "0HZX2K7M9Q4AF", title: "주간 배포 회의" };

/** 승인 블록. `decision: null`이면 아직 카드가 서 있는 것이라 이 줄은 안 그려진다. */
function approval(
  decision: "APPROVED" | "REJECTED" | null,
  summary: string | null = null
) {
  return {
    kind: "approval" as const,
    approvalId: "a1",
    toolCallId: "c9",
    tool: "linear.create_issue",
    summary,
    decision,
  };
}

describe("ChainOfThought", () => {
  /**
   * ★ **하나여도 서랍이다.**
   *
   * 예전에는 하나면 평평하게 그렸다 — 「접었다 폈다 할 것이 하나인 서랍은 서랍이 아니다」가
   * 이유였다. 그런데 단계는 **하나로 시작해서 늘어난다.** 실측하면 첫 단계에서
   * `data-cot="single"`, 둘째가 오는 순간 `data-cot="group"` 으로 갈아끼워져 머리글이
   * 없다가 생기고 레일이 통째로 다시 마운트된다 — 도는 중에 화면이 한 번 튄다.
   *
   * 모양이 상태에 따라 갈리지 않는 쪽이 낫다. 하나든 여섯이든 같은 서랍이다.
   */
  it("단계가 하나여도 서랍으로 뜬다", () => {
    const { container } = render(
      <ChainOfThought blocks={[tool("c1")]} live={false} />
    );
    expect(container.querySelector('[data-cot="group"]')).toBeTruthy();
    expect(container.querySelector('[data-cot="single"]')).toBeNull();
  });

  /**
   * ★ **접어서 아낄 것이 있을 때만 접어 둔다.**
   *
   * 머리글 한 줄로 본문 한 줄을 가리면 누르는 수고만 늘고 화면은 그대로다.
   * `AnswerRefs` 가 1건에서 편 채로 서는 것과 같은 규칙이다.
   */
  it("줄이 하나뿐이면 끝나도 편 채로 둔다", () => {
    const { container } = render(
      <ChainOfThought blocks={[tool("c1")]} live={false} />
    );
    expect(
      container.querySelector('[data-cot="group"]')?.getAttribute("data-open")
    ).toBe("true");
  });

  it("둘 이상이면 접이식 묶음 하나로 뜬다", () => {
    const { container } = render(
      <ChainOfThought blocks={[tool("c1"), tool("c2")]} live={false} />
    );
    expect(container.querySelector('[data-cot="group"]')).toBeTruthy();
    expect(
      container.querySelector('[data-cot="group"]')?.getAttribute("data-open")
    ).toBe("false");
  });

  it("스트리밍 중에는 펼쳐진다", () => {
    const { container } = render(
      <ChainOfThought blocks={[tool("c1"), tool("c2")]} live />
    );
    expect(
      container.querySelector('[data-cot="group"]')?.getAttribute("data-open")
    ).toBe("true");
  });

  it("사용자가 손으로 펼치면 자동 접힘이 그걸 덮지 않는다", () => {
    const { container, rerender } = render(
      <ChainOfThought blocks={[tool("c1"), tool("c2")]} live />
    );
    fireEvent.click(screen.getByRole("button", { expanded: true }));
    rerender(<ChainOfThought blocks={[tool("c1"), tool("c2")]} live={false} />);
    // 손으로 접었으니 live가 꺼져도 그대로 접힌 채다 — 되펼치지 않는다.
    expect(
      container.querySelector('[data-cot="group"]')?.getAttribute("data-open")
    ).toBe("false");
  });

  it("★ 헤더는 개수를 안 세고 무엇을 봤는지를 말한다", () => {
    // 「3단계」는 사람이 쓰는 말이 아니고, 몇 번 돌았는지는 접힌 줄이 답할 일이 아니다 —
    // 펴면 줄마다 무엇을 했는지가 이미 적혀 있다.
    render(
      <ChainOfThought
        blocks={[tool("c1", NOTE), tool("c2", NOTE), tool("c3")]}
        live={false}
      />
    );
    expect(screen.getByText("생각 과정 · 회의록 1건")).toBeTruthy();
    expect(screen.queryByText(/단계/)).toBeNull();
  });

  it("target이 note면 눌러서 그 회의록으로 간다", () => {
    const onOpenNote = vi.fn();
    render(
      <ChainOfThought
        blocks={[tool("c1", NOTE)]}
        live={false}
        onOpenNote={onOpenNote}
      />
    );
    open();
    fireEvent.click(screen.getByRole("button", { name: /주간 배포 회의/ }));
    expect(onOpenNote).toHaveBeenCalledWith("0HZX2K7M9Q4AF");
  });

  it("★ 확정 전 승인만 있는 묶음은 빈 자리를 안 남긴다", () => {
    // 그 블록은 아무것도 안 그린다(카드가 따로 선다). 그래도 레일을 세우면 답변과
    // 승인 카드 사이가 한 칸 더 벌어져 카드가 딴 데 떠 있는 것처럼 보인다.
    const { container } = render(
      <ChainOfThought blocks={[approval(null)]} live />
    );
    expect(container.querySelector("[data-cot]")).toBeNull();
  });

  it("★ 승인을 기다리는 동안 앞 단계가 계속 돌지 않는다", () => {
    /**
     * 확정 전 승인을 걸러 내면 「마지막 단계」 자리가 **바로 앞 단계로 넘어간다.** 그
     * 자리에 `live` 를 그대로 물려주면, 이미 끝난 「전사를 훑습니다」가 사람이 승인
     * 버튼을 누를 때까지 무한히 도는 진행 표시가 된다. 기다린다는 말은 카드가 한다.
     *
     * **서랍은 열린 채로 둔다** — 무엇을 하려다 물었는지가 그 안에 있다.
     */
    const { container, rerender } = render(
      <ChainOfThought
        blocks={[
          { kind: "thinking" as const, text: "전사를 훑습니다" },
          approval(null),
        ]}
        live
      />
    );
    expect(container.querySelector(".animate-spin")).toBeNull();

    // 도구가 아직 안 끝난 진짜 「도는 중」은 그대로 돈다.
    rerender(
      <ChainOfThought
        blocks={[
          { kind: "thinking" as const, text: "전사를 훑습니다" },
          { ...tool("c1"), status: null },
        ]}
        live
      />
    );
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("★ 확정 전 승인은 그리지도, 헤더에도 안 들어간다", () => {
    // 확정 전 승인은 「도는 중」이 아니라 사람을 기다리는 중이다. 카드가 따로 서 있다.
    const { container } = render(
      <ChainOfThought
        blocks={[tool("c1"), tool("c2"), approval(null)]}
        live={false}
      />
    );
    // 접힌 채로 선다(`live={false}`) — 헤더가 곧 요약이다.
    expect(screen.getByText("생각 과정")).toBeTruthy();
    expect(
      container.querySelector('[data-cot="group"]')?.getAttribute("data-open")
    ).toBe("false");
  });

  it("★ 승인 기록은 요약이 없으면 도구 id로 흘러내리지 않는다", () => {
    // 계약이 요약을 저장하지 않아 히스토리에는 없다. 없다고 기계 이름을 대면
    // 카드(사람 말)와 히스토리(기계 이름)가 같은 일을 다르게 부른다.
    render(<ChainOfThought blocks={[approval("APPROVED")]} live={false} />);
    open();
    expect(screen.getByText("승인함")).toBeTruthy();
    expect(screen.queryByText(/linear\.create_issue/)).toBeNull();
  });

  it("승인 기록에 요약이 있으면(스트림) 그 말을 쓴다", () => {
    render(
      <ChainOfThought
        blocks={[approval("APPROVED", "Linear 이슈 'APP 버그 수정' 생성")]}
        live={false}
      />
    );
    open();
    expect(screen.getByText(/Linear 이슈 'APP 버그 수정' 생성/)).toBeTruthy();
  });

  it("모르는 kind는 칩 없이 summary만 그린다", () => {
    // 도구가 늘 때마다 web을 고쳐야 하면 배포가 묶인다.
    const { container } = render(
      <ChainOfThought
        blocks={[tool("c1", { kind: "graph", id: "g1", title: "그래프" })]}
        live={false}
      />
    );
    open();
    expect(container.querySelector("[data-target]")).toBeNull();
    expect(screen.getByText("c1 검색")).toBeTruthy();
  });
});

describe("AnswerRefs", () => {
  it("★ 「출처」가 아니라 「참고한」이다 — 본 것이지 인용한 것이 아니다", () => {
    // 계약이 싣는 것은 **에이전트가 본 것**이다. 넷을 보고 하나만 근거로 썼어도 넷이
    // 다 여기 선다 — 「출처」는 그것보다 더 말하는 단어라 신뢰를 잘못 만든다.
    render(<AnswerRefs refs={[{ id: "n1", title: "주간 배포 회의" }]} />);
    expect(screen.getByText("참고한 회의록 1개")).toBeTruthy();
    expect(screen.queryByText(/출처/)).toBeNull();
  });

  it("근거가 없으면 아무것도 안 그린다", () => {
    const { container } = render(<AnswerRefs refs={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("★ 접어서 아낄 것이 있을 때만 접어 둔다", () => {
    // 1건은 칩이 하나뿐이라 접어도 아낄 자리가 없고, 그 칩이 회의록으로 가는 유일한
    // 문이다 — 편 채로 둔다.
    const { container } = render(
      <AnswerRefs refs={[{ id: "n1", title: "주간 배포 회의" }]} />
    );
    expect(
      container.querySelector('[data-refs="answer"]')?.getAttribute("data-open")
    ).toBe("true");
    cleanup();

    // 여럿이면 칩이 여러 줄로 늘어난다. 줄이 개수를 말하고 있으니 접어 둔다.
    const many = render(
      <AnswerRefs
        refs={[
          { id: "n1", title: "a" },
          { id: "n2", title: "b" },
          { id: "n3", title: "c" },
        ]}
      />
    );
    expect(
      many.container
        .querySelector('[data-refs="answer"]')
        ?.getAttribute("data-open")
    ).toBe("false");
    // **접혀도 문구는 남는다.** 개수를 말하는 그 줄이 요약이다.
    expect(screen.getByText("참고한 회의록 3개")).toBeTruthy();
  });
});

/**
 * ★ **등장 애니메이션은 흐를 때 한 번이다.**
 *
 * 답이 끝나면 같은 단계가 히스토리 컴포넌트로 다시 마운트되는데, 거기에 `chat-rise` 가
 * 붙어 있으면 방금 본 레일이 **한 번 더 떠오른다** — 2026-09-03 실측에서 답 끝 번쩍임의
 * 본체였다. 끝난 묶음은 소리 없이 선다.
 */
describe("등장 애니메이션", () => {
  it("끝난 묶음(live=false)에는 등장 애니메이션이 안 붙는다", () => {
    const { container } = render(
      <ChainOfThought blocks={[tool("c1"), tool("c2")]} live={false} />
    );
    expect(
      container
        .querySelector('[data-cot="group"]')
        ?.classList.contains("chat-rise")
    ).toBe(false);
    open();
    expect(container.querySelector(".chat-rise")).toBeNull();
  });

  it("흐르는 묶음(live)에는 붙는다", () => {
    const { container } = render(<ChainOfThought blocks={[tool("c1")]} live />);
    expect(
      container
        .querySelector('[data-cot="group"]')
        ?.classList.contains("chat-rise")
    ).toBe(true);
  });

  it("히스토리 근거 줄은 소리 없이 선다", () => {
    const { container } = render(
      <AnswerRefs refs={[{ id: "n1", title: "주간 배포 회의" }]} />
    );
    expect(
      container
        .querySelector('[data-refs="answer"]')
        ?.classList.contains("chat-rise")
    ).toBe(false);
  });

  it("흐르다 끝난 근거 줄만 떠오른다", () => {
    const { container } = render(
      <AnswerRefs refs={[{ id: "n1", title: "주간 배포 회의" }]} animate />
    );
    expect(
      container
        .querySelector('[data-refs="answer"]')
        ?.classList.contains("chat-rise")
    ).toBe(true);
  });
});

/**
 * ★ **단계 사이의 빈 구간도 「도는 중」이다.**
 *
 * 도구 결과가 오고 다음 생각·토큰이 오기까지 모델이 도는 몇 초가 있다. 그 사이 마지막 줄은
 * 체크로 굳어 있고 빛나는 글자가 하나도 없어서 **멈춘 것처럼 보였다.**
 */
describe("단계 사이의 「생각하는 중」", () => {
  it("도구가 끝났는데 다음 단계가 아직이면 「생각하는 중」이 선다", () => {
    render(<ChainOfThought blocks={[tool("c1")]} live />);
    expect(screen.getByText("생각하는 중")).toBeTruthy();
  });

  it("접혀 있으면 머리글이 그 말을 한다", () => {
    render(<ChainOfThought blocks={[tool("c1"), tool("c2")]} live />);
    fireEvent.click(screen.getByRole("button", { expanded: true }));
    expect(screen.getByRole("button", { expanded: false }).textContent).toBe(
      "생각하는 중"
    );
  });

  it("도구가 아직 도는 중이면 겹치지 않는다", () => {
    render(<ChainOfThought blocks={[{ ...tool("c1"), status: null }]} live />);
    expect(screen.queryByText("생각하는 중")).toBeNull();
  });

  it("생각이 흐르는 중이면 그 줄이 이미 빛난다 — 겹치지 않는다", () => {
    render(
      <ChainOfThought
        blocks={[tool("c1"), { kind: "thinking", text: "다음을 찾습니다." }]}
        live
      />
    );
    expect(screen.queryByText("생각하는 중")).toBeNull();
  });

  it("끝난 묶음에는 없다", () => {
    render(<ChainOfThought blocks={[tool("c1")]} live={false} />);
    open();
    expect(screen.queryByText("생각하는 중")).toBeNull();
  });

  it("승인을 기다리는 동안도 없다 — 도는 것이 아니라 사람을 기다린다", () => {
    render(<ChainOfThought blocks={[tool("c1"), approval(null)]} live />);
    expect(screen.queryByText("생각하는 중")).toBeNull();
  });
});
