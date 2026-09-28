/**
 * 블록 목록을 접고 이어붙이는 순수 함수들. 한 배열의 순서가 곧 시간이다. 계약의 함정
 * 하나(`message_end.content` 가 토큰 합을 이긴다)를 여기서 진다.
 */

/**
 * 도구가 향하는 곳. `kind` 는 열어 둔다 — 모르는 `kind` 는 칩 없이 `summary` 로 떨어진다.
 * 여기서 정의하고 `stream-protocol` 이 다시 내보낸다. 반대면 순수 블록 층이 리듀서를
 * 참조한다.
 */
export type ToolTarget = {
  kind: string;
  id: string | null;
  title: string | null;
};

export type ApprovalDecision = "APPROVED" | "REJECTED";

/** 모델이 도구를 부른 인자. 도구마다 모양이 달라 닫지 않는다. 화면은 이름-값 쌍으로 읽는다. */
export type ToolArgs = Record<string, unknown> | null;

export type Block =
  /** 모델이 답을 쓰기 전에 흘린 계획 문장. 답변 본문이 아니다. */
  | { kind: "thinking"; text: string }
  | {
      kind: "tool";
      toolCallId: string;
      tool: string;
      summary: string | null;
      /** 이 도구가 향하는 곳. 눌러서 그 회의록으로 간다. 모르는 kind면 null로 접는다. */
      target: ToolTarget | null;
      /**
       * 모델이 이 도구를 부른 인자. 계약상 인자를 나르는 것은 `tool_call_start` 뿐이라 여기가
       * 유일한 출처다. `tool_approval_request` 는 같은 `toolCallId` 로 이 블록을 찾는다.
       */
      args: ToolArgs;
      /**
       * 실행 중에는 null. `stopped`·`unknown` 은 화면만의 값으로, 결과 없이 끝난 턴을
       * `settleEndedTurn` 이 닫을 때 쓴다.
       */
      status: "success" | "error" | "stopped" | "unknown" | null;
      url: string | null;
    }
  | {
      kind: "approval";
      approvalId: string;
      /** 뒤따르는 tool_call_result가 도구 이름을 찾아오는 열쇠. */
      toolCallId: string;
      tool: string;
      summary: string | null;
      /** 확정 전에는 null. tool_approval_resolved가 채운다. */
      decision: ApprovalDecision | null;
    }
  | { kind: "text"; text: string };

/** 같은 종류가 연속이면 이어붙이고 아니면 새 블록을 연다. */
function appendRun(
  blocks: Block[],
  kind: "text" | "thinking",
  delta: string
): Block[] {
  if (!delta) return blocks;
  const last = blocks.at(-1);
  if (last?.kind === kind) {
    return [...blocks.slice(0, -1), { ...last, text: last.text + delta }];
  }
  return [...blocks, { kind, text: delta }];
}

export function appendText(blocks: Block[], delta: string): Block[] {
  return appendRun(blocks, "text", delta);
}

export function appendThinking(blocks: Block[], delta: string): Block[] {
  return appendRun(blocks, "thinking", delta);
}

export function pushTool(
  blocks: Block[],
  tool: Omit<Extract<Block, { kind: "tool" }>, "kind">
): Block[] {
  return [...blocks, { kind: "tool", ...tool }];
}

/**
 * 결과를 시작 블록에 겹친다. 승인을 거친 쓰기 도구는 `tool_call_start` 없이 결과가 오고
 * payload 에 `tool` 도 없어서, 짝이 없으면 새로 열고 이름은 같은 `toolCallId` 의 승인 블록에서
 * 가져온다.
 */
export function settleTool(
  blocks: Block[],
  toolCallId: string,
  patch: {
    tool: string | null;
    summary: string | null;
    status: "success" | "error";
    url: string | null;
  }
): Block[] {
  const found = blocks.some(
    (block) => block.kind === "tool" && block.toolCallId === toolCallId
  );
  if (found) {
    return blocks.map((block) =>
      block.kind === "tool" && block.toolCallId === toolCallId
        ? {
            ...block,
            status: patch.status,
            summary: joinSummary(block.summary, patch.summary),
            url: patch.url,
          }
        : block
    );
  }
  const named = blocks.find(
    (block) => block.kind === "approval" && block.toolCallId === toolCallId
  );
  return pushTool(blocks, {
    toolCallId,
    tool: patch.tool ?? (named?.kind === "approval" ? named.tool : ""),
    summary: patch.summary,
    target: null,
    // 인자는 `tool_call_start` 만 나르는데 이 갈래는 그 이벤트를 못 본 경우다.
    args: null,
    status: patch.status,
    url: patch.url,
  });
}

/**
 * 끝난 턴의 결과 없는 도구를 닫는다. 승인받은 쓰기는 나갔는지 모르므로 `unknown`, 나머지는
 * `stopped`. 짝 도구 블록 없이 승인만 있으면 그 뒤에 `unknown` 줄을 세운다. 실시간과
 * 히스토리가 이 함수 하나를 지난다.
 */
export function settleEndedTurn(
  blocks: Block[],
  /** 끝을 server 가 말하지 않았다(재연결 포기). 멈췄는지도 모르므로 전부 `unknown` 이다. */
  outcomeKnown = true
): Block[] {
  const tools = new Set<string>();
  const approved = new Set<string>();
  for (const block of blocks) {
    if (block.kind === "tool") tools.add(block.toolCallId);
    if (block.kind === "approval" && block.decision === "APPROVED")
      approved.add(block.toolCallId);
  }
  let changed = false;
  const settled = blocks.flatMap((block): Block[] => {
    if (block.kind === "tool" && block.status === null) {
      changed = true;
      return [
        {
          ...block,
          status:
            outcomeKnown && !approved.has(block.toolCallId)
              ? "stopped"
              : "unknown",
        },
      ];
    }
    if (
      block.kind === "approval" &&
      block.decision === "APPROVED" &&
      !tools.has(block.toolCallId)
    ) {
      changed = true;
      return [
        block,
        {
          kind: "tool",
          toolCallId: block.toolCallId,
          // 이름은 바로 위 승인 줄이 말한다. 도구 id 로 채우면 같은 일을 두 이름으로 부른다.
          tool: "",
          summary: block.summary,
          target: null,
          args: null,
          status: "unknown",
          url: null,
        },
      ];
    }
    return [block];
  });
  return changed ? settled : blocks;
}

/** 시작 요약과 결과 요약을 둘 다 남긴다(「전사에서 관련 발화 검색 · 3건 찾음」). */
export function joinSummary(started: string | null, settled: string | null) {
  if (!settled) return started;
  if (!started || started === settled) return settled;
  return `${started} · ${settled}`;
}

export function pushApproval(
  blocks: Block[],
  approval: Omit<Extract<Block, { kind: "approval" }>, "kind">
): Block[] {
  return [...blocks, { kind: "approval", ...approval }];
}

export function resolveApproval(
  blocks: Block[],
  approvalId: string,
  decision: ApprovalDecision
): Block[] {
  return blocks.map((block) =>
    block.kind === "approval" && block.approvalId === approvalId
      ? { ...block, decision }
      : block
  );
}

/**
 * 확정된 답변으로 본문을 갈아끼운다. `text` 블록을 전부 버리고 하나로 다시 세운다 — 마지막
 * 것만 바꾸면 도구 사이의 앞쪽 본문이 `content` 와 겹쳐 두 번 보인다. 히스토리의 ASSISTANT
 * 행도 `content` 하나라 새로고침 뒤와 같아진다. 생각·도구·승인 블록은 자리를 지킨다.
 */
export function finalizeText(blocks: Block[], content: string): Block[] {
  // 같으면 손대지 않는다. 새 배열이면 본문이 도구 아래 한 덩어리로 옮겨 앉고 답 전체가
  // 다시 마운트되며 한 번 더 떠오른다.
  if (answerText(blocks) === content) return blocks;
  const kept = blocks.filter((block) => block.kind !== "text");
  return content ? [...kept, { kind: "text", text: content }] : kept;
}

/** 화면에 그려질 답변 본문. 스크롤 추적 키로도 쓴다. */
export function answerText(blocks: Block[]): string {
  return blocks
    .filter((block) => block.kind === "text")
    .map((block) => block.text)
    .join("");
}

/**
 * 연속된 `thinking`·`tool`·`approval` 을 한 묶음으로 접는다. 본문이 끼면 묶음이 끊긴다 —
 * 답을 쓰기 시작한 뒤의 도구 호출은 앞 묶음의 일부가 아니다.
 */
export type Group =
  | { kind: "steps"; blocks: Exclude<Block, { kind: "text" }>[] }
  | { kind: "text"; text: string };

export function groupBlocks(blocks: Block[]): Group[] {
  const groups: Group[] = [];
  for (const block of blocks) {
    if (block.kind === "text") {
      groups.push({ kind: "text", text: block.text });
      continue;
    }
    const last = groups.at(-1);
    if (last?.kind === "steps") last.blocks.push(block);
    else groups.push({ kind: "steps", blocks: [block] });
  }
  return groups;
}
