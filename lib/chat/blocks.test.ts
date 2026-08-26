import { describe, expect, it } from "vitest";

import {
  answerText,
  appendText,
  appendThinking,
  type Block,
  finalizeText,
  groupBlocks,
  joinSummary,
  pushApproval,
  pushTool,
  resolveApproval,
  settleTool,
} from "@/lib/chat/blocks";

const tool = (toolCallId: string, over: Partial<Extract<Block, { kind: "tool" }>> = {}) =>
  ({
    toolCallId,
    tool: "search",
    summary: null,
    target: null,
    args: null,
    status: null,
    url: null,
    ...over,
  }) as Omit<Extract<Block, { kind: "tool" }>, "kind">;

describe("이어붙이기", () => {
  it("이어지는 토큰은 같은 본문 블록에 붙는다", () => {
    expect(appendText(appendText([], "안"), "녕")).toEqual([
      { kind: "text", text: "안녕" },
    ]);
  });

  it("종류가 다르면 새 블록이 선다 — 순서가 곧 시간이다", () => {
    expect(appendText(appendThinking([], "음"), "안")).toEqual([
      { kind: "thinking", text: "음" },
      { kind: "text", text: "안" },
    ]);
  });

  it("빈 델타는 블록을 안 만든다", () => {
    expect(appendText([], "")).toEqual([]);
  });

  it("제자리 수정을 안 한다 — 새 배열을 돌려준다", () => {
    const before: Block[] = [{ kind: "text", text: "안" }];
    const after = appendText(before, "녕");
    expect(before).toEqual([{ kind: "text", text: "안" }]);
    expect(after).not.toBe(before);
  });
});

describe("도구", () => {
  it("마감은 같은 toolCallId 의 블록을 찾는다", () => {
    const opened = pushTool([], tool("t1"));
    const settled = settleTool(opened, "t1", {
      tool: null,
      summary: "3건 찾음",
      status: "error",
      url: null,
    });
    expect(settled).toHaveLength(1);
    expect(settled[0]).toMatchObject({ kind: "tool", status: "error" });
  });

  // 승인을 거친 쓰기 도구는 tool_call_start 없이 곧장 결과가 온다
  it("짝을 못 찾으면 승인 블록에서 이름을 이어 쓴다", () => {
    const approved = pushApproval([], {
      approvalId: "a1",
      toolCallId: "t9",
      tool: "linear.create_issue",
      summary: null,
      decision: "APPROVED",
    });
    const settled = settleTool(approved, "t9", {
      tool: null,
      summary: "만들었습니다",
      status: "success",
      url: "https://x",
    });
    expect(settled.at(-1)).toMatchObject({
      kind: "tool",
      tool: "linear.create_issue",
      args: null,
    });
  });

  // 결과로 덮으면 「무엇을 하다 3건을 찾았는지」가 사라진다
  it("시작 요약과 결과 요약을 둘 다 남긴다", () => {
    expect(joinSummary("전사 검색", "3건 찾음")).toBe("전사 검색 · 3건 찾음");
    expect(joinSummary(null, "3건 찾음")).toBe("3건 찾음");
    expect(joinSummary("전사 검색", null)).toBe("전사 검색");
    expect(joinSummary("같다", "같다")).toBe("같다");
  });
});

describe("승인", () => {
  it("같은 toolCallId 의 도구 블록이 없어도 카드가 선다", () => {
    const blocks = pushApproval([], {
      approvalId: "a1",
      toolCallId: "없음",
      tool: "write",
      summary: null,
      decision: null,
    });
    expect(blocks).toHaveLength(1);
  });

  it("확정은 카드를 지우지 않고 결정만 채운다", () => {
    const opened = pushApproval([], {
      approvalId: "a1",
      toolCallId: "t1",
      tool: "write",
      summary: null,
      decision: null,
    });
    expect(resolveApproval(opened, "a1", "REJECTED")).toEqual([
      {
        kind: "approval",
        approvalId: "a1",
        toolCallId: "t1",
        tool: "write",
        summary: null,
        decision: "REJECTED",
      },
    ]);
  });
});

describe("확정 본문이 토큰 합을 이긴다", () => {
  it("본문 블록을 통째로 갈아끼운다", () => {
    const grown = appendText(appendText([], "안"), "녕");
    expect(finalizeText(grown, "안녕하세요")).toEqual([
      { kind: "text", text: "안녕하세요" },
    ]);
  });

  // 마지막 것만 바꾸면 도구 앞쪽 본문이 남아 content 와 겹쳐 두 번 보인다
  it("도구 사이에 끼어 있던 앞쪽 본문도 걷는다", () => {
    const blocks: Block[] = [
      { kind: "text", text: "앞" },
      { kind: "tool", ...tool("t1") },
      { kind: "text", text: "뒤" },
    ];
    const settled = finalizeText(blocks, "앞뒤 전부");
    expect(settled.filter((b) => b.kind === "text")).toEqual([
      { kind: "text", text: "앞뒤 전부" },
    ]);
    expect(settled).toHaveLength(2);
  });

  it("생각·도구·승인은 자리를 지킨다 — content 에 안 들어 있다", () => {
    const blocks: Block[] = [
      { kind: "thinking", text: "음" },
      { kind: "text", text: "안" },
    ];
    expect(finalizeText(blocks, "안녕")).toEqual([
      { kind: "thinking", text: "음" },
      { kind: "text", text: "안녕" },
    ]);
  });

  it("빈 content 면 본문 블록이 하나도 안 남는다", () => {
    expect(finalizeText([{ kind: "text", text: "안" }], "")).toEqual([]);
  });

  it("answerText 는 본문만 모은다", () => {
    const blocks: Block[] = [
      { kind: "thinking", text: "음" },
      { kind: "text", text: "안" },
      { kind: "text", text: "녕" },
    ];
    expect(answerText(blocks)).toBe("안녕");
  });
});

describe("묶기", () => {
  it("연속된 생각·도구·승인을 한 묶음으로 접는다", () => {
    const blocks: Block[] = [
      { kind: "thinking", text: "음" },
      { kind: "tool", ...tool("t1") },
      { kind: "text", text: "답" },
    ];
    const groups = groupBlocks(blocks);
    expect(groups.map((g) => g.kind)).toEqual(["steps", "text"]);
    expect(groups[0]).toMatchObject({ blocks: expect.any(Array) });
  });

  // 답을 쓰기 시작한 뒤의 도구 호출은 앞 묶음의 일부가 아니다
  it("본문이 끼면 묶음이 끊긴다", () => {
    const blocks: Block[] = [
      { kind: "thinking", text: "음" },
      { kind: "text", text: "답" },
      { kind: "tool", ...tool("t2") },
    ];
    expect(groupBlocks(blocks).map((g) => g.kind)).toEqual([
      "steps",
      "text",
      "steps",
    ]);
  });

  it("빈 배열은 빈 묶음이다", () => {
    expect(groupBlocks([])).toEqual([]);
  });
});
