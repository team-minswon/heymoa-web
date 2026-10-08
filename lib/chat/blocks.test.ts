import { describe, expect, it } from "vitest";

import {
  answerText,
  appendText,
  appendThinking,
  type Block,
  finalizeText,
  groupBlocks,
  groupSteps,
  joinSummary,
  pushApproval,
  pushTool,
  resolveApproval,
  settleEndedTurn,
  settleTool,
} from "@/lib/chat/blocks";

const tool = (
  toolCallId: string,
  over: Partial<Extract<Block, { kind: "tool" }>> = {}
) =>
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

  // 결과 문구가 시작 문구를 이미 품는다(ai 가 「라벨 · 인자 · 결과」로 낸다). 붙이면 라벨이 두 번 찍힌다.
  it("결과 요약이 시작 요약으로 시작하면 결과 요약만 쓴다", () => {
    expect(
      joinSummary('스크립트 검색 · "배포"', '스크립트 검색 · "배포" · 20건')
    ).toBe('스크립트 검색 · "배포" · 20건');
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

  it("★ 흘린 것과 같으면 아무것도 안 옮긴다 — 마지막 프레임에서 화면이 안 흔들린다", () => {
    // 갈아끼우기는 **어긋났을 때의 안전망**이지 매 턴의 의식이 아니다. 같은데도 새 배열을
    // 만들면 본문이 도구 카드 **아래로 옮겨 앉고**, 낱말이 전부 새로 마운트돼 답 전체가
    // 한 프레임에 다시 떠오른다 — QA 가 본 「마지막에 깜빡인다」의 web 쪽 몫이다.
    const blocks: Block[] = [
      { kind: "text", text: "앞" },
      { kind: "tool", ...tool("t1") },
      { kind: "text", text: "뒤" },
    ];
    expect(finalizeText(blocks, "앞뒤")).toBe(blocks);
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

describe("타임라인 줄 묶기", () => {
  const read = (id: string, name = "transcripts.read") =>
    ({ kind: "tool", ...tool(id, { tool: name, status: "success" }) }) as const;

  it("이어지는 같은 조회 도구는 한 줄로 묶는다", () => {
    const rows = groupSteps([
      { kind: "thinking", text: "찾습니다" },
      read("t1"),
      read("t2"),
      read("t3"),
      read("t4", "transcripts.search"),
    ]);
    expect(rows.map((row) => row.kind)).toEqual(["single", "run", "single"]);
    expect(rows[1]).toMatchObject({ key: "tool-t1", tool: "transcripts.read" });
    expect(rows[1].kind === "run" && rows[1].blocks.length).toBe(3);
  });

  it("사이에 생각이 끼면 끊긴다", () => {
    const rows = groupSteps([
      read("t1"),
      { kind: "thinking", text: "음" },
      read("t2"),
    ]);
    expect(rows.map((row) => row.kind)).toEqual(["single", "single", "single"]);
  });

  // 승인을 거친 도구가 쓰기다. 무엇을 바꿨는지는 한 건씩 보여야 한다.
  it("승인·쓰기 도구는 묶지 않는다", () => {
    const write = (id: string) =>
      ({
        kind: "tool",
        ...tool(id, { tool: "linear.create_issue", status: "success" }),
      }) as const;
    const approve = (id: string) =>
      ({
        kind: "approval",
        approvalId: `a-${id}`,
        toolCallId: id,
        tool: "linear.create_issue",
        summary: null,
        decision: "APPROVED",
      }) as const;
    const rows = groupSteps([
      write("w1"),
      approve("w1"),
      write("w2"),
      approve("w2"),
      approve("w3"),
      approve("w4"),
    ]);
    expect(rows.every((row) => row.kind === "single")).toBe(true);
  });

  it("실패·중단한 호출은 묶지 않는다 — 그 줄의 사유가 보여야 한다", () => {
    const rows = groupSteps([
      read("t1"),
      { ...read("t2"), status: "error" },
      read("t3"),
    ]);
    expect(rows.map((row) => row.kind)).toEqual(["single", "single", "single"]);
  });

  // 두 번째 호출이 와서 줄이 묶음이 돼도 키가 같아야 그 자리의 상태가 안 날아간다.
  it("묶음의 키는 첫 호출의 단독 줄 키와 같다", () => {
    expect(groupSteps([read("t1")])[0].key).toBe(
      groupSteps([read("t1"), read("t2")])[0].key
    );
  });

  // 생각은 델타마다 조각으로 온다(히스토리는 델타마다 한 행, 재개는 커서 앞뒤로 갈린다). 도구 사이의
  // 생각은 한 문단이다.
  it("이어진 생각 조각은 한 줄로 잇는다", () => {
    const rows = groupSteps([
      { kind: "thinking", text: "회의를 찾습니다." },
      { kind: "thinking", text: " 배포 날짜를 봅니다." },
      read("t1"),
      { kind: "thinking", text: "정리합니다." },
    ]);
    expect(rows.map((row) => row.kind)).toEqual(["single", "single", "single"]);
    expect(rows[0]).toMatchObject({
      key: "thinking-0",
      block: { kind: "thinking", text: "회의를 찾습니다. 배포 날짜를 봅니다." },
    });
  });

  // 앞 묶음이 갈려도 뒤 줄의 키가 안 바뀐다 — 바뀌면 그 줄이 다시 마운트되며 한 번 더 떠오른다.
  it("생각 줄의 키는 묶음 수가 아니라 블록 자리로 정한다", () => {
    const before = groupSteps([
      read("t1"),
      read("t2"),
      { kind: "thinking", text: "음" },
    ]);
    const after = groupSteps([
      read("t1"),
      { ...read("t2"), status: "error" },
      { kind: "thinking", text: "음" },
    ]);
    expect(before.at(-1)?.key).toBe(after.at(-1)?.key);
  });

  // 실시간·재연결 재개·히스토리가 같은 블록이면 같은 줄이 나와야 한다. 블록을 안 바꾸는 순수 함수다.
  it("입력 배열을 바꾸지 않는다", () => {
    const steps = [read("t1"), read("t2")];
    const copy = structuredClone(steps);
    groupSteps(steps);
    expect(steps).toEqual(copy);
  });
});

/**
 * ★ N3 — 끝난 턴에 도는 표시도, 나갔을 수 있는 쓰기를 「안 함」으로 그리는 표시도 없다.
 * 실시간 스트림과 히스토리가 이 함수 하나를 지난다.
 */
describe("끝난 턴 닫기", () => {
  const approved = (
    toolCallId: string,
    summary: string | null = null
  ): Extract<Block, { kind: "approval" }> => ({
    kind: "approval",
    approvalId: `a-${toolCallId}`,
    toolCallId,
    tool: "linear.create_issue",
    summary,
    decision: "APPROVED",
  });

  it("결과 없이 끝난 조회 도구는 「중단됨」이다", () => {
    expect(settleEndedTurn(pushTool([], tool("c1")))).toMatchObject([
      { kind: "tool", toolCallId: "c1", status: "stopped" },
    ]);
  });

  it("승인받은 쓰기가 결과 없이 끝나면 「확인 필요」다 — 나갔는지 모른다", () => {
    const blocks = [...pushTool([], tool("c2")), approved("c2")];
    expect(settleEndedTurn(blocks)[0]).toMatchObject({ status: "unknown" });
  });

  it("짝 도구 블록 없는 승인(히스토리·재개)은 그 뒤에 「확인 필요」 줄이 선다", () => {
    const settled = settleEndedTurn([approved("c3", "Linear 이슈 생성")]);
    expect(settled).toMatchObject([
      { kind: "approval", decision: "APPROVED" },
      {
        kind: "tool",
        toolCallId: "c3",
        summary: "Linear 이슈 생성",
        status: "unknown",
      },
    ]);
  });

  it("거절한 쓰기와 결과가 온 도구는 그대로다", () => {
    const blocks: Block[] = [
      ...pushTool([], tool("c4")),
      { ...approved("c4"), decision: "REJECTED" },
      ...pushTool([], tool("c5", { status: "success" })),
      approved("c5"),
    ];
    expect(
      settleEndedTurn(blocks).map((b) => b.kind === "tool" && b.status)
    ).toEqual(["stopped", false, "success", false]);
  });

  it("바꿀 것이 없으면 같은 배열이다", () => {
    const blocks = pushTool([], tool("c6", { status: "error" }));
    expect(settleEndedTurn(blocks)).toBe(blocks);
  });
});
