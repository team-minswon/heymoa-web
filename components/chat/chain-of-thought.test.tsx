import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnswerRefs,
  ChainOfThought,
} from "@/components/chat/chain-of-thought";
import type { Block } from "@/lib/chat/blocks";

afterEach(cleanup);

function tool(id: string, target: Block extends never ? never : unknown = null) {
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
  it("단계가 하나면 묶지 않는다", () => {
    const { container } = render(
      <ChainOfThought blocks={[tool("c1")]} live={false} />
    );
    expect(container.querySelector('[data-cot="single"]')).toBeTruthy();
    expect(container.querySelector('[data-cot="group"]')).toBeNull();
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

  it("헤더가 무엇을 봤는지까지 말한다", () => {
    render(
      <ChainOfThought
        blocks={[tool("c1", NOTE), tool("c2", NOTE), tool("c3")]}
        live={false}
      />
    );
    expect(screen.getByText("3단계 · 회의록 1건 검토")).toBeTruthy();
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

  it("★ 확정 전 승인은 단계 수에도 안 들어간다", () => {
    // 화면에 두 줄인데 헤더가 「3단계」라고 하면 헤더가 거짓말을 한다.
    render(
      <ChainOfThought
        blocks={[tool("c1"), tool("c2"), approval(null)]}
        live={false}
      />
    );
    expect(screen.getByText("2단계")).toBeTruthy();
  });

  it("★ 승인 기록은 요약이 없으면 도구 id로 흘러내리지 않는다", () => {
    // 계약이 요약을 저장하지 않아 히스토리에는 없다. 없다고 기계 이름을 대면
    // 카드(사람 말)와 히스토리(기계 이름)가 같은 일을 다르게 부른다.
    render(<ChainOfThought blocks={[approval("APPROVED")]} live={false} />);
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
    expect(
      screen.getByText(/Linear 이슈 'APP 버그 수정' 생성/)
    ).toBeTruthy();
  });

  it("모르는 kind는 칩 없이 summary만 그린다", () => {
    // 도구가 늘 때마다 web을 고쳐야 하면 배포가 묶인다.
    const { container } = render(
      <ChainOfThought
        blocks={[tool("c1", { kind: "graph", id: "g1", title: "그래프" })]}
        live={false}
      />
    );
    expect(container.querySelector("[data-target]")).toBeNull();
    expect(screen.getByText("c1 검색")).toBeTruthy();
  });
});

describe("AnswerRefs", () => {
  it("한 건이면 이름을, 여러 건이면 개수를 말한다", () => {
    const { rerender } = render(
      <AnswerRefs refs={[{ id: "n1", title: "주간 배포 회의" }]} />
    );
    expect(screen.getByText("찾은 곳: 주간 배포 회의 1건")).toBeTruthy();
    rerender(
      <AnswerRefs
        refs={[
          { id: "n1", title: "a" },
          { id: "n2", title: "b" },
          { id: "n3", title: "c" },
        ]}
      />
    );
    expect(screen.getByText("이 답은 3개 회의를 봤습니다")).toBeTruthy();
  });

  it("근거가 없으면 아무것도 안 그린다", () => {
    const { container } = render(<AnswerRefs refs={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("★ 접어서 아낄 것이 있을 때만 접어 둔다", () => {
    // 1건은 칩이 하나뿐이라 접어도 아낄 자리가 없고, 그 칩이 회의록으로 가는 유일한
    // 문이다 — 편 채로 둔다.
    const { container, rerender } = render(
      <AnswerRefs refs={[{ id: "n1", title: "주간 배포 회의" }]} />
    );
    const one = container.querySelector<HTMLDetailsElement>(
      'details[data-refs="answer"]'
    );
    expect(one?.open).toBe(true);

    // 여럿이면 칩이 여러 줄로 늘어난다. 줄이 개수를 말하고 있으니 접어 둔다.
    rerender(
      <AnswerRefs
        refs={[
          { id: "n1", title: "a" },
          { id: "n2", title: "b" },
          { id: "n3", title: "c" },
        ]}
      />
    );
    const many = container.querySelector<HTMLDetailsElement>(
      'details[data-refs="answer"]'
    );
    expect(many?.open).toBe(false);
    // **접혀도 문구는 남는다.** 개수를 말하는 그 줄이 요약이다.
    expect(screen.getByText("이 답은 3개 회의를 봤습니다")).toBeTruthy();
  });
});
