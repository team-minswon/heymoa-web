/**
 * 채팅 SSE 이벤트를 화면 상태로 접는 순수 리듀서.
 *
 * 계약은 `asyncapi.yml`의 `agentChatStream` 채널이고 이벤트는 아홉 종 + **턴 이벤트 다섯**이다.
 * 진입점은 개인 챗봇 하나뿐이다 — 공유 챗봇은 사라졌다.
 *
 * **봉투는 없다.** `data:`에 실리는 것은 payload 하나뿐이다.
 *
 * ```
 * id: 129
 * event: turn_started
 * data: {"turnId":"…","startSeq":128}
 * ```
 *
 * `seq`는 `id:` 줄에만, `turnId`는 `turn_started`의 payload에만 있다. `chatId`는 아예 안 온다.
 *
 * 계약이 만드는 함정 넷을 여기서 못 박는다.
 *
 * 1. **`message_end.content`가 토큰 합을 이긴다.** 계약은 둘이 같다고 말하지만, 같다고
 *    믿고 토큰 합을 남기면 새로고침 후 히스토리(`content`)와 다른 글이 될 수 있다.
 *    `finalizeText`가 본문 블록을 통째로 갈아끼운다.
 * 2. **`tool_call_result`의 `status=error`는 종료가 아니다.** 도구만 실패했고 토큰은
 *    이어진다. `error` 이벤트와 절대 같은 갈래에 두지 않는다.
 * 3. **종료 이벤트 없이 끊기는 경로가 있다.** 스트림이 그냥 닫히면 `stalled`다 —
 *    처리하지 않으면 영원히 로딩이다.
 * 5. **`seq`에 구멍이 있다.** 턴마다 1000 블록으로 떼어 발급하므로 `40 → 1001`이 정상이다
 *    (server U-04). 「구멍 = 유실」로 읽으면 턴 경계마다 resync가 돈다.
 * 6. **모든 프레임이 `id:` 줄을 갖는다.** 좌표 없던 `message_snapshot`은 걷혔다 —
 *    커서를 안 밀어 뒤따르는 백로그와 겹쳤고 답의 꼬리가 두 벌 그려졌다. `stream_resync`도
 *    이제 번호를 갖고, 그 번호가 **바닥**이다(「이 아래로는 못 준다」).
 * 4. **모르는 이벤트로 화면이 죽지 않는다.** 하지만 `default`가 조용히 삼키기만 하면
 *    새 이벤트가 계약에만 있고 화면에는 없는 상태가 오래 간다 — `thinking_delta`가
 *    실제로 그랬다. 아는 이벤트는 여기 전부 적혀 있어야 한다.
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
 * 화면이 아는 상태 여섯. **늘리지 않는다.**
 *
 * `personal-chat.tsx`의 `isStreaming`이 phase로 갈리므로 새 값 하나가 컴포저의 중지 버튼을
 * 조용히 지운다. 새 이벤트는 여기 여섯 중 하나로 접는다 —
 * `message_end`→`done` · `turn_failed`→`failed` · `turn_cancelled`→`cancelled` ·
 * `stream_resync`→`streaming`(+`needsResync`) · `turn_started`→그대로.
 *
 * **재연결 중에도 `streaming`이다.** 「종료 프레임 없이 끊김」은 상태가 아니라
 * 재연결 신호라 여기 자리가 없다. 백오프를 다 돌고 포기하면 그때 `failed`로 접는다.
 *
 * **`done`은 `idle`과 다르다.** `idle`은 아직 아무것도 안 시작한 것이고 `done`은 답이
 * 끝난 것이다. 같은 값으로 접으면 「다시 시도」를 세울지가 갈리지 않는다.
 * 배열로 둔 것은 테스트가 이걸 못박기 위해서다.
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

/** 이 턴에 근거로 쓴 회의록. **본 것이지 인용한 것이 아니다.** */
export type NoteRef = {
  kind: "note";
  id: string;
  title: string;
};

export type ChatStreamState = {
  phase: ChatStreamPhase;
  messageId: string | null;
  /**
   * 이 턴의 id. **`turn_started`가 유일한 출처다** — `POST /messages` 응답이 곧 스트림이라
   * 본문을 읽기 전에는 알 수 없다. 취소(`POST /turns/{turnId}/cancel`)가 이걸 기다린다.
   */
  turnId: string | null;
  /**
   * 대화 스코프 커서. 재접속이 `GET /events?after=`에 넣는 값이다.
   * **단조 증가만 한다.** null이면 아직 번호 붙은 프레임을 하나도 못 봤다는 뜻이다.
   */
  seq: number | null;
  /** 생각·도구·승인·본문이 한 배열에 시간 순서대로. */
  blocks: Block[];
  /** 확정된 답변. message_end 전에는 null이다. */
  content: string | null;
  /**
   * 에이전트가 실제로 본 회의록. `message_end`가 채운다.
   *
   * **범위 밖을 봤다는 알림도 여기다.** 범위는 담장이 아니라 먼저 볼 곳이라 조회 도구가
   * 밖을 안 막고, 넓힌 것을 조용히 넓히지 않으려면 알릴 자리가 필요한데 그 자리가 이
   * 목록이다 — 범위 밖 회의록이 여기 서는 것이 곧 알림이고, **새 프레임이 없는 이유다.**
   */
  refs: NoteRef[];
  pendingApproval: {
    approvalId: string;
    tool: string;
    summary: string | null;
    /**
     * 이 승인이 실행할 인자. **`tool_approval_request`에는 안 실린다** — 계약이 인자를
     * `tool_call_start` 하나에만 싣기로 했으므로, 같은 `toolCallId`의 도구 블록에서 집는다.
     * 재진입에서는 그 프레임이 이미 버퍼에서 밀려나 히스토리의 `pendingApproval.args`가 준다.
     */
    args: ToolArgs;
  } | null;
  error: { code: string; message: string } | null;
  /**
   * 다시 눌러도 되는 실패인가. server가 닫힌 enum으로 정한다(U-06).
   * **상태에 담되 화면 분기는 만들지 않는다** — 배너 규칙이 확정 목록에 없어서, 여기서
   * 새로 정하면 그게 곧 화면 변경이다.
   */
  retryable: boolean | null;
  /**
   * 「히스토리부터 다시 읽어라」. **phase가 아니라 불리언이다** — 새 phase를 만들면
   * `personal-chat.tsx`의 `isStreaming`이 갈려 컴포저의 중지 버튼이 조용히 사라진다.
   *
   * **읽는 자리가 있어야 뜻이 있다.** `personal-chat.tsx`의 재조회 효과가 이 값을 보고
   * `GET /messages`를 다시 당긴다 — 세우기만 하고 아무도 안 읽으면 서버가 「못 준다」고
   * 말한 구간이 화면에서 조용히 사라진다.
   */
  needsResync: boolean;
};

export const initialStreamState: ChatStreamState = {
  phase: "idle",
  messageId: null,
  turnId: null,
  seq: null,
  blocks: [],
  content: null,
  refs: [],
  pendingApproval: null,
  error: null,
  retryable: null,
  needsResync: false,
};

/**
 * 돌아왔더니 턴이 아직 돌고 있다 — `GET /messages`가 준 것으로 화면을 세운다.
 *
 * **본문을 여기서 안 그린다.** `partialText`가 걷혔다 — 누적본은 주기적으로만 내려쓰고
 * 커서는 지금까지 발행된 번호라 그 사이 토큰이 어디서도 안 왔다. 이제 본문은 `?after=`가
 * 부르는 **재생**이 그리고, 도구·생각은 히스토리의 TOOL·THINKING 행이 그린다.
 *
 * **`content`를 세우면 안 된다.** `content !== null`이 세 곳에서 「턴이 끝났다」로 읽혀서,
 * 안 끝난 답에 「찾은 곳」 줄이 붙는다.
 *
 * **`status`를 안 본다.** 계약이 `pendingApproval`을 `WAITING_APPROVAL`에서만 싣지만,
 * 카드를 세우는 것은 값이 있느냐이지 상태 이름이 아니다 — 두 곳에서 정하면 판정이 갈린다.
 */
export function resumedState(input: {
  cursor: number;
  turnId: string;
  pendingApproval: {
    approvalId: string;
    tool: string;
    summary: string | null;
    args: ToolArgs;
  } | null;
}): ChatStreamState {
  return {
    ...initialStreamState,
    phase: input.pendingApproval ? "awaiting_approval" : "streaming",
    turnId: input.turnId,
    // **0이면 null이 아니다.** 「버퍼에 아무것도 없다」는 뜻이고 `?after=0`으로 물어야 한다.
    seq: input.cursor,
    pendingApproval: input.pendingApproval,
  };
}

/**
 * 돌아왔더니 마지막 턴이 실패로 끝나 있었다. **`activeTurn`이 null일 때만 부른다** —
 * 도는 턴이 곧 마지막 턴인 것이 정상이라, 그때 배너를 세우면 흐르는 답 위에 실패가 뜬다.
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
 * 도구 인자. **같은 값이 두 전송에서 두 모양으로 온다.**
 *
 * 라이브의 `tool_call_start` 는 ai 가 내서 **객체**이고, 재진입의
 * `activeTurn.pendingApproval.args` 는 server 가 `jsonb` 를 Kotlin `String` 으로 들고
 * 있다가 그대로 내보내서 **JSON 문자열**이다.
 *
 * 접기 전에는 문자열을 `Object.entries` 에 넣어 **문자 인덱스가 행으로 섰다** —
 * 카드에 `0: {`, `1: "` 가 그려졌다. 파싱이 실패하면 인자가 없는 것으로 접는다.
 * 카드는 `summary` 만으로도 선다.
 */
export function toolArgs(value: unknown): ToolArgs {
  if (typeof value !== "string") return record(value);
  try {
    return record(JSON.parse(value));
  } catch {
    return null;
  }
}

/** `kind`가 없으면 그릴 수 없다. 나머지는 없어도 카드가 선다. */
function toolTarget(value: unknown): ToolTarget | null {
  const raw = record(value);
  const kind = raw && text(raw.kind);
  if (!kind) return null;
  return { kind, id: text(raw.id), title: text(raw.title) };
}

/** id·title이 없으면 근거로 못 쓴다 — 누를 수도 셀 수도 없어서 조용히 뺀다. */
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
 * 실패 코드 → 사람이 읽는 문구. **server는 문구를 안 보낸다**(PLAN §8-⑩) — 닫힌 enum이라
 * web이 만든다. 모르는 코드는 `error` 이벤트와 같은 기본 문구로 접는다.
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
 * 이 프레임의 번호. **출처는 `id:` 줄 하나다.**
 *
 * `data:`에는 payload만 실린다 — `seq`도 `turnId`도 `chatId`도 안 들어간다. 봉투를 기대해
 * payload를 한 겹 더 벗기려 들면 전부 `undefined`가 되고, **에러도 로그도 없이** 화면이
 * 빈 채로 흐른다.
 *
 * 지금 계약에서는 **모든 프레임이 이 줄을 갖는다.** 그래도 `null`을 남기는 이유는
 * 좌표 없는 프레임이 다시 생겼을 때 0으로 접지 않기 위해서다 — 0으로 접으면 커서가
 * 되감겨 대화 버퍼가 통째로 재생되고 답이 두 벌 그려진다.
 */
function seqOf(id: string | undefined): number | null {
  if (id === undefined) return null;
  const value = Number(id);
  return Number.isFinite(value) ? value : null;
}

/**
 * 커서를 옮긴다. **단조 증가만.**
 *
 * - `stream_resync`의 번호는 **바닥**이라 커서를 그 자리까지 올린다. 이어지는 재생이
 *   정확히 그 뒤부터라, 안 올리면 그 프레임들을 「이미 지나온 번호」로 전부 버린다
 * - 턴 경계에 **구멍**이 있다(`40 → 1001`). 구멍은 아무 일도 일으키지 않는다 —
 *   「구멍 = 유실」로 읽으면 턴마다 resync가 돈다
 */
function advanceCursor(current: number | null, seq: number | null): number | null {
  if (seq === null) return current;
  return current === null || seq > current ? seq : current;
}

/**
 * 화면이 아는 이벤트. **계약의 13종이 여기 전부 있어야 한다** — `contract-consistency`가
 * `asyncapi.yml`과 기계로 대조한다. 그 검사가 「모르는 이벤트를 조용히 삼킨다」의
 * 구조적 방어다: 계약에만 있고 화면에는 없는 상태가 오래 가는 것을 막는다.
 */
export const KNOWN_EVENTS: ReadonlySet<string> = new Set([
  "turn_started",
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
  "stream_resync",
]);

/** 계약 이벤트는 아니지만 전송이 올리는 것. 커서를 안 밀고 아무 일도 안 한다. */
const INERT_EVENTS: ReadonlySet<string> = new Set(["heartbeat"]);

export function reduceStreamEvent(
  state: ChatStreamState,
  event: { event: string; data: string; id?: string }
): ChatStreamState {
  const seq = seqOf(event.id);

  // 이미 지나온 번호다. 재접속 백로그가 겹칠 때 같은 프레임을 두 번 접으면 답변이
  // 두 벌이 된다. `after=`는 배타이지만 web이 스스로 막는다.
  if (seq !== null && state.seq !== null && seq <= state.seq) return state;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.data) as Record<string, unknown>;
  } catch {
    // 계약 밖 프레임으로 화면을 깨뜨리지 않는다. 다만 **커서는 멈추면 안 된다** —
    // `data:`는 ai가 준 것을 그대로 박은 것이라 깨질 수 있지만 `id:` 줄은 서버가 쓴다.
    // 여기서 멈추면 재접속이 영영 옛 자리부터 다시 받는다.
    return { ...state, seq: advanceCursor(state.seq, seq) };
  }

  const base: ChatStreamState = { ...state, seq: advanceCursor(state.seq, seq) };

  switch (event.event) {
    /**
     * **여기서 「흐르는 중」이 된다.** 첫 토큰을 기다렸다 켜면 답 말풍선이 그때 생겨
     * 레이아웃이 밀리고 읽던 자리가 어긋난다 — 말풍선을 먼저 세워 자리를 잡아 둔다.
     *
     * **대칭 종료를 기다리지 않는다.** 성공 종료는 `message_end`가 겸하므로 짝이 되는
     * `turn_completed` 같은 것은 오지 않는다.
     *
     * `turnId`의 **유일한 출처**다 — `POST /messages` 응답이 곧 스트림이라 본문을 읽기
     * 전에는 알 수 없고, 중지가 이 값을 기다린다.
     */
    case "turn_started":
      return {
        ...base,
        phase: "streaming",
        turnId: text(payload.turnId) ?? base.turnId,
      };

    /**
     * 스트림을 열기 전 실패(`UPSTREAM_REJECTED`)는 `error` 이벤트가 **없다.** 이 갈래가
     * 없으면 그 경로가 `default`로 삼켜지고 EOF에서 stalled가 되어, 사용자는
     * 「응답을 만들지 못했습니다」 대신 「답변이 중단되었습니다」를 본다.
     */
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

    /**
     * **「이 번호 아래로는 못 준다」.** `id:` 줄이 그 바닥이고 payload는 `{}`다 —
     * 뜻이 전부 번호에 있어서 `advanceCursor`가 커서를 거기까지 올린다. 이 프레임으로
     * 스트림이 끝나지 않는다: 바로 뒤로 재생과 드레인이 그대로 이어진다.
     *
     * **phase는 `streaming` 그대로**다. 새 phase를 만들면 `isStreaming`이 갈려 컴포저의
     * 중지 버튼이 사라진다. 대신 둘을 한다.
     *
     * 1. `needsResync`를 세운다 — `personal-chat.tsx`가 보고 히스토리를 다시 읽는다
     * 2. **여기까지 그린 본문을 버린다.** 바닥 아래가 안 오므로 남겨 두면 앞과 뒤가
     *    이어 붙어 **구멍이 안 보이는 한 덩어리**가 된다 — 없는 글이 남는 것이라
     *    `turn_failed`·`error` 갈래와 같은 규칙으로 접는다. 확정 본문은
     *    `message_end.content`가 통째로 갈아끼운다.
     *
     * 생각·도구 블록은 남긴다: 무엇을 하다 밀렸는지가 사유의 절반이고, 그 자리는
     * 히스토리의 TOOL·THINKING 행이 겹쳐 그리지 않게 화면이 이미 접고 있다.
     */
    case "stream_resync":
      return {
        ...base,
        needsResync: true,
        blocks: base.blocks.filter((block) => block.kind !== "text"),
      };

    /**
     * **상태를 리셋하지 않는다.** 버퍼는 대화 스코프라 재접속 백로그에 `message_start`가
     * 섞여 오고, 리셋하면 방금 복원한 블록을 지운다. 새 턴의 초기화는 훅의 `send()`가 한다.
     */
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

    /**
     * ★ **종료가 아니다.** ai가 흘린 오류이고, 실패 코드를 정하는 것은 server다 —
     * 여기서 `failed`로 접고 스트림을 닫으면 **뒤따르는 `turn_failed`의 코드를 화면이
     * 못 받는다.** 사용자는 server가 정한 사유 대신 ai의 날문구를 보게 된다.
     *
     * **블록도 안 건드린다.** 여기서 본문을 버리면 실제로 이어지는 토큰과 앞이 끊긴다.
     * 본문을 접는 것은 `turn_failed`의 일이다.
     */
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
          // **인자를 나르는 유일한 프레임이다.** 뒤따르는 승인 카드가 여기서 집어 간다.
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
      // **인자는 이 프레임에 없다.** 계약이 `tool_call_start` 하나에만 싣기로 했고 그것이
      // 먼저 오므로, 같은 호출의 도구 블록에서 집는다. 못 찾으면 카드가 `summary`만으로
      // 묻는다 — 이 변경 전의 모습이라 화면이 깨지지는 않는다.
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
      // 계약이 이벤트를 늘려도 화면은 살아 있어야 한다. **하지만 조용히 삼키지도
      // 않는다** — 삼키기만 하면 새 이벤트가 계약에만 있고 화면에는 없는 상태가
      // 오래 간다(`thinking_delta`가 실제로 그랬다).
      if (!INERT_EVENTS.has(event.event)) {
        console.warn(`[chat] 모르는 SSE 이벤트: ${event.event}`);
      }
      // 커서는 옮긴다(`base`) — 모르는 이벤트도 번호를 먹었으면 이미 지나온 자리다.
      return base;
  }
}

/**
 * 스트림이 닫혔다. **닫힘 자체는 상태가 아니다.**
 *
 * 계약이 스트림을 닫는 프레임은 넷뿐이고(`message_end`·`turn_failed`·`turn_cancelled`·
 * `tool_approval_request`) 그 넷이 이미 phase를 정해 뒀다. 그 프레임 없이 리더가
 * 끝났으면 **연결이 끊긴 것**이고, 그건 훅이 재연결로 받는다 — 여기서 새 상태를
 * 만들면 「재연결 중에도 흐르는 중」이 깨진다.
 *
 * @param reason
 *  - `closed` — 리더가 끝났다. 종료 프레임을 이미 받았으면 그대로, 아니면 **그대로 둔다**
 *  - `cancelled` — 사용자가 중지를 눌렀고 서버가 받았다
 *  - `gaveUp` — 백오프 여섯 번을 다 돌고 못 붙었다. 「포기 표시」가 여기다
 */
export function endStream(
  state: ChatStreamState,
  reason: "closed" | "cancelled" | "gaveUp"
): ChatStreamState {
  if (reason === "cancelled")
    return { ...state, phase: "cancelled", pendingApproval: null };
  if (reason === "gaveUp") {
    // 새 화면을 안 만든다 — 기존 오류 배너에 접는다. 다시 눌러 볼 값어치가 있는
    // 실패라 `retryable`은 참이다.
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
  // `closed`는 아무것도 안 한다. 승인 대기도 정상 종료다 — 계약상 승인 요청 프레임이
  // 스트림을 끝내므로, 여기서 상태를 바꾸면 승인 카드가 정지 화면에 덮인다.
  return state;
}
