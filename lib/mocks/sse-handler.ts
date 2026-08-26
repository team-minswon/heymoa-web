import { HttpResponse, http } from "msw";

import {
  type ApprovalPlan,
  buildApprovalPlan,
  buildChatEvents,
  type MockSseEvent,
} from "@/lib/mocks/chat-stream";
import { hasScenario, leadSilenceMs } from "@/lib/mocks/chat-scenarios";
import { joinSummary } from "@/lib/chat/blocks";
import type { ScopeRef } from "@/lib/mocks/db";
import { mockDb } from "@/lib/mocks/db";

/**
 * ★ **턴은 연결이 아니다.**
 *
 * 예전 목은 생성과 전송이 한 곳이라 응답 스트림이 닫히면 턴도 같이 죽었다. 그래서
 * 「끊고 → 다시 붙어서 이어받는다」를 **원리적으로 재현할 수 없었고**, e2e가 그 자리를
 * 하나도 증명하지 못했다.
 *
 * 지금은 셋으로 갈린다.
 *
 * 1. `POST /messages`가 **응답과 무관한 async 루프**를 띄운다. 응답은 그 대화에 대한 구독 하나다
 * 2. 발행은 대화 스코프 버퍼(`ChatStream.buffer`)에 쌓이고 구독자에게 밀린다
 * 3. `GET /events?after=N`이 버퍼에서 이어받는다
 *
 * 응답을 끊어도 턴은 계속 돌고 히스토리에 남는다 — 그게 이 구조의 인수 조건이다.
 */

/**
 * 이벤트가 도착하기까지 걸리는 시간. **한 값으로 두면 진행 표시를 못 본다.**
 *
 * 전부 40ms 였을 때는 생각·도구·답이 거의 같은 순간에 도착해서, 「생각 중」도 「실행 중」도
 * 한 프레임 스쳐 지나갔습니다. 실제로는 생각 한 문장과 도구 한 번이 초 단위로 벌어집니다 —
 * 그 간격이 있어야 그 자리에 무엇이 뜨는지 눈으로 확인할 수 있습니다.
 *
 * 토큰만 촘촘하고 나머지는 성깁니다. 값의 근거는 실측이 아니라 **사람이 읽을 수 있는
 * 속도**입니다 — 목이 하는 일은 계약을 흉내내는 것이지 지연을 재현하는 것이 아닙니다.
 */
const EVENT_DELAY_MS: Record<string, number> = {
  turn_started: 0,
  message_start: 220,
  // 계획 한 문장. 읽히는 속도로 뜬다.
  thinking_delta: 700,
  // 도구가 도는 구간이 이 스트림에서 가장 긴 무음이다. 그 자리에 스피너가 선다.
  tool_call_start: 350,
  tool_call_result: 1_600,
  tool_approval_request: 500,
  tool_approval_resolved: 400,
  scope_miss: 300,
  message_end: 350,
  error: 400,
};

/** 낱말 하나. 나머지 이벤트와 달리 촘촘해야 「흐른다」로 읽힌다. */
const TOKEN_DELAY_MS = 55;

/**
 * 하트비트 간격. **여는 순간 한 번이 아니라 계속 나온다** — web의 40초 유휴 타이머가
 * 「연결이 죽었나」를 재려면 살아 있다는 신호가 주기적으로 와야 한다.
 */
const HEARTBEAT_MS = 10_000;

/**
 * 대화당 보관하는 이벤트 수. 넘치면 앞부터 버리고 **버린 마지막 번호를 바닥으로 남긴다** —
 * 그 아래에서 붙은 재접속은 재생으로 못 채우므로 `stream_resync`를 먼저 받는다.
 */
const BUFFER_LIMIT = 512;

/**
 * 턴을 시작할 때 떼는 번호 블록. **일부러 구멍을 낸다** — 실제 서버가 DB에서 블록으로
 * 발급하므로 `seq 40 → 1001`이 정상이고, web이 「구멍 = 유실」로 읽으면 턴 경계마다
 * resync가 돈다. 목이 구멍을 안 내면 그 결함이 안 드러난다.
 */
const SEQ_BLOCK = 1_000;

/** 이걸 흘려보낸 구독은 닫는다. 안 닫으면 web의 재연결 타이머가 영원히 돈다. */
const TERMINAL_EVENTS = new Set([
  "message_end",
  "turn_failed",
  "turn_cancelled",
]);

let streamSpeed = 1;

/**
 * 테스트·데모 배속. 테스트는 이 스트림이 **초 단위로 걸리기를 원하지 않는다** —
 * 재는 것이 순서와 내용이지 시간이 아니다.
 *
 * 브라우저에서는 `localStorage.mockChatSpeed = "4"` 로도 올릴 수 있다. 같은 화면을
 * 여러 번 볼 때 매번 기다리지 않으려는 것이다.
 */
export function setStreamSpeedForTests(value: number) {
  streamSpeed = value > 0 ? value : 1;
}

function speed() {
  if (streamSpeed !== 1) return streamSpeed;
  if (typeof localStorage === "undefined") return 1;
  const value = Number(localStorage.getItem("mockChatSpeed"));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/**
 * 이 프레임까지 기다리는 시간. 첫 프레임 앞에는 침묵이 하나 더 붙을 수 있다 —
 * `"천천히"`가 그 구간을 사람이 볼 수 있는 길이로 늘린다(배속도 같이 먹는다).
 */
function delayOf(event: string, message: string) {
  // **2차 스트림의 첫 프레임은 `message_start`가 아니라 `tool_approval_resolved`다.**
  // 여기 안 넣으면 「천천히」가 1차에만 걸려, 승인을 누른 뒤 재개가 느릴 때 화면이
  // 무엇을 그리는지(카드가 `submitted`로 선 채 기다린다)를 볼 방법이 없다.
  const lead =
    event === "message_start" || event === "tool_approval_resolved"
      ? leadSilenceMs(message)
      : 0;
  return ((EVENT_DELAY_MS[event] ?? TOKEN_DELAY_MS) + lead) / speed();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 아직 안 눌린 승인. **프라미스가 아니다** — 기다리는 사람이 없다.
 *
 * 계약에 만료가 없어졌다. 1차 스트림은 `tool_approval_request`에서 끝나고, 승인 API가
 * 2차 스트림을 열어 `after(decision)`를 흘린다. 그래서 여기 남는 것은 「무엇을 이어야
 * 하는가」뿐이다 — 답 없는 대기를 푸는 것은 취소 API다.
 */
type PendingApproval = { chatId: string; message: string; plan: ApprovalPlan };

const pendingApprovals = new Map<string, PendingApproval>();

/** 선에 나갈 프레임 하나. `seq`가 null이면 `id:` 줄을 안 쓴다 — 커서를 안 옮긴다. */
/** 프레임 하나. **`seq`가 없는 프레임은 이제 없다** — 좌표 없는 것은 이 선에 안 흐른다. */
type Frame = {
  seq: number;
  event: string;
  payload: unknown;
};

/** 계약(`AgentChatMessagesResponse.data.activeTurn.status`)의 다섯. */
type TurnStatus =
  | "IN_PROGRESS"
  | "WAITING_APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

type Turn = {
  turnId: string;
  /** 이 턴이 낸 첫 이벤트 직전의 커서. 처음부터 다시 받을 때 쓴다. */
  startSeq: number;
  status: TurnStatus;
  /** FAILED일 때만 채워진다. `retryable`은 코드에서 파생한다 — 컬럼이 아니다. */
  failureCode: string | null;
  retryable: boolean | null;
  /**
   * 아직 안 누른 승인. **`status`가 `IN_PROGRESS`여도 실린다** — 승인 대기 중 탭을 닫고
   * 돌아오면 이것이 승인 카드를 되살리는 유일한 값이다.
   */
  pendingApproval: {
    approvalId: string;
    tool: string;
    summary: string | null;
    /**
     * 이 승인이 실행할 인자. **`tool_approval_request`에는 안 실린다** — 계약이 인자를
     * `tool_call_start` 하나에만 싣기로 했으므로 [startedArgs]에서 집어 온다.
     * 실서버도 같은 자리에서 같은 일을 한다(승인 행의 `args` 컬럼).
     */
    args: Record<string, unknown> | null;
  } | null;
  /** 도구 시작 요약. 결과와 합쳐 히스토리에 남긴다. */
  startedSummaries: Map<string, string | null>;
  /** 도구 시작 인자. 뒤따르는 승인 요청이 같은 `toolCallId`로 집어 간다. */
  startedArgs: Map<string, Record<string, unknown>>;
  /**
   * 승인을 물은 도구의 이름. **2차 스트림에는 `tool_call_start`가 없고**
   * `tool_call_result`에도 `tool`이 없어서(계약: 이름은 승인 요청이 이미 말했다),
   * 결과 tee가 귀속할 이름의 출처가 이것뿐이다.
   */
  approvalTool: string | null;
};

/** 살아 있는 턴의 상태 둘. 목록 계약의 `runningTurn.status`와 같은 집합이다. */
type LiveTurnStatus = Extract<TurnStatus, "IN_PROGRESS" | "WAITING_APPROVAL">;

function isLiveStatus(status: TurnStatus): status is LiveTurnStatus {
  return status === "IN_PROGRESS" || status === "WAITING_APPROVAL";
}

/** 이어받을 것이 있는 턴인가. **`WAITING_APPROVAL`도 살아 있다.** */
function isLive(turn: Turn | null): turn is Turn {
  return turn !== null && isLiveStatus(turn.status);
}

/**
 * **선을 잡고 있는 턴인가.** 실제 서버의 `hasLiveTurn`과 같은 판정이다 —
 * `WAITING_APPROVAL`은 아니다. 승인 대기에는 흘릴 프레임이 없고 다음 프레임은 승인 API가
 * 낸다. 여기에 `WAITING_APPROVAL`을 넣으면 1차가 EOF를 안 내고, **승인 클릭이 아무 일도
 * 안 한다** — 오류도 로그도 없이.
 *
 * 쓰는 곳은 둘뿐이다: 구독을 곧바로 닫을지, 남은 프레임을 흘릴지.
 */
function isRunning(turn: Turn | null): turn is Turn {
  return turn !== null && turn.status === "IN_PROGRESS";
}

type ChatStream = {
  /** 마지막으로 발급한 번호. **대화 스코프다**(턴 스코프가 아니다). */
  seq: number;
  buffer: Frame[];
  /**
   * **버린 마지막 번호.** 아무것도 안 버렸으면 0이다. `after < floor`면 그 사이가 비어
   * 있다는 뜻이라 재생으로 못 채운다 — 실서버의 `AgentChatEventReplay.floor`와 같은 값이다.
   */
  floor: number;
  subscribers: Set<(frame: Frame) => void>;
  /** 구독이 닫혀야 한다고 알리는 손잡이. 턴이 끝나면 당긴다. */
  closers: Set<() => void>;
  /** **마지막 턴**이다. 끝나도 안 지운다 — `lastTurn`이 실패 배너의 출처다. */
  turn: Turn | null;
  /** 턴 수. 같은 채팅의 다음 응답이 앞 응답의 id를 재사용하지 않게 한다. */
  turns: number;
};

const chats = new Map<string, ChatStream>();

/**
 * 테스트 전용 — `mockDb.reset()`과 **짝으로** 부른다.
 *
 * 목 DB는 리셋하면 같은 chatId를 다시 발급하므로, 여기 남은 버퍼와 턴이 다음 테스트로 새어
 * 들어간다 — 앞 테스트의 도는 턴이 남아 있으면 다음 테스트의 첫 전송이 409를 받는다.
 */
export function resetChatStreamsForTests() {
  chats.clear();
  pendingApprovals.clear();
}

/**
 * 이 대화의 이어받기 상태. `GET /messages`가 히스토리 옆에 실어 보낸다.
 *
 * 값의 자리가 여기인 이유는 **턴이 스트림의 사실**이기 때문이다 — `mockDb`는 저장된 행만
 * 안다. 실제 서버도 턴 행과 이벤트 버퍼가 한 묶음이다.
 */
export function agentChatTurnState(chatId: string) {
  const chat = chats.get(chatId);
  const turn = chat?.turn ?? null;
  return {
    // **0은 「버퍼에 아무것도 없다」**이지 오류가 아니다. `?after=0`은 즉시 닫힌다.
    cursor: chat?.seq ?? 0,
    activeTurn: isLive(turn)
      ? {
          turnId: turn.turnId,
          status: turn.status,
          pendingApproval: turn.pendingApproval,
        }
      : null,
    lastTurn: turn
      ? {
          turnId: turn.turnId,
          status: turn.status,
          failureCode: turn.failureCode,
          retryable: turn.retryable,
        }
      : null,
  };
}

/**
 * 목록의 `runningTurn`. **`activeTurn`이 아니다** — 이름도 모양도 다르다.
 *
 * 배지에 필요한 것은 「승인을 기다린다」까지라 `pendingApproval`을 안 싣는다. `turnId`는 싣는다 —
 * 폴링이 「같은 턴이 아직 돈다」와 「새 턴이 시작됐다」를 그것으로 가른다.
 */
export function runningTurnOf(
  chatId: string
): { turnId: string; status: LiveTurnStatus } | null {
  const turn = chats.get(chatId)?.turn ?? null;
  if (turn === null || !isLiveStatus(turn.status)) return null;
  return { turnId: turn.turnId, status: turn.status };
}

/**
 * 테스트 전용 — 스트림을 돌리지 않고 턴 상태만 심는다.
 *
 * 정지 상태의 `GET /messages`만으로는 `activeTurn`·`lastTurn`이 언제나 null이라
 * **nullable 표본이 한쪽만 나온다.** 실제 턴을 돌려 만들려면 테스트가 시간에 매인다.
 */
export function seedAgentChatTurnForTests(chatId: string, turn: Partial<Turn>) {
  chatOf(chatId).turn = {
    turnId: `turn-${chatId}-seed`,
    startSeq: 0,
    status: "IN_PROGRESS",
    failureCode: null,
    retryable: null,
    pendingApproval: null,
    startedSummaries: new Map(),
    startedArgs: new Map(),
    approvalTool: null,
    ...turn,
  };
}

function chatOf(chatId: string): ChatStream {
  const found = chats.get(chatId);
  if (found) return found;
  const created: ChatStream = {
    seq: 0,
    buffer: [],
    floor: 0,
    subscribers: new Set(),
    closers: new Set(),
    turn: null,
    turns: 0,
  };
  chats.set(chatId, created);
  return created;
}

/**
 * 프레임 하나를 발행한다. 버퍼에 쌓고, **히스토리에 즉시 tee하고**, 구독자에게 민다.
 *
 * tee가 「닫힐 때」가 아니라 이벤트마다인 것이 핵심이다 — 닫을 때 하면 **끊긴 턴이
 * 히스토리에 아무것도 안 남기고**, 그러면 이어받기를 확인할 방법이 없다.
 */
function publish(chatId: string, event: string, payload: unknown) {
  const chat = chatOf(chatId);
  chat.seq += 1;
  const frame: Frame = { seq: chat.seq, event, payload };
  chat.buffer.push(frame);
  if (chat.buffer.length > BUFFER_LIMIT) dropOldest(chat);
  if (chat.turn) accumulate(chatId, chat.turn, frame);
  for (const notify of [...chat.subscribers]) notify(frame);
  if (TERMINAL_EVENTS.has(event)) {
    settleTurn(chatId, TERMINAL_STATUS[event], payloadOf(frame).code);
    return;
  }
  // **승인 요청도 종료 프레임이다** — 다만 턴을 굳히지 않는다. `accumulate`가 턴을
  // `WAITING_APPROVAL`로 세웠고, 여기서는 열린 구독만 닫는다. 안 닫으면 1차가 EOF를
  // 안 내고 승인 클릭이 아무 일도 안 한다.
  if (event === "tool_approval_request") {
    for (const close of [...chat.closers]) close();
  }
}

/**
 * 앞에서 하나 버린다. **버린 번호를 바닥에 남기는 것이 전부다** — 안 남기면 중간이 빠진
 * 목록이 그냥 나가고 브라우저는 그것을 이어 붙인다(오류 없이 본문에 구멍이 난다).
 */
function dropOldest(chat: ChatStream) {
  const dropped = chat.buffer.shift();
  if (dropped) chat.floor = dropped.seq;
}

/** 앞을 통째로 버린다. 데모 시나리오가 바닥을 지금 자리까지 올릴 때 쓴다. */
function dropAll(chat: ChatStream) {
  while (chat.buffer.length > 0) dropOldest(chat);
}

/** terminal 이벤트 → 턴이 굳는 상태. */
const TERMINAL_STATUS: Record<string, TurnStatus> = {
  message_end: "COMPLETED",
  turn_failed: "FAILED",
  turn_cancelled: "CANCELLED",
};

function payloadOf(frame: Frame) {
  return (frame.payload ?? {}) as Record<string, string | boolean | undefined>;
}

/** 누적 본문과 히스토리 행. 실제 서버가 중계하며 하는 tee와 같은 자리다. */
function accumulate(chatId: string, turn: Turn, frame: Frame) {
  const payload = frame.payload as Record<string, string | null | undefined>;

  if (frame.event === "tool_call_start") {
    turn.startedSummaries.set(String(payload.toolCallId), payload.summary ?? null);
    const args = (frame.payload as { args?: unknown }).args;
    if (args && typeof args === "object") {
      turn.startedArgs.set(
        String(payload.toolCallId),
        args as Record<string, unknown>
      );
    }
    return;
  }

  /**
   * ★ **생각도 행으로 남는다.** 실서버가 릴레이에서 하는 tee와 같은 자리다 — 여기서
   * 안 남기면 목에서만 「끝나면 생각이 사라진다」가 재현되고, 화면이 그걸 고쳤는지
   * 목으로는 확인할 수 없다.
   */
  if (frame.event === "thinking_delta") {
    const text = String(payload.text ?? "").trim();
    if (text) {
      mockDb.appendAgentChatMessage(chatId, {
        role: "THINKING",
        turnId: turn.turnId,
        scope: [],
        content: text,
        toolEvent: null,
      });
    }
    return;
  }
  if (frame.event === "tool_approval_request") {
    // **여기서 턴이 `WAITING_APPROVAL`이 된다.** 계약이 `pendingApproval`을 이 상태에서만
    // 싣는다. 굳는 것은 아니다 — 승인 API가 다시 `IN_PROGRESS`로 되돌린다.
    turn.status = "WAITING_APPROVAL";
    turn.approvalTool = String(payload.tool);
    turn.pendingApproval = {
      approvalId: String(payload.approvalId),
      tool: String(payload.tool),
      summary: payload.summary ?? null,
      args: turn.startedArgs.get(String(payload.toolCallId)) ?? null,
    };
    return;
  }
  if (frame.event === "tool_approval_resolved") {
    turn.pendingApproval = null;
    mockDb.appendAgentChatMessage(chatId, {
      role: "TOOL",
      turnId: turn.turnId,
      scope: [],
      content:
        payload.decision === "APPROVED"
          ? "테스트 유저님이 승인"
          : "테스트 유저님이 거절",
      toolEvent: {
        tool: turn.approvalTool ?? "linear.create_issue",
        decision: payload.decision as "APPROVED" | "REJECTED",
        status: null,
        url: null,
      },
    });
    return;
  }
  if (frame.event === "tool_call_result") {
    mockDb.appendAgentChatMessage(chatId, {
      role: "TOOL",
      turnId: turn.turnId,
      scope: [],
      // 시작 요약과 결과 요약을 둘 다 남긴다. 화면이 「전사에서 관련 발화 검색 · 3건 찾음」을
      // 보여 줬는데 새로고침하면 「3건 찾음」만 남는 것을 막는다.
      content:
        joinSummary(
          turn.startedSummaries.get(String(payload.toolCallId)) ?? null,
          payload.summary ?? null
        ) ?? "도구 실행",
      toolEvent: {
        // **이름을 하드코딩하면 안 된다.** 승인 뒤 결과에는 `tool`이 없으므로
        // (계약: 이름은 승인 요청이 이미 말했다) 재개된 승인의 이름으로 귀속한다.
        tool: payload.tool ?? turn.approvalTool ?? "linear.create_issue",
        decision: null,
        status: payload.status as "success" | "error",
        url: payload.url ?? null,
      },
    });
    return;
  }
  if (frame.event === "message_end") {
    const end = frame.payload as {
      content: string;
      refs?: { kind?: string; id: string; title: string }[];
    };
    // ASSISTANT 행이 드는 것은 **「실제로 본 것」**(refs)이지 요청 범위가 아니다.
    //
    // ★ **접는 방향이 여기서 반대다.** 프레임은 ai 가 낸 소문자이고 굳히는 행은 server 의
    // 대문자다 — 실서버도 ai 의 `refs` 를 읽어 `ScopeRefKind` 로 저장하고 조회에서 그
    // 이름을 그대로 낸다. 목이 이 왕복을 안 하면 화면의 접기가 검사에서 안 밟힌다.
    mockDb.appendAgentChatMessage(chatId, {
      role: "ASSISTANT",
      turnId: turn.turnId,
      content: end.content,
      scope: (end.refs ?? []).map((ref) => ({
        kind: (ref.kind ?? "note").toUpperCase() as ScopeRef["kind"],
        id: ref.id,
        title: ref.title,
        unavailable: false,
      })),
      toolEvent: null,
    });
  }
}

/**
 * 턴을 굳히고 열린 구독을 닫는다 — 안 닫으면 web이 영원히 기다린다.
 *
 * 실패 코드는 `turn_failed`가 실어 온 것을 그대로 쓴다. `retryable`은 **컬럼이 아니라
 * 코드에서 파생한다** — 실제 서버가 그렇게 정의했고, 두 곳에서 정하면 판정이 갈린다.
 */
function settleTurn(chatId: string, status: TurnStatus, failureCode?: unknown) {
  const chat = chatOf(chatId);
  if (chat.turn && isLive(chat.turn)) {
    chat.turn.status = status;
    chat.turn.pendingApproval = null;
    if (status === "FAILED") {
      const code = typeof failureCode === "string" ? failureCode : "INTERNAL_ERROR";
      chat.turn.failureCode = code;
      chat.turn.retryable = code !== "UPSTREAM_REJECTED";
    }
  }
  for (const close of [...chat.closers]) close();
}

function id(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value[0] : String(value ?? "");
}

function failure(code: string, status: number) {
  return HttpResponse.json(
    {
      success: false,
      data: null,
      error: { code, message: code, details: null },
    },
    { status }
  );
}

function noteScope(noteId: string): ScopeRef {
  const note = mockDb.findNoteBrief(noteId);
  return {
    kind: "NOTE",
    id: noteId,
    title: note?.title ?? null,
    unavailable: !note,
  };
}

function projectScope(projectId: string): ScopeRef {
  const project = mockDb.findProjectBrief(projectId);
  return {
    kind: "PROJECT",
    id: projectId,
    title: project?.name ?? null,
    unavailable: !project,
  };
}

function buildInput(
  chatId: string,
  message: string,
  turn: number,
  scope: ScopeRef[],
  turnId: string
) {
  // ★ **여기가 대소문자를 접는 자리다.** 히스토리(REST)는 server 가 내서 `NOTE` 이고
  // 프레임(SSE)은 ai 가 내서 `note` 다 — 실제 시스템이 하는 접기를 목도 그대로 한다.
  // 목이 한쪽 모양만 내면 **화면이 접는 코드가 검사에서 한 번도 안 밟힌다.**
  const named = scope.flatMap((each) =>
    each.title && !each.unavailable
      ? [
          {
            kind: each.kind.toLowerCase() as "note" | "project",
            id: each.id,
            title: each.title,
          },
        ]
      : []
  );
  return {
    chatId,
    message,
    turn,
    scope: named,
    turnId,
  };
}

/**
 * 프레임들을 시간 간격을 두고 흘린다. **1차와 2차가 이 루프를 함께 쓴다** — 승인 뒤
 * 이어지는 것도 같은 대화의 같은 턴이라 지연도 취소도 tee도 다를 이유가 없다.
 *
 * 끝까지 흘렸으면 true. 중간에 취소돼 남은 프레임을 버렸으면 false다.
 */
async function drain(chatId: string, message: string, events: MockSseEvent[]) {
  const chat = chatOf(chatId);
  const turnId = chat.turn?.turnId;
  // 데모용 — 앞을 통째로 버려 바닥을 올린다. **한 번만 버린다**: 매 프레임마다 버리면
  // 재생할 것이 하나도 안 남아 「보낸 뒤 안 닫는다」를 밟을 수 없다.
  if (hasScenario(message, "resync")) dropAll(chat);
  for (const event of events) {
    // 이 대화가 통째로 갈렸으면(테스트 리셋) 그만둔다 — `chatOf`가 지워진 대화를 되살려
    // 다음 테스트의 스트림에 앞 테스트의 프레임을 흘리는 것을 막는다.
    if (chats.get(chatId) !== chat) return false;
    // 취소됐으면 남은 프레임을 안 흘린다 — 실제 서버도 릴레이가 다음 입력 행에서 나간다.
    if (!isRunning(chat.turn) || chat.turn.turnId !== turnId) return false;
    await wait(delayOf(event.event, message));
    publish(chatId, event.event, JSON.parse(event.data));
    // **`error`는 terminal이 아니다.** 뒤에 `turn_failed`가 이어 나와야 턴이 굳는다 —
    // 실제 서버도 ai의 `error`를 흘려보낸 뒤 자기가 턴을 실패로 확정하고 쏜다.
    if (event.event === "error") {
      publish(chatId, "turn_failed", {
        turnId,
        code: "UPSTREAM_ERROR",
        retryable: true,
      });
    }
  }
  return true;
}

/**
 * 턴 하나를 굴린다. **응답과 무관하다** — 구독자가 하나도 없어도 끝까지 돌고, 히스토리에
 * 남는다. 이게 「새로고침해도 흐르던 답이 이어진다」의 목 쪽 조건이다.
 *
 * 승인이 필요한 메시지면 **`tool_approval_request`에서 끝난다.** 이어질 프레임은 승인
 * API가 여는 2차 스트림이 낸다 — 여기서 기다리지 않는다.
 */
async function runTurn(
  chatId: string,
  message: string,
  turnNumber: number,
  scope: ScopeRef[]
) {
  const turn = chatOf(chatId).turn!;
  publish(chatId, "turn_started", {
    turnId: turn.turnId,
    startSeq: turn.startSeq,
  });

  const input = buildInput(chatId, message, turnNumber, scope, turn.turnId);
  const plan = buildApprovalPlan(input);
  if (!plan) {
    if (await drain(chatId, message, buildChatEvents(input))) settleZombie(chatId);
    return;
  }

  // **먼저 등록한다.** 여기서 취소가 끼어들어도 승인 API가 「그 턴이 `WAITING_APPROVAL`이
  // 아니다」로 404를 준다 — 지우러 돌아올 필요가 없다.
  pendingApprovals.set(plan.approvalId, { chatId, message, plan });
  await drain(chatId, message, plan.before);
}

/** 승인이 눌렸다. 나머지 절반을 같은 턴에 이어 흘린다. */
async function runResume(
  chatId: string,
  message: string,
  plan: ApprovalPlan,
  decision: "APPROVED" | "REJECTED"
) {
  if (await drain(chatId, message, plan.after(decision))) settleZombie(chatId);
}

/**
 * terminal 없이 끝나는 경로(계약의 셋째 종료). **이벤트를 안 쏜다** — 실제 서버에서도
 * 좀비 턴은 워치독이 조용히 굳힌다. 안 굳히면 `activeTurn`이 영영 안 비어 전송이 잠긴다.
 */
function settleZombie(chatId: string) {
  settleTurn(chatId, "FAILED", "STREAM_INTERRUPTED");
}

const encoder = new TextEncoder();

/**
 * 선에 나가는 모양. **봉투는 없다** — `data:`는 payload 하나뿐이다.
 *
 * ```
 * id: 1002
 * event: token
 * data: {"delta":"지난 "}
 * ```
 *
 * `id:` 줄이 곧 `seq`이고 **대화 스코프**다. 여기서 봉투를 씌우면 목만 통과하고 실제
 * 서버에서는 커서가 한 번도 안 움직이는 코드가 통과한다.
 */
function render(frame: Frame) {
  return `id: ${frame.seq}\nevent: ${frame.event}\ndata: ${JSON.stringify(frame.payload)}\n\n`;
}

/**
 * 이 대화의 이벤트 스트림을 하나 연다. `after`보다 큰 것을 로그에서 먼저 재생하고,
 * 그 뒤로는 실시간으로 받는다.
 *
 * **바닥 아래에서 붙었으면 `stream_resync`를 먼저 보낸다.** 그 프레임의 `id:`가 바닥이고
 * payload는 `{}`다 — 뜻이 전부 번호에 있다. **보낸 뒤 안 닫는다**: 뒤로 재생과 실시간이
 * 그대로 이어진다. 닫으면 도는 턴의 나머지가 이 연결로 안 와 화면이 멈춘다.
 *
 * 재진입인지를 안 가른다. 실서버도 안 가르고, POST 자신의 커서는 방금 뗀 블록이라
 * 바닥 아래로 내려갈 수가 없다.
 */
function subscribe(chatId: string, after: number | null) {
  const chat = chatOf(chatId);
  let notify: ((frame: Frame) => void) | null = null;
  let close: (() => void) | null = null;
  let beat: ReturnType<typeof setInterval> | null = null;

  return new ReadableStream({
    start(controller) {
      const write = (frame: Frame) => {
        try {
          controller.enqueue(encoder.encode(render(frame)));
        } catch {
          // 이미 닫힌 스트림이다. 구독 해제는 cancel이 한다.
        }
      };
      const stop = () => {
        if (beat) clearInterval(beat);
        if (notify) chat.subscribers.delete(notify);
        if (close) chat.closers.delete(close);
        try {
          controller.close();
        } catch {
          // 이미 닫혔다.
        }
      };

      // 「이 번호 아래로는 못 준다」. 번호가 곧 바닥이라 web의 커서가 여기로 올라가고,
      // 이어지는 재생이 정확히 그 뒤부터다.
      if (after !== null && after < chat.floor) {
        write({ seq: chat.floor, event: "stream_resync", payload: {} });
      }

      for (const frame of chat.buffer) {
        if (after === null || frame.seq > after) write(frame);
      }

      // 선을 잡고 있는 턴이 없으면 줄 것이 없다. 열어 두면 web이 영원히 기다린다.
      // **승인 대기도 여기서 닫힌다** — 다음 프레임은 승인 API가 낸다.
      if (!isRunning(chat.turn)) {
        stop();
        return;
      }

      notify = write;
      close = stop;
      chat.subscribers.add(notify);
      chat.closers.add(close);
      // 도구 실행처럼 이벤트 없이 열어 두는 구간을 견디게 한다. SSE 주석이라 seq를 안 먹는다.
      beat = setInterval(
        () => controller.enqueue(encoder.encode(": keepalive\n\n")),
        HEARTBEAT_MS / speed()
      );
    },
    cancel() {
      if (beat) clearInterval(beat);
      if (notify) chat.subscribers.delete(notify);
      if (close) chat.closers.delete(close);
    },
  });
}

function sseResponse(body: ReadableStream) {
  return new HttpResponse(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export const chatSseHandlers = [
  http.post(
    "*/v1/agent-chats/:chatId/messages",
    async ({ request, params }) => {
      const body = (await request.json()) as {
        message: string;
        noteIds?: string[];
        projectIds?: string[];
      };
      const chatId = id(params.chatId);

      // 계약의 @NotBlank. 스트림을 열기 전에 막아야 실패가 SSE 대신 JSON으로 온다.
      if (!body.message?.trim()) return failure("BAD_REQUEST", 400);

      // 없는/남의 채팅이면 스트림을 반쯤 열지 않고 깔끔한 404를 준다 (계약).
      try {
        mockDb.getAgentChatMessages(chatId);
      } catch {
        return failure("AGENT_CHAT_NOT_FOUND", 404);
      }

      // 목은 범위를 해석하지 않는다 — 요청에 실린 것을 그대로 되돌려 히스토리에 굳힌다.
      // 실제 서버는 여기서 경계를 검사하고 제목을 채운다.
      const scope: ScopeRef[] = [
        ...(body.noteIds ?? []).map((noteId) => noteScope(noteId)),
        ...(body.projectIds ?? []).map((projectId) => projectScope(projectId)),
      ];

      const chat = chatOf(chatId);

      // 「겹쳐서」는 **다른 탭이 이미 턴을 쥐고 있는 상황**을 재현한다. 이 탭의 컴포저는
      // 도는 턴을 보면 잠기므로, 손으로는 이 경로를 밟을 수가 없다.
      if (hasScenario(body.message, "conflict")) {
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: "AGENT_CHAT_TURN_IN_PROGRESS",
              message: "이미 진행 중인 턴이 있습니다.",
              details: [{ field: "turnId", message: `turn-${chatId}-other` }],
            },
          },
          { status: 409 }
        );
      }

      // 아직 도는 턴이 있다 — 한 대화에 턴은 하나다.
      // **`turnId`를 details에 싣는다**: 이걸로 web이 「실패」가 아니라 「이어받기」로 간다.
      if (isLive(chat.turn)) {
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: "AGENT_CHAT_TURN_IN_PROGRESS",
              message: "이미 진행 중인 턴이 있습니다.",
              details: [{ field: "turnId", message: chat.turn.turnId }],
            },
          },
          { status: 409 }
        );
      }

      chat.turns += 1;
      // 턴마다 번호를 블록으로 뗀다 — **구멍을 일부러 낸다.**
      chat.seq = (Math.floor(chat.seq / SEQ_BLOCK) + 1) * SEQ_BLOCK;
      const startSeq = chat.seq;
      chat.turn = {
        turnId: `turn-${chatId}-${chat.turns}`,
        startSeq,
        status: "IN_PROGRESS",
        failureCode: null,
        retryable: null,
        pendingApproval: null,
        startedSummaries: new Map(),
        startedArgs: new Map(),
        approvalTool: null,
      };
      mockDb.appendAgentChatMessage(chatId, {
        role: "USER",
        turnId: chat.turn.turnId,
        content: body.message,
        scope,
        toolEvent: null,
      });

      // ★ 응답과 무관한 루프. 응답 스트림을 끊어도 턴은 계속 돈다.
      // **`"좀비"`는 이 루프를 아예 안 띄운다** — 턴만 `IN_PROGRESS`로 서고 이벤트가
      // 하나도 안 온다. 굳혀 주는 워치독이 없으면 화면이 어떻게 되는지 보는 자리다.
      if (!hasScenario(body.message, "zombie")) {
        void runTurn(chatId, body.message, chat.turns, scope);
      }

      // 응답은 이 대화에 대한 **구독 하나**다. 이 턴이 낸 것부터 받는다.
      return sseResponse(subscribe(chatId, startSeq));
    }
  ),

  // 재연결·재진입 전용. 커서 뒤부터 이어 준다.
  http.get("*/v1/agent-chats/:chatId/events", ({ request, params }) => {
    const chatId = id(params.chatId);
    try {
      mockDb.getAgentChatMessages(chatId);
    } catch {
      return failure("AGENT_CHAT_NOT_FOUND", 404);
    }
    const raw = new URL(request.url).searchParams.get("after");
    const after = raw === null ? null : Number(raw);
    return sseResponse(
      subscribe(chatId, after !== null && Number.isFinite(after) ? after : null)
    );
  }),

  /**
   * 턴 취소. **멱등이다** — 이미 끝난 턴에 눌러도 204다(답이 막 끝나는 순간의 중지는
   * 경합이지 오류가 아니다). 화면이 멈추는 신호는 204가 아니라 `turn_cancelled` 프레임이다.
   */
  http.post(
    "*/v1/agent-chats/:chatId/turns/:turnId/cancel",
    ({ params }) => {
      const chatId = id(params.chatId);
      try {
        mockDb.getAgentChatMessages(chatId);
      } catch {
        return failure("AGENT_CHAT_NOT_FOUND", 404);
      }
      const turn = chats.get(chatId)?.turn ?? null;
      if (!turn || turn.turnId !== id(params.turnId)) {
        return failure("AGENT_CHAT_TURN_NOT_FOUND", 404);
      }
      // 이미 굳었으면 아무것도 안 쏜다 — 두 번 쏘면 버퍼에 terminal이 둘 남는다.
      if (isLive(turn)) publish(chatId, "turn_cancelled", { turnId: turn.turnId });
      return new HttpResponse(null, { status: 204 });
    }
  ),

  /**
   * 승인. **응답이 2차 스트림이다** — 도구 결과도 답변 본문도 이 응답으로 온다.
   *
   * 404 갈래가 셋이다: 그런 승인이 없다 · 이 대화의 것이 아니다 · 그 턴이 승인 대기가
   * 아니다(중지한 턴의 카드가 여기서 걸린다).
   */
  http.post(
    "*/v1/agent-chats/:chatId/approvals/:approvalId/resolve",
    async ({ request, params }) => {
      const chatId = id(params.chatId);
      const approvalId = id(params.approvalId);
      const pending = pendingApprovals.get(approvalId);
      if (!pending || pending.chatId !== chatId) {
        return failure("APPROVAL_NOT_FOUND", 404);
      }
      const chat = chatOf(chatId);
      if (chat.turn?.status !== "WAITING_APPROVAL") {
        return failure("APPROVAL_NOT_FOUND", 404);
      }

      // **`?after=`는 `GET /events?after=`와 같은 뜻이다.** 없으면 이 재개가 뗀 블록의
      // 시작부터라, 그 턴의 1차 절반이 통째로 다시 나간다.
      const rawAfter = new URL(request.url).searchParams.get("after");
      const after = rawAfter === null ? null : Number(rawAfter);

      const body = (await request.json()) as { decision?: string };
      if (body.decision !== "APPROVED" && body.decision !== "REJECTED") {
        // 계약은 두 값 밖을 400으로 막는다. 기본값을 APPROVED로 두면 오타가 쓰기 도구를 실행한다.
        return failure("BAD_REQUEST", 400);
      }

      // 두 번 눌러도 두 번 재개하지 않는다 — 계약의 「이미 처리됐다」가 404다.
      pendingApprovals.delete(approvalId);
      // 다시 선을 잡는다. 이걸 안 하면 아래 구독이 곧바로 닫혀 승인이 아무 일도 안 한다.
      chat.turn.status = "IN_PROGRESS";
      // 2차도 번호를 블록으로 뗀다 — 실제 서버가 재개마다 새 블록을 발급한다.
      chat.seq = (Math.floor(chat.seq / SEQ_BLOCK) + 1) * SEQ_BLOCK;
      const startSeq = chat.seq;

      void runResume(chatId, pending.message, pending.plan, body.decision);

      return sseResponse(
        subscribe(
          chatId,
          after !== null && Number.isFinite(after) ? after : startSeq
        )
      );
    }
  ),
];
