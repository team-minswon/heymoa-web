import type {
  AgentChatMessagesResponseData,
  AgentChatMessagesResponseDataMessagesItem,
} from "@/lib/api/generated/models";
import type { ChatStreamState } from "@/lib/chat/stream-protocol";

type Message = AgentChatMessagesResponseDataMessagesItem;
type TurnStream = Pick<ChatStreamState, "phase" | "turnId" | "content">;

export function echoesSent(
  history: AgentChatMessagesResponseData | null,
  baseline: number,
  message: string
) {
  const asked = history?.messages?.[baseline];
  return asked?.role === "USER" && asked.content === message;
}

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
