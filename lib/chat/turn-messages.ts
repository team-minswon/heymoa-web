import type {
  AgentChatMessagesResponseData,
  AgentChatMessagesResponseDataMessagesItem,
} from "@/lib/api/generated/models";
import type { ChatStreamState } from "@/lib/chat/stream-protocol";

type Message = AgentChatMessagesResponseDataMessagesItem;
type TurnStream = Pick<ChatStreamState, "phase" | "turnId" | "content">;

/**
 * 다시 읽은 히스토리가 방금 보낸 질문을 이미 담고 있나 — POST 가 서버에 닿았는지를 화면이 뒤늦게
 * 아는 유일한 수단이다. 서버는 이 턴의 행을 기준선 자리에 USER 부터 붙이므로 그 자리 하나만
 * 본다. 대화 전체에서 같은 문장을 찾으면 같은 질문을 되풀이한 예전 턴에 걸린다.
 */
export function echoesSent(
  history: AgentChatMessagesResponseData | null,
  baseline: number,
  message: string
) {
  const asked = history?.messages?.[baseline];
  return asked?.role === "USER" && asked.content === message;
}

/** 도는 턴의 안 굳은 답 조각. 커서가 있으면 재생은 커서 뒤만 주므로 이 조각을 스트림이 들고 간다. */
export function partialAnswerOf(
  messages: Message[],
  activeTurnId: string | undefined,
  cursor: string | null
) {
  if (!activeTurnId || cursor === null) return null;
  const answers = messages.filter(
    (message) => message.role === "ASSISTANT" && message.turnId === activeTurnId
  );
  return answers[answers.length - 1]?.content ?? null;
}

/**
 * 히스토리가 스트림으로 그리던 턴을 이미 담고 있는가. 그렇다면 로컬 사본을 가려 두 벌을 막는다.
 *
 * 정상 종료는 턴을 시작할 때의 길이(`baseline`) 뒤에 붙은 답만 본다 — 대화 전체에서 찾으면 같은
 * 답의 예전 턴에 걸린다. 중지는 server 가 부분 답을 그 턴의 ASSISTANT 행으로 남기므로 턴 id 로
 * 본다. 이 탭에서 보낸 질문의 완료 턴(`showingLocalTurn`)은 로컬 DOM 을 유지하므로 가리지 않는다.
 */
export function isTurnReconciled({
  messages,
  stream,
  baseline,
  showingLocalTurn,
}: {
  messages: Message[];
  stream: TurnStream;
  baseline: number;
  showingLocalTurn: boolean;
}) {
  if (
    !showingLocalTurn &&
    stream.phase === "done" &&
    stream.content !== null &&
    messages
      .slice(baseline)
      .some(
        (message) =>
          message.role === "ASSISTANT" && message.content === stream.content
      )
  ) {
    return true;
  }
  return (
    stream.phase === "cancelled" &&
    stream.turnId !== null &&
    messages.some(
      (message) =>
        message.role === "ASSISTANT" && message.turnId === stream.turnId
    )
  );
}

/**
 * 스트림과 히스토리가 같은 턴을 두 벌 그리지 않게 히스토리 쪽을 접는다. 접는 열쇠는 `turnId` 다.
 *
 * - 이 탭의 완료 턴: 그려 둔 질문·답 DOM 을 유지하고 서버 행은 캐시에만 둔다.
 * - 히스토리 `cursor` 가 있다: 생각·도구는 히스토리가 유일한 출처라(재생은 커서 뒤부터) 답만 접는다.
 *   `done` 도 접는 것은 턴이 끝나고 굳은 행을 다시 받기까지의 창 때문이다.
 * - 커서 없이 흐르는 중: 재생이 턴의 처음부터 오므로 USER 만 남기고 접는다. USER 는 스트림에 안
 *   실린다.
 * - 승인 대기: 열린 스트림이 없어 히스토리가 유일한 출처다. 10분 넘게 선 카드는 스트림 키가 사라져
 *   `cursor === null` 로 돌아오므로 phase 로 따로 가른다.
 *
 * `cursor` 는 스트림 상태의 것이 아니라 히스토리의 것이다. 앞의 값은 프레임마다 밀려서 재생이
 * 시작된 자리를 잊는다.
 */
export function visibleTurnMessages(
  messages: Message[],
  {
    stream,
    cursor,
    showingLocalTurn,
  }: {
    stream: Pick<ChatStreamState, "phase" | "turnId">;
    cursor: string | null;
    showingLocalTurn: boolean;
  }
) {
  const turnId = stream.turnId;
  if (!turnId) return messages;
  if (showingLocalTurn) {
    return messages.filter((message) => message.turnId !== turnId);
  }
  if (
    cursor !== null &&
    (stream.phase === "streaming" || stream.phase === "done")
  ) {
    return messages.filter(
      (message) => !(message.role === "ASSISTANT" && message.turnId === turnId)
    );
  }
  if (stream.phase !== "streaming") return messages;
  return messages.filter(
    (message) => message.role === "USER" || message.turnId !== turnId
  );
}

/**
 * 방금 보낸 턴의 시각을 보낼 때의 클라이언트 시계로 맞춘다. 구분선은 보내는 동안 `pendingUserAt`,
 * 히스토리로 넘어간 뒤 서버 `createdAt` 으로 판정돼서, 두 시계가 자정을 사이에 두고 어긋나면
 * 보낼 때 세운 구분선이 사라진다. 질문만 옮기면 질문과 답 사이에 없던 구분선이 생기므로 턴
 * 전체를 같은 만큼 옮긴다. 화면에 적는 사본만 바꾸고 캐시는 그대로다.
 */
export function freezeTurnTime(
  messages: Message[],
  baseline: number,
  pendingUserAt: string | null
) {
  const asked = messages[baseline];
  if (!pendingUserAt || asked?.role !== "USER") return messages;
  const shift = Date.parse(pendingUserAt) - Date.parse(asked.createdAt);
  if (!shift) return messages;
  return messages.map((message, index) =>
    index < baseline
      ? message
      : {
          ...message,
          createdAt: new Date(
            Date.parse(message.createdAt) + shift
          ).toISOString(),
        }
  );
}
