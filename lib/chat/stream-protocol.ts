/**
 * 채팅 SSE 이벤트를 화면 상태로 접는 순수 리듀서. 계약은 `asyncapi.yml` 의 `agentChatStream`
 * 채널이다.
 *
 * 봉투는 없다. `data:` 에는 payload 하나만 실리고 커서는 `id:` 줄에만 있다. `turnId` 는
 * 프레임에서 오지 않고 `POST` 의 `202` 본문이나 `GET /messages` 의 `activeTurn` 이 준다.
 *
 * 계약의 함정 넷:
 *
 * 1. `message_end.content` 가 토큰 합을 이긴다. 토큰 합을 남기면 새로고침 뒤 히스토리와
 *    다른 글이 될 수 있어 `finalizeText` 가 본문을 갈아끼운다.
 * 2. `tool_call_result` 의 `status=error` 는 종료가 아니다. 도구만 실패했고 토큰은 이어진다.
 * 3. 종료 프레임 없이 끊기는 경로가 있다. 훅이 재연결하고, 포기하면 `endStream` 이 `failed`
 *    로 접는다.
 * 4. 모르는 이벤트로 화면이 죽으면 안 되지만 조용히 삼켜서도 안 된다. 아는 이벤트는
 *    `KNOWN_EVENTS` 에 전부 적는다.
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

export type {
  ApprovalDecision,
  Block,
  ToolArgs,
  ToolTarget,
} from "@/lib/chat/blocks";
import type { ApprovalDecision, ToolArgs, ToolTarget } from "@/lib/chat/blocks";

/**
 * 화면이 아는 상태 여섯. 늘리지 않는다 — `personal-chat.tsx` 의 `isStreaming` 이 phase 로
 * 갈려서 새 값 하나가 중지 버튼을 조용히 지운다. 새 이벤트는 이 여섯 중 하나로 접는다.
 *
 * 재연결 중에도 `streaming` 이다. `idle` 은 아직 시작 안 한 것이고 `done` 은 답이 끝난 것이다.
 * 배열로 둔 것은 테스트가 목록을 고정하기 위해서다.
 */
export const CHAT_STREAM_PHASES = [
  "idle",
  "streaming",
  "awaiting_approval",
  "done",
  "failed",
  "cancelled",
] as const;

export type ChatStreamPhase = (typeof CHAT_STREAM_PHASES)[number];

/** 이 턴에 근거로 쓴 회의록. 본 것이지 인용한 것이 아니다. */
export type NoteRef = {
  kind: "note";
  id: string;
  title: string;
};

export type ChatStreamState = {
  phase: ChatStreamPhase;
  messageId: string | null;
  /** 이 턴의 id. 프레임에서 오지 않는다(`startedState`·`resumedState`). 취소와 스트림 URL 이 쓴다. */
  turnId: string | null;
  /**
   * 마지막에 본 `id:`. 재접속의 `?after=` 값이다. 불투명한 문자열이라 크기 비교가 없다.
   * null 이면 `after` 를 빼고 처음부터 받는다.
   */
  cursor: string | null;
  /** 생각·도구·승인·본문이 한 배열에 시간 순서대로. */
  blocks: Block[];
  /** 확정된 답변. message_end 전에는 null이다. */
  content: string | null;
  /**
   * 에이전트가 실제로 본 회의록. `message_end` 가 채운다. 범위 밖을 봤다는 알림도 이
   * 목록이다 — 범위 밖 회의록이 여기 서는 것이 곧 알림이라 따로 프레임이 없다.
   */
  refs: NoteRef[];
  pendingApproval: {
    approvalId: string;
    tool: string;
    summary: string | null;
    /**
     * 이 승인이 실행할 인자. `tool_approval_request` 에는 안 실려서 같은 `toolCallId` 의 도구
     * 블록에서 집는다. 재진입에서는 그 프레임이 버퍼에서 밀려나 히스토리의
     * `pendingApproval.args` 가 준다.
     */
    args: ToolArgs;
  } | null;
  error: { code: string; message: string } | null;
  /** 다시 눌러도 되는 실패인가. server 의 닫힌 enum 이 정한다. 아직 화면 분기는 없다. */
  retryable: boolean | null;
  /**
   * 「히스토리부터 다시 읽어라」. 새 phase 를 만들면 `isStreaming` 이 갈리므로 불리언이다.
   * 훅이 스트림이 `410` 으로 사라졌을 때 세우고, `personal-chat.tsx` 의 재조회 효과가 읽어
   * `GET /messages` 를 다시 당긴다.
   */
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

/** `POST` 가 `202` 로 턴을 열었다. 프레임은 아직 하나도 없고 커서도 없다. */
export function startedState(input: { turnId: string }): ChatStreamState {
  return { ...initialStreamState, phase: "streaming", turnId: input.turnId };
}

/**
 * 돌아왔더니 턴이 아직 돌고 있다. 본문은 `?after=` 재생이, 도구·생각은 히스토리의
 * TOOL·THINKING 행이 그린다.
 *
 * `content` 를 세우면 안 된다. `content !== null` 을 「턴이 끝났다」로 읽는 곳이 있다.
 * `status` 도 안 본다 — 카드를 세우는 것은 `pendingApproval` 이 있느냐 하나다.
 */
export function resumedState(input: {
  cursor: string | null;
  turnId: string;
  pendingApproval: {
    approvalId: string;
    tool: string;
    summary: string | null;
    args: ToolArgs;
  } | null;
  /**
   * 히스토리가 실어 준 도는 턴의 답 조각. 재생은 커서 뒤 토큰만 주므로 이것을 첫 본문으로
   * 깔아야 답이 한 덩어리가 된다. 승인 대기에는 안 깐다 — 열린 스트림이 없어 히스토리가
   * 유일한 출처라 두 번 선다.
   */
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

/**
 * 돌아왔더니 마지막 턴이 실패로 끝나 있었다. `activeTurn` 이 null 일 때만 부른다 — 아니면
 * 흐르는 답 위에 실패 배너가 뜬다.
 */
export function failedTurnState(
  failureCode: string | null,
  retryable: boolean | null
): ChatStreamState {
  const code = failureCode ?? "INTERNAL_ERROR";
  return {
    ...initialStreamState,
    phase: "failed",
    retryable,
    error: {
      code,
      message: TURN_FAILURE_MESSAGES[code] ?? "응답을 받지 못했습니다.",
    },
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

/**
 * 도구 인자. 라이브 `tool_call_start` 는 ai 가 내서 객체이고, 재진입의
 * `activeTurn.pendingApproval.args` 는 server 가 `jsonb` 를 문자열로 내보내 JSON 문자열이다.
 * 문자열을 그대로 `Object.entries` 에 넣으면 글자마다 행이 선다. 파싱이 실패하면 null 이다.
 */
export function toolArgs(value: unknown): ToolArgs {
  if (typeof value !== "string") return record(value);
  try {
    return record(JSON.parse(value));
  } catch {
    return null;
  }
}

/** `kind` 가 없으면 그릴 수 없다. 나머지는 없어도 된다. */
function toolTarget(value: unknown): ToolTarget | null {
  const raw = record(value);
  const kind = raw && text(raw.kind);
  if (!kind) return null;
  return { kind, id: text(raw.id), title: text(raw.title) };
}

/** id·title 이 없으면 누를 수도 셀 수도 없어 뺀다. */
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

/**
 * 실패 코드 → 문구. server 는 닫힌 enum 만 보내고 문구는 web 이 만든다. 모르는 코드는 기본
 * 문구로 접는다.
 */
const TURN_FAILURE_MESSAGES: Record<string, string> = {
  TURN_TIMEOUT: "응답이 너무 오래 걸려 중단됐습니다.",
  UPSTREAM_ERROR: "응답 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  UPSTREAM_REJECTED: "응답을 만들지 못했습니다.",
  APPROVAL_EXPIRED: "승인을 기다리다 시간이 지나 중단됐습니다.",
  STREAM_INTERRUPTED: "응답이 중간에 끊겼습니다.",
  CAPACITY_EXCEEDED: "지금은 처리량이 많습니다. 잠시 후 다시 시도해 주세요.",
  INTERNAL_ERROR: "응답을 만들지 못했습니다.",
};

/**
 * 마지막에 본 것이 커서다. 프레임은 순서대로 오고 `after` 는 배타라 비교·중복 거르기가 없다.
 * 하트비트는 `id:` 가 없어 커서를 안 옮긴다.
 */
function advanceCursor(
  current: string | null,
  id: string | undefined
): string | null {
  return id === undefined ? current : id;
}

/**
 * 화면이 아는 이벤트. 계약의 11종이 전부 있어야 한다 — `contract-consistency` 가
 * `asyncapi.yml` 과 대조한다.
 */
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

/** 계약 이벤트는 아니지만 전송이 올리는 것. 커서를 안 밀고 아무 일도 안 한다. */
const INERT_EVENTS: ReadonlySet<string> = new Set(["heartbeat"]);

export function reduceStreamEvent(
  state: ChatStreamState,
  event: { event: string; data: string; id?: string }
): ChatStreamState {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.data) as Record<string, unknown>;
  } catch {
    // 깨진 `data:` 로 화면을 깨뜨리지 않는다. 다만 커서는 옮긴다 — `data:` 는 ai 가 준 것이지만
    // `id:` 는 서버가 쓴다. 여기서 멈추면 재접속이 영영 옛 자리부터 받는다.
    return { ...state, cursor: advanceCursor(state.cursor, event.id) };
  }

  const base: ChatStreamState = {
    ...state,
    cursor: advanceCursor(state.cursor, event.id),
  };

  switch (event.event) {
    // 스트림을 열기 전 실패(`UPSTREAM_REJECTED`)는 `error` 이벤트 없이 이것만 온다.
    case "turn_failed": {
      const code = String(payload.code ?? "INTERNAL_ERROR");
      return {
        ...base,
        phase: "failed",
        blocks: base.blocks.filter((block) => block.kind !== "text"),
        pendingApproval: null,
        retryable: typeof payload.retryable === "boolean" ? payload.retryable : null,
        error: {
          code,
          message: TURN_FAILURE_MESSAGES[code] ?? "응답을 받지 못했습니다.",
        },
      };
    }

    case "turn_cancelled":
      return { ...base, phase: "cancelled", pendingApproval: null };

    // 상태를 리셋하지 않는다. 승인 뒤 재개나 재생에 다시 올 수 있고, 리셋하면 복원한 블록이
    // 지워진다. 새 턴의 초기화는 `startedState` 가 한다.
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

    // 종료가 아니다. 실패 코드는 뒤따르는 `turn_failed` 에서 server 가 정한다. 여기서 닫으면
    // 그 코드를 못 받는다. 본문도 안 건드린다 — 본문을 접는 것은 `turn_failed` 의 일이다.
    case "error":
      return {
        ...base,
        error: {
          code: String(payload.code ?? "UNKNOWN"),
          message: String(payload.message ?? "응답을 받지 못했습니다."),
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
          // 인자를 나르는 유일한 프레임이다.
          args: toolArgs(payload.args),
          status: null,
          url: null,
        }),
      };

    case "tool_call_result":
      // 도구가 실패해도 스트림은 계속된다.
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
      // 인자는 이 프레임에 없어서 먼저 온 같은 호출의 도구 블록에서 집는다. 못 찾으면 카드는
      // `summary` 만으로 묻는다.
      const started = base.blocks.find(
        (block) => block.kind === "tool" && block.toolCallId === toolCallId
      );
      const pending = {
        approvalId: String(payload.approvalId ?? ""),
        tool: String(payload.tool ?? ""),
        summary: text(payload.summary),
        args: started?.kind === "tool" ? started.args : null,
      };
      return {
        ...base,
        phase: "awaiting_approval",
        pendingApproval: pending,
        blocks: pushApproval(base.blocks, {
          approvalId: pending.approvalId,
          tool: pending.tool,
          summary: pending.summary,
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
      // 계약이 이벤트를 늘려도 화면은 살아 있되, 조용히 삼키지 않고 경고를 남긴다.
      if (!INERT_EVENTS.has(event.event)) {
        console.warn(`[chat] 모르는 SSE 이벤트: ${event.event}`);
      }
      // 모르는 이벤트도 `id:` 를 먹었으면 지나온 자리라 커서는 옮긴다.
      return base;
  }
}

/**
 * 스트림이 닫혔다. 닫힘 자체는 상태가 아니다. 스트림을 닫는 프레임
 * (`message_end`·`turn_failed`·`turn_cancelled`·`tool_approval_request`)이 이미 phase 를
 * 정했고, 그 없이 끝났으면 연결이 끊긴 것이라 훅이 재연결로 받는다.
 *
 * @param reason
 *  - `closed` — 리더가 끝났다. 상태를 그대로 둔다
 *  - `cancelled` — 사용자가 중지를 눌렀고 서버가 받았다
 *  - `gaveUp` — 백오프를 다 돌고 못 붙었다
 */
export function endStream(
  state: ChatStreamState,
  reason: "closed" | "cancelled" | "gaveUp"
): ChatStreamState {
  if (reason === "cancelled")
    return { ...state, phase: "cancelled", pendingApproval: null };
  if (reason === "gaveUp") {
    // 기존 오류 배너에 접는다. 다시 눌러 볼 만한 실패라 `retryable` 은 참이다.
    if (state.phase !== "streaming") return state;
    return {
      ...state,
      phase: "failed",
      pendingApproval: null,
      retryable: true,
      error: {
        code: "STREAM_INTERRUPTED",
        message: TURN_FAILURE_MESSAGES.STREAM_INTERRUPTED,
      },
    };
  }
  // 승인 대기도 정상 종료다. 승인 요청 프레임이 스트림을 끝내므로 여기서 바꾸면 카드가 덮인다.
  return state;
}
