/** 계약의 함정 하나(`message_end.content` 가 토큰 합을 이깁니다)를 여기서 집니다. */
import type { ApprovalCardData } from "@/lib/chat/approval-card";

export type ToolTarget = {
  kind: string;
  id: string | null;
  title: string | null;
};

export type ApprovalDecision = "APPROVED" | "REJECTED";

export type Block =
  | { kind: "thinking"; text: string }
  | {
      kind: "tool";
      toolCallId: string;
      tool: string;
      summary: string | null;
      target: ToolTarget | null;
      status: "success" | "error" | "stopped" | "unknown" | null;
      url: string | null;
    }
  | {
      kind: "approval";
      approvalId: string;
      toolCallId: string;
      tool: string;
      summary: string | null;
      card: ApprovalCardData | null;
      decision: ApprovalDecision | null;
    }
  | { kind: "text"; text: string };

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

/** 승인을 거친 쓰기 도구는 `tool_call_start` 없이 결과가 오고 payload 에 `tool` 도 없어, 이름을 같은 `toolCallId` 의 승인 블록에서 가져옵니다. */
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
  const orphan = blocks.find(
    (block) =>
      block.kind === "approval" &&
      block.toolCallId === "" &&
      block.decision === "APPROVED"
  );
  const adopted = orphan
    ? blocks.map((block) =>
        block === orphan ? { ...block, toolCallId } : block
      )
    : blocks;
  const named = adopted.find(
    (block) => block.kind === "approval" && block.toolCallId === toolCallId
  );
  return pushTool(adopted, {
    toolCallId,
    tool: patch.tool ?? (named?.kind === "approval" ? named.tool : ""),
    summary: patch.summary,
    target: null,
    status: patch.status,
    url: patch.url,
  });
}

export function settleEndedTurn(blocks: Block[], outcomeKnown = true): Block[] {
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
          tool: "",
          summary: block.summary,
          target: null,
          status: "unknown",
          url: null,
        },
      ];
    }
    return [block];
  });
  return changed ? settled : blocks;
}

export function joinSummary(started: string | null, settled: string | null) {
  if (!settled) return started;
  if (!started || settled.startsWith(started)) return settled;
  return `${started} · ${settled}`;
}

export function pushApproval(
  blocks: Block[],
  approval: Omit<Extract<Block, { kind: "approval" }>, "kind">
): Block[] {
  return [...blocks, { kind: "approval", ...approval }];
}

/** 재진입한 화면에는 승인 블록이 없습니다 — 스트림이 대기 프레임을 다시 보내지 않아 히스토리의 `pendingApproval` 로 세웁니다. */
export function decideApproval(
  blocks: Block[],
  pending: {
    approvalId: string;
    tool: string;
    summary: string | null;
    card: ApprovalCardData | null;
  } | null,
  approvalId: string,
  decision: ApprovalDecision
): Block[] {
  const known = blocks.some(
    (block) => block.kind === "approval" && block.approvalId === approvalId
  );
  if (known || pending?.approvalId !== approvalId) {
    return resolveApproval(blocks, approvalId, decision);
  }
  return pushApproval(blocks, {
    approvalId,
    toolCallId: "",
    tool: pending.tool,
    summary: pending.summary,
    card: pending.card,
    decision,
  });
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

export function finalizeText(blocks: Block[], content: string): Block[] {
  if (answerText(blocks) === content) return blocks;
  const kept = blocks.filter((block) => block.kind !== "text");
  return content ? [...kept, { kind: "text", text: content }] : kept;
}

export function answerText(blocks: Block[]): string {
  return blocks
    .filter((block) => block.kind === "text")
    .map((block) => block.text)
    .join("");
}

export type Group =
  | { kind: "steps"; blocks: Exclude<Block, { kind: "text" }>[] }
  | {
      kind: "approval";
      approval: Extract<Block, { kind: "approval" }>;
      tool: Extract<Block, { kind: "tool" }> | null;
    }
  | { kind: "text"; text: string };

export function groupBlocks(blocks: Block[]): Group[] {
  const gated = new Set(
    blocks.flatMap((block) =>
      block.kind === "approval" ? [block.toolCallId] : []
    )
  );
  const groups: Group[] = [];
  for (const block of blocks) {
    if (block.kind === "text") {
      groups.push({ kind: "text", text: block.text });
      continue;
    }
    if (block.kind === "approval" && block.decision) {
      const tool = blocks.find(
        (each): each is Extract<Block, { kind: "tool" }> =>
          each.kind === "tool" && each.toolCallId === block.toolCallId
      );
      groups.push({ kind: "approval", approval: block, tool: tool ?? null });
      continue;
    }
    if (block.kind === "tool" && gated.has(block.toolCallId)) continue;
    const last = groups.at(-1);
    if (last?.kind === "steps") last.blocks.push(block);
    else groups.push({ kind: "steps", blocks: [block] });
  }
  return groups;
}

type StepBlock = Exclude<Block, { kind: "text" }>;
type ToolBlock = Extract<Block, { kind: "tool" }>;

export type StepLine =
  | { kind: "single"; key: string; block: StepBlock }
  | { kind: "run"; key: string; tool: string; blocks: ToolBlock[] };

export function groupSteps(blocks: StepBlock[]): StepLine[] {
  const groupable = (block: StepBlock): block is ToolBlock =>
    block.kind === "tool" &&
    block.tool !== "" &&
    (block.status === null || block.status === "success");

  const runs: { at: number; blocks: StepBlock[] }[] = [];
  blocks.forEach((block, at) => {
    const run = runs.at(-1);
    const head = run?.blocks[0];
    if (run && head?.kind === "thinking" && block.kind === "thinking") {
      run.blocks[0] = { kind: "thinking", text: head.text + block.text };
    } else if (
      run &&
      head &&
      groupable(head) &&
      groupable(block) &&
      head.tool === block.tool
    ) {
      run.blocks.push(block);
    } else {
      runs.push({ at, blocks: [block] });
    }
  });
  return runs.map(({ at, blocks: run }) => {
    const head = run[0];
    if (run.length > 1 && head.kind === "tool") {
      return {
        kind: "run",
        key: stepKey(head, at),
        tool: head.tool,
        blocks: run as ToolBlock[],
      };
    }
    return { kind: "single", key: stepKey(head, at), block: head };
  });
}

function stepKey(block: StepBlock, at: number) {
  if (block.kind === "approval") return `approval-${block.approvalId}`;
  if (block.kind === "tool") return `tool-${block.toolCallId}`;
  return `thinking-${at}`;
}
