/**
 * 채팅 SSE 이벤트를 화면 상태로 접는 순수 리듀서.
 *
 * 계약은 `docs/contracts/asyncapi-web-server.yml`의 agentChatStream 채널이고,
 * 개인 챗봇(`/v1/agent-chats/{chatId}/messages`)과 공유 챗봇
 * (`/v1/notes/{noteId}/chat/messages`)이 **같은 이벤트 8종**을 쓴다. 그래서 이 파일은
 * 어느 챗봇인지 모른다.
 *
 * 계약이 만드는 함정 셋을 여기서 못 박는다.
 *
 * 1. **`message_end.content`가 토큰 합을 이긴다.** 계약은 둘이 같다고 말하지만, 같다고
 *    믿고 토큰 합을 남기면 새로고침 후 히스토리(`content`)와 다른 글이 될 수 있다.
 * 2. **`tool_call_result`의 `status=error`는 종료가 아니다.** 도구만 실패했고 토큰은
 *    이어진다. `error` 이벤트와 절대 같은 갈래에 두지 않는다.
 * 3. **종료 이벤트 없이 끊기는 경로가 있다.** 스트림이 그냥 닫히면 `stalled`다 —
 *    처리하지 않으면 영원히 로딩이다.
 */

export type ChatStreamPhase =
  | "idle"
  | "streaming"
  | "awaiting_approval"
  | "failed"
  | "stalled"
  | "aborted";

export type ApprovalDecision = "APPROVED" | "REJECTED";

export type LiveToolRecord =
  | {
      kind: "approval";
      approvalId: string;
      /** 뒤따르는 tool_call_result가 도구 이름을 찾아오는 열쇠다. */
      toolCallId: string;
      tool: string;
      summary: string | null;
      /** 확정 전에는 null. tool_approval_resolved가 채운다. */
      decision: ApprovalDecision | null;
    }
  | {
      kind: "call";
      toolCallId: string;
      tool: string;
      summary: string | null;
      /** 실행 중에는 null. tool_call_result가 채운다. */
      status: "success" | "error" | null;
      url: string | null;
    };

export type ChatStreamState = {
  phase: ChatStreamPhase;
  messageId: string | null;
  /** 지금까지 붙은 토큰. message_end 뒤에는 content로 대체된다. */
  text: string;
  /** 확정된 답변. message_end 전에는 null이다. */
  content: string | null;
  records: LiveToolRecord[];
  pendingApproval: { approvalId: string; tool: string; summary: string | null } | null;
  error: { code: string; message: string } | null;
};

export const initialStreamState: ChatStreamState = {
  phase: "idle",
  messageId: null,
  text: "",
  content: null,
  records: [],
  pendingApproval: null,
  error: null,
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function reduceStreamEvent(
  state: ChatStreamState,
  event: { event: string; data: string }
): ChatStreamState {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.data) as Record<string, unknown>;
  } catch {
    // 계약 밖 프레임으로 화면을 깨뜨리지 않는다.
    return state;
  }

  switch (event.event) {
    case "message_start":
      return {
        ...initialStreamState,
        phase: "streaming",
        messageId: text(payload.messageId),
      };

    case "token":
      return { ...state, phase: "streaming", text: state.text + String(payload.delta ?? "") };

    case "message_end": {
      const content = String(payload.content ?? "");
      return { ...state, phase: "idle", content, text: content };
    }

    case "error":
      // 부분 응답은 저장되지 않는다 — 반쯤 쓰인 말풍선을 남기면 없는 글이 남는다.
      return {
        ...state,
        phase: "failed",
        text: "",
        // 끝난 스트림의 승인은 더 이상 유효하지 않다 (계약: 스트림이 끝나면 EXPIRED).
        // 남겨 두면 실패 안내 옆에 눌리는 승인 버튼이 함께 선다.
        pendingApproval: null,
        error: {
          code: String(payload.code ?? "UNKNOWN"),
          message: String(payload.message ?? "응답을 받지 못했습니다."),
        },
      };

    case "tool_call_start":
      return {
        ...state,
        phase: "streaming",
        records: [
          ...state.records,
          {
            kind: "call",
            toolCallId: String(payload.toolCallId ?? ""),
            tool: String(payload.tool ?? ""),
            summary: text(payload.summary),
            status: null,
            url: null,
          },
        ],
      };

    case "tool_call_result": {
      const toolCallId = String(payload.toolCallId ?? "");
      const status: "success" | "error" =
        payload.status === "error" ? "error" : "success";
      const summary = text(payload.summary);
      const url = text(payload.url);
      const existing = state.records.find(
        (record) => record.kind === "call" && record.toolCallId === toolCallId
      );
      const records = existing
        ? state.records.map((record) =>
            record.kind === "call" && record.toolCallId === toolCallId
              ? { ...record, status, summary: summary ?? record.summary, url }
              : record
          )
        : [
            ...state.records,
            {
              kind: "call" as const,
              toolCallId,
              // 승인을 거친 쓰기 도구는 tool_call_start 없이 곧장 결과가 오고,
              // 결과 payload에는 `tool`이 없다 — 승인 요청이 알려 준 이름을 이어 쓴다.
              tool:
                text(payload.tool) ??
                state.records.find(
                  (record) =>
                    record.kind === "approval" && record.toolCallId === toolCallId
                )?.tool ??
                "",
              summary,
              status,
              url,
            },
          ];
      // 도구가 실패해도 스트림은 계속된다.
      return { ...state, phase: "streaming", records };
    }

    case "tool_approval_request": {
      const pending = {
        approvalId: String(payload.approvalId ?? ""),
        tool: String(payload.tool ?? ""),
        summary: text(payload.summary),
      };
      return {
        ...state,
        phase: "awaiting_approval",
        pendingApproval: pending,
        records: [
          ...state.records,
          {
            kind: "approval",
            ...pending,
            toolCallId: String(payload.toolCallId ?? ""),
            decision: null,
          },
        ],
      };
    }

    case "tool_approval_resolved": {
      const approvalId = String(payload.approvalId ?? "");
      const decision =
        payload.decision === "REJECTED" ? "REJECTED" : "APPROVED";
      return {
        ...state,
        phase: "streaming",
        pendingApproval: null,
        records: state.records.map((record) =>
          record.kind === "approval" && record.approvalId === approvalId
            ? { ...record, decision }
            : record
        ),
      };
    }

    default:
      // 계약이 이벤트를 늘려도 화면은 살아 있어야 한다.
      return state;
  }
}

/**
 * 스트림이 닫힌 이유를 상태로 옮긴다.
 *
 * `closed`는 리더가 끝난 것뿐이라 정상 종료인지 아닌지를 모른다 — `message_end`나 `error`를
 * 이미 받았으면 그대로 두고, 아직 흐르는 중이었으면 **종료 이벤트 없이 끊긴 세 번째 경로**다.
 */
export function endStream(
  state: ChatStreamState,
  reason: "closed" | "stalled" | "aborted"
): ChatStreamState {
  if (reason === "aborted") return { ...state, phase: "aborted", pendingApproval: null };
  if (reason === "stalled") return { ...state, phase: "stalled", pendingApproval: null };
  if (state.phase === "streaming" || state.phase === "awaiting_approval") {
    return { ...state, phase: "stalled", pendingApproval: null };
  }
  return state;
}
