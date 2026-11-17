/**
 * 계약(`asyncapi.yml` 의 `agentChatStream`)의 함정입니다.
 * - `message_end.content` 가 토큰 합을 이깁니다.
 * - `tool_call_result` 의 `status=error` 는 종료가 아닙니다.
 * - 종료 프레임 없이 끊기는 경로가 있습니다.
 */
import {
  type Block,
  appendText,
  appendThinking,
  finalizeText,
  pushApproval,
  pushTool,
  resolveApproval,
  settleTool,
} from "@/lib/chat/blocks";

export type { ApprovalDecision, Block, ToolTarget } from "@/lib/chat/blocks";
import type { ApprovalDecision, ToolTarget } from "@/lib/chat/blocks";
import type {
  ApprovalCardData,
  ApprovalCardField,
  ApprovalCardItem,
} from "@/lib/chat/approval-card";

export const CHAT_STREAM_PHASES = [
  "idle",
  "streaming",
  "awaiting_approval",
  "done",
  "failed",
  "cancelled",
] as const;

export type ChatStreamPhase = (typeof CHAT_STREAM_PHASES)[number];

export type NoteRef = {
  kind: "note";
  id: string;
  title: string;
};

export type ChatStreamState = {
  phase: ChatStreamPhase;
  messageId: string | null;
  turnId: string | null;
  cursor: string | null;
  blocks: Block[];
  content: string | null;
  /** `message_end` 가 채웁니다. 범위 밖 회의록이 여기 서는 것이 곧 알림이라 따로 프레임이 없습니다. */
  refs: NoteRef[];
  pendingApproval: {
    approvalId: string;
    tool: string;
    summary: string | null;
    card: ApprovalCardData | null;
  } | null;
  error: { code: string; message: string | null } | null;
  retryable: boolean | null;
  needsResync: boolean;
};

export const initialStreamState: ChatStreamState = {
  phase: "idle",
  messageId: null,
  turnId: null,
  cursor: null,
  blocks: [],
  content: null,
  refs: [],
  pendingApproval: null,
  error: null,
  retryable: null,
  needsResync: false,
};

export function startedState(input: { turnId: string }): ChatStreamState {
  return { ...initialStreamState, phase: "streaming", turnId: input.turnId };
}

export function resumedState(input: {
  cursor: string | null;
  turnId: string;
  pendingApproval: ChatStreamState["pendingApproval"];
  partialAnswer?: string | null;
}): ChatStreamState {
  const awaitingApproval = input.pendingApproval !== null;
  return {
    ...initialStreamState,
    phase: awaitingApproval ? "awaiting_approval" : "streaming",
    turnId: input.turnId,
    cursor: input.cursor,
    pendingApproval: input.pendingApproval,
    blocks:
      !awaitingApproval && input.partialAnswer
        ? appendText([], input.partialAnswer)
        : [],
  };
}

export function failedTurnState(
  failureCode: string | null,
  retryable: boolean | null
): ChatStreamState {
  const code = failureCode ?? "INTERNAL_ERROR";
  return {
    ...initialStreamState,
    phase: "failed",
    retryable,
    error: { code, message: null },
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function texts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((each) => (text(each) ? [each as string] : []))
    : [];
}

function field(value: unknown): ApprovalCardField | null {
  const raw = record(value);
  const label = raw && text(raw.label);
  if (!raw || !label) return null;
  const parsed = {
    label,
    value: text(raw.value),
    before: text(raw.before),
    after: text(raw.after),
    added: texts(raw.added),
    removed: texts(raw.removed),
    kept: texts(raw.kept),
  };
  const empty =
    !parsed.value &&
    !parsed.before &&
    !parsed.after &&
    parsed.added.length + parsed.removed.length + parsed.kept.length === 0;
  return empty ? null : parsed;
}

function fields(value: unknown): ApprovalCardField[] {
  return Array.isArray(value)
    ? value.flatMap((each) => {
        const parsed = field(each);
        return parsed ? [parsed] : [];
      })
    : [];
}

function item(value: unknown): ApprovalCardItem | null {
  const raw = record(value);
  const title = raw && text(raw.title);
  if (!raw || !title) return null;
  return { title, target: text(raw.target), fields: fields(raw.fields) };
}

export function parseApprovalCard(value: unknown): ApprovalCardData | null {
  const raw = record(value);
  const title = raw && text(raw.title);
  if (!raw || !title) return null;
  const body = record(raw.body);
  const bodyText = body && text(body.text);
  return {
    title,
    target: text(raw.target),
    warning: text(raw.warning),
    fields: fields(raw.fields),
    items: Array.isArray(raw.items)
      ? raw.items.flatMap((each) => {
          const parsed = item(each);
          return parsed ? [parsed] : [];
        })
      : [],
    body: bodyText
      ? { label: text(body.label), text: bodyText }
      : null,
  };
}

function toolTarget(value: unknown): ToolTarget | null {
  const raw = record(value);
  const kind = raw && text(raw.kind);
  if (!kind) return null;
  return { kind, id: text(raw.id), title: text(raw.title) };
}

function noteRefs(value: unknown): NoteRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const raw = record(item);
    const id = raw && text(raw.id);
    const title = raw && text(raw.title);
    if (!raw || !id || !title) return [];
    return [{ kind: "note" as const, id, title }];
  });
}

function advanceCursor(
  current: string | null,
  id: string | undefined
): string | null {
  return id === undefined ? current : id;
}

export const KNOWN_EVENTS: ReadonlySet<string> = new Set([
  "message_start",
  "token",
  "thinking_delta",
  "tool_call_start",
  "tool_call_result",
  "tool_approval_request",
  "tool_approval_resolved",
  "message_end",
  "error",
  "turn_failed",
  "turn_cancelled",
]);

const INERT_EVENTS: ReadonlySet<string> = new Set(["heartbeat"]);

export function reduceStreamEvent(
  state: ChatStreamState,
  event: { event: string; data: string; id?: string }
): ChatStreamState {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.data) as Record<string, unknown>;
  } catch {
    // `data:` 는 ai 가, `id:` 는 서버가 씁니다. 깨진 `data:` 라도 커서는 옮겨야 재접속이 옛 자리부터 받지 않습니다.
    return { ...state, cursor: advanceCursor(state.cursor, event.id) };
  }

  const base: ChatStreamState = {
    ...state,
    cursor: advanceCursor(state.cursor, event.id),
  };

  switch (event.event) {
    // 스트림을 열기 전 실패(`UPSTREAM_REJECTED`)는 `error` 이벤트 없이 이것만 옵니다.
    case "turn_failed": {
      const code = String(payload.code ?? "INTERNAL_ERROR");
      return {
        ...base,
        phase: "failed",
        blocks: base.blocks.filter((block) => block.kind !== "text"),
        pendingApproval: null,
        retryable: typeof payload.retryable === "boolean" ? payload.retryable : null,
        error: { code, message: null },
      };
    }

    case "turn_cancelled":
      return { ...base, phase: "cancelled", pendingApproval: null };

    case "message_start":
      return {
        ...base,
        phase: "streaming",
        messageId: text(payload.messageId),
      };

    case "token":
      return {
        ...base,
        phase: "streaming",
        blocks: appendText(base.blocks, String(payload.delta ?? "")),
      };

    case "thinking_delta":
      return {
        ...base,
        phase: "streaming",
        blocks: appendThinking(base.blocks, String(payload.text ?? "")),
      };

    case "message_end": {
      const content = String(payload.content ?? "");
      return {
        ...base,
        phase: "done",
        content,
        blocks: finalizeText(base.blocks, content),
        refs: noteRefs(payload.refs),
      };
    }

    // 종료가 아닙니다. 실패 코드는 뒤따르는 `turn_failed` 에서 server 가 정합니다.
    case "error":
      return {
        ...base,
        error: {
          code: String(payload.code ?? "UNKNOWN"),
          message: text(payload.message),
        },
      };

    case "tool_call_start":
      return {
        ...base,
        phase: "streaming",
        blocks: pushTool(base.blocks, {
          toolCallId: String(payload.toolCallId ?? ""),
          tool: String(payload.tool ?? ""),
          summary: text(payload.summary),
          target: toolTarget(payload.target),
          status: null,
          url: null,
        }),
      };

    case "tool_call_result":
      return {
        ...base,
        phase: "streaming",
        blocks: settleTool(base.blocks, String(payload.toolCallId ?? ""), {
          tool: text(payload.tool),
          summary: text(payload.summary),
          status: payload.status === "error" ? "error" : "success",
          url: text(payload.url),
        }),
      };

    case "tool_approval_request": {
      const toolCallId = String(payload.toolCallId ?? "");
      const pending = {
        approvalId: String(payload.approvalId ?? ""),
        tool: String(payload.tool ?? ""),
        summary: text(payload.summary),
        card: parseApprovalCard(payload.card),
      };
      return {
        ...base,
        phase: "awaiting_approval",
        pendingApproval: pending,
        blocks: pushApproval(base.blocks, {
          approvalId: pending.approvalId,
          tool: pending.tool,
          summary: pending.summary,
          card: pending.card,
          toolCallId,
          decision: null,
        }),
      };
    }

    case "tool_approval_resolved": {
      const decision: ApprovalDecision =
        payload.decision === "REJECTED" ? "REJECTED" : "APPROVED";
      return {
        ...base,
        phase: "streaming",
        pendingApproval: null,
        blocks: resolveApproval(
          base.blocks,
          String(payload.approvalId ?? ""),
          decision
        ),
      };
    }

    default:
      if (!INERT_EVENTS.has(event.event)) {
        console.warn(`[chat] 모르는 SSE 이벤트: ${event.event}`);
      }
      return base;
  }
}

export function endStream(
  state: ChatStreamState,
  reason: "closed" | "cancelled" | "gaveUp"
): ChatStreamState {
  if (reason === "cancelled")
    return { ...state, phase: "cancelled", pendingApproval: null };
  if (reason === "gaveUp") {
    if (state.phase !== "streaming") return state;
    return {
      ...state,
      phase: "failed",
      pendingApproval: null,
      retryable: true,
      error: { code: "STREAM_INTERRUPTED", message: null },
    };
  }
  return state;
}
