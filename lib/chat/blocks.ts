/**
 * 블록 목록을 접고 이어붙이는 순수 함수들. 리듀서에서 갈라 둔 것은 **여기가 계약의 함정
 * 하나를 통째로 지고 있어서**다 — `message_end.content`가 토큰 합을 이긴다는 규칙.
 *
 * 예전 상태는 `{ text, records }`로 본문과 도구 기록이 **따로** 있었다. 그래서 도구가
 * 언제 끼어들었는지가 소실됐고 카드가 항상 본문 위에 몰렸다. 지금은 한 배열의 순서가
 * 곧 시간이다.
 */

/**
 * 도구가 향하는 곳. **`kind`가 열려 있다** — 도구가 늘어도 화면이 안 깨지게, 모르는
 * `kind`는 칩을 안 그리고 `summary`로 떨어진다.
 *
 * 여기서 정의하고 `stream-protocol`이 다시 내보낸다. 반대로 두면 순수 블록 층이
 * 리듀서를 참조해 의존이 거꾸로 선다.
 */
export type ToolTarget = {
  kind: string;
  id: string | null;
  title: string | null;
};

export type ApprovalDecision = "APPROVED" | "REJECTED";

/**
 * 모델이 도구를 부른 인자. **모양을 닫지 않는다** — 도구마다 다르고 server 도 해석하지
 * 않는다. 화면은 이름-값 쌍으로만 읽고, 값이 무엇이든 글자로 그린다.
 */
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
       * 모델이 이 도구를 부른 인자. **승인 카드가 「무엇을 승인하나」를 말하는 근거다.**
       *
       * 계약상 인자를 나르는 것은 `tool_call_start` 하나뿐이라 여기가 유일한 출처다 —
       * 뒤따르는 `tool_approval_request`에는 없고, 같은 `toolCallId`로 이 블록을 찾는다.
       */
      args: ToolArgs;
      /** 실행 중에는 null. tool_call_result가 채운다. */
      status: "success" | "error" | null;
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
 * 결과를 시작 블록에 겹친다. 짝을 못 찾으면 새로 연다 — **승인을 거친 쓰기 도구는
 * `tool_call_start` 없이 곧장 결과가 오고**, 그 payload에는 `tool`이 없다.
 * 이름은 같은 `toolCallId`의 승인 블록에서 이어 쓴다.
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
    // 인자는 `tool_call_start`만 나르는데 이 갈래는 그 이벤트를 못 본 경우다.
    args: null,
    status: patch.status,
    url: patch.url,
  });
}

/**
 * 시작 요약과 결과 요약을 **둘 다 남긴다.**
 *
 * 결과로 덮어쓰면 「3건 찾음」만 남아 **무엇을 하다 3건을 찾았는지**가 사라진다. 도구
 * 한 줄이 말해야 하는 것은 「전사에서 관련 발화 검색 · 3건 찾음」 한 문장이다.
 */
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
 * 확정된 답변으로 본문을 갈아끼운다.
 *
 * **`text` 블록을 전부 버리고 하나로 다시 세운다.** 마지막 것만 바꾸면 도구 사이에 끼어
 * 있던 앞쪽 본문이 남아 `content`와 겹쳐 두 번 보인다. 통째로 갈면 화면에 그려진 답이
 * `content`와 글자 단위로 같아지고, **새로고침 뒤 히스토리와도 같아진다** — 히스토리의
 * ASSISTANT 행은 `content` 하나뿐이라 어차피 저 모양이다.
 *
 * 생각·도구·승인 블록은 자리를 지킨다. 그것들은 `content`에 안 들어 있다.
 */
export function finalizeText(blocks: Block[], content: string): Block[] {
  // ★ **어긋났을 때만 손을 댄다.** 갈아끼우기는 안전망이지 매 턴의 의식이 아니다.
  //
  // 같은데도 새 배열을 만들면 두 가지가 같이 움직인다: 흩어져 있던 본문이 **도구 카드
  // 아래 한 덩어리로 옮겨 앉고**, 낱말 span 이 전부 새로 마운트돼 `chat-rise` 가 답
  // 전체에 한 번에 걸린다. 마지막 프레임에서 답이 통째로 다시 떠오르던 것이 이것이다.
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
 * 연속된 `thinking`·`tool`·`approval`을 한 묶음으로 접는다. Chain of Thought가 이걸
 * 그리고, **본문(`text`)이 끼면 묶음이 끊긴다** — 답을 쓰기 시작한 뒤의 도구 호출은
 * 앞 묶음의 일부가 아니다.
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
