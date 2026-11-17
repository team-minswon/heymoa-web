import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnswerRefs,
  ChainOfThought,
  STALL_MS,
} from "@/components/chat/chain-of-thought";
import type { Block } from "@/lib/chat/blocks";

const motionPrefs = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => motionPrefs.reduced,
}));

afterEach(() => {
  cleanup();
  motionPrefs.reduced = false;
});

function open() {
  fireEvent.click(screen.getByRole("button", { name: /생각/ }));
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
    status: "success" as const,
    url: null,
  };
}
const NOTE = { kind: "note", id: "0HZX2K7M9Q4AF", title: "주간 배포 회의" };

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
    card: null,
    decision,
  };
}

describe("ChainOfThought", () => {
  it("단계가 하나여도 서랍으로 뜬다", () => {
    const { container } = render(
      <ChainOfThought blocks={[tool("c1")]} live={false} />
    );
    expect(container.querySelector('[data-cot="group"]')).toBeTruthy();
    expect(container.querySelector('[data-cot="single"]')).toBeNull();
  });

  it("끝나면 줄이 하나여도 접는다", () => {
    const { container } = render(
      <ChainOfThought blocks={[tool("c1")]} live={false} />
    );
    expect(
      container.querySelector('[data-cot="group"]')?.getAttribute("data-open")
    ).toBe("false");
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

  it("★ 스트리밍 중에는 펴진 채 최근 줄만 보이는 꼬리로 선다 — 단계 수는 안 센다", () => {
    const { container } = render(
      <ChainOfThought
        blocks={[
          tool("c1"),
          { kind: "thinking", text: "더 봅니다" },
          {
            ...tool("c3"),
            summary: "연관 스크립트 읽기 · 10:02",
            status: null,
          },
        ]}
        live
      />
    );
    const group = container.querySelector('[data-cot="group"]');
    expect(group?.getAttribute("data-open")).toBe("true");
    const tail = container.querySelector("[data-tail]");
    expect(tail?.className).toContain("max-h-");
    expect(tail?.className).toContain("overflow-y-auto");
    expect(screen.queryByText(/단계/)).toBeNull();
    expect(screen.getByRole("button", { expanded: true }).textContent).toBe(
      "생각 중"
    );
    expect(container.querySelector("[data-current]")).toBeNull();
    const rows = container.querySelectorAll("[data-step]");
    expect(
      rows[rows.length - 1].querySelector(".chat-shimmer")?.textContent
    ).toBe("연관 스크립트 읽기 · 10:02");
  });

  it("★ 꼬리가 넘칠 때만 위 줄을 흐린다", () => {
    const scroll = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(300);
    const client = vi
      .spyOn(HTMLElement.prototype, "clientHeight", "get")
      .mockReturnValue(104);
    const { container } = render(
      <ChainOfThought
        blocks={["c1", "c2", "c3", "c4", "c5"].map((id) => ({
          ...tool(id),
          tool: id,
        }))}
        live
      />
    );
    const tail = container.querySelector("[data-tail]");
    expect(tail?.getAttribute("data-overflow")).toBe("true");
    expect(tail?.className).toContain("mask-image");
    scroll.mockRestore();
    client.mockRestore();
    cleanup();

    const short = render(<ChainOfThought blocks={[tool("c1")]} live />);
    const fits = short.container.querySelector("[data-tail]");
    expect(fits?.hasAttribute("data-overflow")).toBe(false);
    expect(fits?.className).not.toContain("mask-image");
  });

  it("★ 동작 줄이기면 줄이 밀려 올라오지 않고 그냥 바뀐다", () => {
    const blocks = [tool("c1"), { ...tool("c2"), tool: "other", status: null }];
    const { container } = render(<ChainOfThought blocks={blocks} live />);
    expect(container.querySelector('[data-motion="slide"]')).toBeTruthy();
    cleanup();

    motionPrefs.reduced = true;
    const reduced = render(<ChainOfThought blocks={blocks} live />);
    expect(reduced.container.querySelector("[data-tail]")).toBeTruthy();
    expect(reduced.container.querySelector("[data-motion]")).toBeNull();
  });

  it("★ 끝나면 「N초 동안 생각 · 회의록 N건」 한 줄로 접히고, 누르면 전체 단계가 시간순으로 선다", () => {
    const blocks = [
      tool("c1", NOTE),
      { kind: "thinking" as const, text: "더 봅니다" },
      { ...tool("c2"), tool: "other" },
    ];
    const { container, rerender } = render(
      <ChainOfThought
        blocks={blocks}
        live
        startedAt="2026-07-24T00:00:00Z"
        endedAt="2026-07-24T00:00:07Z"
      />
    );
    expect(container.querySelector("[data-tail]")).toBeTruthy();
    rerender(
      <ChainOfThought
        blocks={blocks}
        live={false}
        startedAt="2026-07-24T00:00:00Z"
        endedAt="2026-07-24T00:00:07Z"
      />
    );
    expect(
      container.querySelector('[data-cot="group"]')?.getAttribute("data-open")
    ).toBe("false");
    fireEvent.click(
      screen.getByRole("button", { name: "7초 동안 생각 · 회의록 1건" })
    );
    expect(container.querySelector("[data-tail]")).toBeNull();
    expect(
      [...container.querySelectorAll("[data-step]")].map(
        (step) => step.textContent
      )
    ).toEqual(["c1 검색주간 배포 회의", "더 봅니다", "c2 검색"]);
  });

  it("지금 단계가 생각이면 마지막 문장을 보여 준다", () => {
    render(
      <ChainOfThought
        blocks={[
          tool("c1"),
          {
            kind: "thinking",
            text: "회의를 찾습니다.\n배포 날짜를 확인합니다.",
          },
        ]}
        live
      />
    );
    expect(screen.getByText("배포 날짜를 확인합니다.")).toBeTruthy();
  });

  it("사용자가 손으로 펼치면 자동 접힘이 그걸 덮지 않는다", () => {
    const { container, rerender } = render(
      <ChainOfThought blocks={[tool("c1"), tool("c2")]} live />
    );
    fireEvent.click(screen.getByRole("button", { expanded: true }));
    rerender(<ChainOfThought blocks={[tool("c1"), tool("c2")]} live={false} />);
    rerender(<ChainOfThought blocks={[tool("c1"), tool("c2")]} live />);
    expect(
      container.querySelector('[data-cot="group"]')?.getAttribute("data-open")
    ).toBe("false");
  });

  it("★ 끝나면 「무엇을 봤나」 한 줄로 접힌다 — 단계 수는 펼쳐야 보인다", () => {
    const { container } = render(
      <ChainOfThought
        blocks={[
          tool("c1", NOTE),
          { kind: "thinking", text: "더 봅니다" },
          tool("c2", NOTE),
          tool("c3"),
        ]}
        live={false}
      />
    );
    expect(
      container.querySelector('[data-cot="group"]')?.getAttribute("data-open")
    ).toBe("false");
    expect(screen.getByText("생각 · 회의록 1건")).toBeTruthy();
    expect(container.querySelectorAll("[data-step]")).toHaveLength(0);
  });

  it("★ 펴면 이어진 같은 조회 도구가 「×N」 한 줄로 묶이고, 누르면 펼쳐진다", () => {
    const read = (id: string) => ({
      ...tool(id),
      tool: "transcripts.read",
      summary: `연관 스크립트 읽기 · ${id}`,
    });
    const { container } = render(
      <ChainOfThought
        blocks={[
          { kind: "thinking", text: "찾습니다" },
          read("r1"),
          read("r2"),
          read("r3"),
        ]}
        live={false}
      />
    );
    open();
    const run = container.querySelector('[data-step="run"]');
    expect(run?.textContent).toContain("연관 스크립트 읽기");
    expect(run?.textContent).toContain("×3");
    expect(screen.queryByText("연관 스크립트 읽기 · r2")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /×3/ }));
    expect(screen.getByText("연관 스크립트 읽기 · r2")).toBeTruthy();
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
    const { container } = render(
      <ChainOfThought blocks={[approval(null)]} live />
    );
    expect(container.querySelector("[data-cot]")).toBeNull();
  });

  it("★ 승인을 기다리는 동안 앞 단계가 계속 돌지 않는다", () => {
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
    expect(container.querySelector(".chat-shimmer")).toBeNull();
    expect(
      container.querySelector('[data-cot="group"]')?.getAttribute("data-open")
    ).toBe("true");

    rerender(
      <ChainOfThought
        blocks={[
          { kind: "thinking" as const, text: "전사를 훑습니다" },
          { ...tool("c1"), status: null },
        ]}
        live
      />
    );
    expect(container.querySelector(".chat-shimmer")).toBeTruthy();
  });

  it("★ 확정 전 승인은 그리지도, 헤더에도 안 들어간다", () => {
    const { container } = render(
      <ChainOfThought
        blocks={[tool("c1"), tool("c2"), approval(null)]}
        live={false}
      />
    );
    expect(screen.getByText("생각")).toBeTruthy();
    expect(
      container.querySelector('[data-cot="group"]')?.getAttribute("data-open")
    ).toBe("false");
  });

  it("모르는 kind는 칩 없이 summary만 그린다", () => {
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
    render(<AnswerRefs refs={[{ id: "n1", title: "주간 배포 회의" }]} />);
    expect(
      screen.getByRole("group", { name: "참고한 회의록 1개" })
    ).toBeTruthy();
    expect(screen.queryByText(/출처/)).toBeNull();
  });

  it("근거가 없으면 아무것도 안 그린다", () => {
    const { container } = render(<AnswerRefs refs={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("★ 접지 않고 칩이 바로 선다 — 누르면 그 회의록으로 간다", () => {
    const onOpenNote = vi.fn();
    render(
      <AnswerRefs
        refs={[{ id: "n1", title: "주간 배포 회의" }]}
        onOpenNote={onOpenNote}
      />
    );
    expect(screen.queryByRole("button", { expanded: false })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /주간 배포 회의/ }));
    expect(onOpenNote).toHaveBeenCalledWith("n1");
  });

  it("★ 셋이 넘으면 「+N」으로 접고, 누르면 나머지가 선다", () => {
    render(
      <AnswerRefs
        refs={["a", "b", "c", "d", "e"].map((id) => ({ id, title: id }))}
        onOpenNote={vi.fn()}
      />
    );
    expect(screen.getAllByRole("button")).toHaveLength(4);
    fireEvent.click(
      screen.getByRole("button", { name: "참고한 회의록 2개 더 보기" })
    );
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "e" })).toBeTruthy();
  });
});

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

describe("단계 사이의 「생각하는 중」", () => {
  it("도구가 끝났는데 다음 단계가 아직이면 머리줄 「생각 중」이 그 말을 한다 — 「생각하는 중」 줄을 되풀이하지 않는다", () => {
    const { container } = render(<ChainOfThought blocks={[tool("c1")]} live />);
    expect(container.querySelector('[data-step="pending"]')).toBeNull();
    expect(screen.getByRole("button", { expanded: true }).textContent).toBe(
      "생각 중"
    );
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "생각하는 중"
    );
  });

  it("도구가 아직 도는 중이면 겹치지 않는다", () => {
    render(<ChainOfThought blocks={[{ ...tool("c1"), status: null }]} live />);
    expect(screen.queryByText("생각하는 중")).toBeNull();
  });

  it("생각이 흐르는 중이면 그 줄이 빛난다", () => {
    const { container } = render(
      <ChainOfThought
        blocks={[tool("c1"), { kind: "thinking", text: "다음을 찾습니다." }]}
        live
      />
    );
    expect(
      container.querySelector('[data-step="thinking"] .chat-shimmer')
        ?.textContent
    ).toBe("다음을 찾습니다.");
  });

  it("끝난 묶음에는 없다", () => {
    render(<ChainOfThought blocks={[tool("c1")]} live={false} />);
    open();
    expect(screen.queryByText("생각하는 중")).toBeNull();
  });

  it("흐르는 묶음의 줄은 떠오르며 선다", () => {
    const { container } = render(<ChainOfThought blocks={[tool("c1")]} live />);
    expect(
      container
        .querySelector('[data-step="tool"]')
        ?.classList.contains("chat-rise")
    ).toBe(true);
  });

  it("승인을 기다리는 동안도 없다 — 도는 것이 아니라 사람을 기다린다", () => {
    render(<ChainOfThought blocks={[tool("c1"), approval(null)]} live />);
    expect(screen.queryByText("생각하는 중")).toBeNull();
  });
});

describe("★ N3 끝난 턴의 도구 줄", () => {
  it("「중단됨」·「확인 필요」 줄은 돌지 않는다", () => {
    const { container } = render(
      <ChainOfThought
        blocks={[
          { ...tool("c1"), status: "stopped" },
          { ...tool("c2"), status: "unknown" },
        ]}
        live={false}
      />
    );
    open();
    expect(screen.getByText("중단됨")).toBeTruthy();
    expect(screen.getByText("확인 필요")).toBeTruthy();
    expect(container.querySelector(".animate-spin")).toBeNull();
    expect(screen.queryByText("실행하지 못했습니다")).toBeNull();
  });
});

describe("생각한 시간", () => {
  afterEach(() => vi.useRealTimers());

  it("도는 동안 「생각 중 · n초」가 흐른다", () => {
    vi.useFakeTimers();
    render(
      <ChainOfThought
        blocks={[tool("c1"), { ...tool("c2"), status: null }]}
        live
      />
    );
    act(() => vi.advanceTimersByTime(3_000));
    expect(screen.getByRole("button", { expanded: true }).textContent).toBe(
      "생각 중 · 3초"
    );
  });

  it("흐르다 끝나면 걸린 시간이 접힌 줄에 남는다", () => {
    vi.useFakeTimers();
    const blocks = [tool("c1"), tool("c2")];
    const { rerender } = render(<ChainOfThought blocks={blocks} live />);
    act(() => vi.advanceTimersByTime(5_000));
    rerender(<ChainOfThought blocks={blocks} live={false} />);
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText("5초 동안 생각")).toBeTruthy();
  });

  it("히스토리는 행 시각으로 잰다", () => {
    render(
      <ChainOfThought
        blocks={[tool("c1"), tool("c2")]}
        live={false}
        startedAt="2026-07-24T00:00:02Z"
        endedAt="2026-07-24T00:00:14Z"
      />
    );
    expect(screen.getByText("12초 동안 생각")).toBeTruthy();
  });

  it("1분이 넘으면 분으로 말한다", () => {
    render(
      <ChainOfThought
        blocks={[tool("c1"), tool("c2")]}
        live={false}
        startedAt="2026-07-24T00:00:00Z"
        endedAt="2026-07-24T00:02:05Z"
      />
    );
    expect(screen.getByText("2분 5초 동안 생각")).toBeTruthy();
  });

  it("시각이 없거나 1초가 안 되면 초를 안 붙인다", () => {
    render(<ChainOfThought blocks={[tool("c1"), tool("c2")]} live={false} />);
    expect(screen.getByText("생각")).toBeTruthy();
    cleanup();
    render(
      <ChainOfThought
        blocks={[tool("c1"), tool("c2")]}
        live={false}
        startedAt="2026-07-24T00:00:02Z"
        endedAt="2026-07-24T00:00:02Z"
      />
    );
    expect(screen.getByText("생각")).toBeTruthy();
  });
});

describe("도는 동안의 지금 단계 줄", () => {
  it("결과를 기다리는 도구가 여럿이면 그만큼 완료에서 뺀다", () => {
    render(
      <ChainOfThought
        blocks={[
          { ...tool("c1"), status: null },
          { ...tool("c2"), status: null },
        ]}
        live
      />
    );
    expect(screen.queryByText(/단계 완료/)).toBeNull();
  });

  it("지금 단계는 보조 기술에 조용히 알린다", () => {
    const { container } = render(
      <ChainOfThought blocks={[{ ...tool("c1"), status: null }]} live />
    );
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("c1 검색 중");
  });

  it("같은 생각에 글자가 붙어도 줄을 다시 세우지 않는다", () => {
    const { container, rerender } = render(
      <ChainOfThought blocks={[{ kind: "thinking", text: "회의를" }]} live />
    );
    const before = container.querySelector('[data-step="thinking"]');
    rerender(
      <ChainOfThought
        blocks={[{ kind: "thinking", text: "회의를 찾습니다." }]}
        live
      />
    );
    const after = container.querySelector('[data-step="thinking"]');
    expect(after?.textContent).toBe("회의를 찾습니다.");
    expect(after).toBe(before);
  });
});

describe("갈려 온 생각", () => {
  const split = [
    tool("c1"),
    { kind: "thinking" as const, text: "배포 일정을" },
    { kind: "thinking" as const, text: " 확인합니다." },
  ];

  it("흐르는 중이면 합친 문장 전체가 지금 단계다", () => {
    const { container } = render(<ChainOfThought blocks={split} live />);
    expect(container.querySelector('[data-step="thinking"]')?.textContent).toBe(
      "배포 일정을 확인합니다."
    );
    expect(screen.getByRole("button").textContent).toBe("생각 중");
  });

  it("펴면 흐르는 생각 줄이 빛나고 체크가 아니다", () => {
    const { container } = render(<ChainOfThought blocks={split} live />);
    const row = container.querySelector('[data-step="thinking"]');
    expect(row?.querySelector(".chat-shimmer")).toBeTruthy();
  });

  it("합쳐서 한 줄로 펼쳐진다", () => {
    const { container } = render(
      <ChainOfThought blocks={split.slice(1)} live={false} />
    );
    open();
    expect(container.querySelectorAll('[data-step="thinking"]')).toHaveLength(
      1
    );
  });
});

it("도는 동안 흐르는 초는 버튼 이름에서 뺀다 — 매초 다시 읽히지 않게", () => {
  vi.useFakeTimers();
  render(
    <ChainOfThought
      blocks={[tool("c1"), { ...tool("c2"), status: null }]}
      live
    />
  );
  act(() => vi.advanceTimersByTime(3_000));
  const button = screen.getByRole("button", { expanded: true });
  expect(button.textContent).toBe("생각 중 · 3초");
  expect(
    button.querySelector('span[aria-hidden="true"]')?.textContent
  ).toContain("3초");
  vi.useRealTimers();
});

describe("진행 문장(thinking) 줄", () => {
  const narration = {
    kind: "thinking" as const,
    text: "회의록에서 배포 일정을 찾아볼게요.\n안건 요약을 확인할게요.\n",
  };

  it("흐르는 동안 마지막 줄이 지금 하는 일이다", () => {
    const { container } = render(<ChainOfThought blocks={[narration]} live />);
    expect(
      container.querySelector(
        '[data-step="thinking"]:last-of-type .chat-shimmer'
      )?.textContent
    ).toBe("안건 요약을 확인할게요.");
  });

  it("펼치면 줄마다 한 단계로 시간순으로 선다", () => {
    const { container } = render(
      <ChainOfThought blocks={[narration, tool("c1")]} live={false} />
    );
    open();
    const steps = [...container.querySelectorAll("[data-step]")].map(
      (step) => step.textContent
    );
    expect(steps).toEqual([
      "회의록에서 배포 일정을 찾아볼게요.",
      "안건 요약을 확인할게요.",
      "c1 검색",
    ]);
  });
});

describe("멈춘 것과 오래 걸리는 것", () => {
  afterEach(() => vi.useRealTimers());

  it("★ 새 이벤트가 오래 없으면 「응답이 늦어지고 있습니다」로 바꿔 말하고, 다음 이벤트가 오면 되돌린다", () => {
    vi.useFakeTimers();
    const first = [{ ...tool("c1"), status: null }];
    const { container, rerender } = render(
      <ChainOfThought blocks={first} live />
    );
    act(() => vi.advanceTimersByTime(STALL_MS - 1_000));
    expect(container.querySelector("[data-stalled]")).toBeNull();
    act(() => vi.advanceTimersByTime(1_000));
    expect(container.querySelector("[data-stalled]")?.textContent).toMatch(
      /응답이 늦어지고 있습니다/
    );

    rerender(
      <ChainOfThought
        blocks={[
          { ...tool("c1"), status: "success" as const },
          { ...tool("c2"), tool: "other", status: null },
        ]}
        live
      />
    );
    expect(container.querySelector("[data-stalled]")).toBeNull();
    expect(container.querySelector(".chat-shimmer")?.textContent).toBe(
      "c2 검색"
    );
  });

  it("끝난 묶음은 늦어진다고 말하지 않는다", () => {
    vi.useFakeTimers();
    const { container } = render(
      <ChainOfThought blocks={[tool("c1")]} live={false} />
    );
    act(() => vi.advanceTimersByTime(STALL_MS * 2));
    expect(container.querySelector("[data-stalled]")).toBeNull();
  });
});
