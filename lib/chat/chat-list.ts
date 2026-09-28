import { viewerDateKey } from "@/lib/format/date";
import type { AgentChatsResponseDataChatsItem } from "@/lib/api/generated/models";
import type { ChatStreamPhase } from "@/lib/chat/stream-protocol";

/** 목록 한 줄에 서는 배지. 없으면 그 대화는 지금 아무것도 안 한다. */
export type RunningLabel = "진행 중" | "승인 대기";

/** 지금 열려 있는 대화에 대해 SSE 가 아는 것. 목록보다 항상 빠르다. */
export type OpenChatStatus = {
  chatId: string | null;
  /** `POST` 의 202 본문(또는 `activeTurn`)이 준 값. 스트림이 비어 있으면 null이다. */
  turnId: string | null;
  phase: ChatStreamPhase;
  /**
   * 이 탭이 끝나는 것을 본 턴. `reset()` 이 `turnId` 를 비운 뒤에도 목록은 한 주기 동안 그
   * 턴을 「도는 중」으로 들고 있어서, 이 열쇠가 없으면 사라졌던 배지가 다시 선다.
   */
  finishedTurnId: string | null;
};

function labelOfPhase(phase: ChatStreamPhase): RunningLabel | null {
  if (phase === "awaiting_approval") return "승인 대기";
  return phase === "streaming" ? "진행 중" : null;
}

function labelOfList(
  runningTurn: AgentChatsResponseDataChatsItem["runningTurn"]
): RunningLabel | null {
  if (!runningTurn) return null;
  return runningTurn.status === "WAITING_APPROVAL" ? "승인 대기" : "진행 중";
}

/**
 * 목록 폴링과 SSE 가 같은 대화를 말한다. 계약의 규칙은 「열려 있는 대화는 SSE 가 이기고,
 * 어긋나면 `turnId` 로 맞춘다」이다. 목록을 믿는 것은 다른 대화이거나, 이 탭이 모르는 다른
 * `turnId` 일 때뿐이다.
 */
export function runningLabel(
  chat: Pick<AgentChatsResponseDataChatsItem, "chatId" | "runningTurn">,
  open: OpenChatStatus
): RunningLabel | null {
  if (chat.chatId !== open.chatId) return labelOfList(chat.runningTurn);
  if (chat.runningTurn === null || chat.runningTurn.turnId === open.turnId) {
    return labelOfPhase(open.phase);
  }
  // 끝나는 것을 본 턴이다. 목록이 아직 모르는 것뿐이라 배지를 안 세운다.
  if (chat.runningTurn.turnId === open.finishedTurnId) return null;
  return labelOfList(chat.runningTurn);
}

/** 날짜 키 산술에만 쓴다. DST 로 하루가 23·25시간인 날이 있어 시각에 그냥 더하면 안 된다. */
const DAY_MS = 86_400_000;

/**
 * 목록 묶음은 오늘 · 최근 · 지난 셋뿐이다. 정확한 자리는 줄 오른쪽의 상대 시각이 말한다.
 */
export type ChatGroup<T> = {
  key: "today" | "week" | "older";
  label: string;
  chats: T[];
};

/** 두 날짜 키 사이의 날 수. 날짜만 있는 값이라 UTC 자정 위에서 세면 DST에 안 흔들린다. */
function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS
  );
}

/**
 * 경계는 시각이 아니라 날짜다. 「최근」은 날짜 차이가 1~6일인 것이다.
 */
function bucketOf(
  at: string,
  now: Date,
  timeZone?: string
): Pick<ChatGroup<never>, "key" | "label"> {
  const days = daysBetween(
    viewerDateKey(at, timeZone),
    viewerDateKey(now, timeZone)
  );

  if (days <= 0) return { key: "today", label: "오늘" };
  if (days < 7) return { key: "week", label: "최근" };
  return { key: "older", label: "지난" };
}

/**
 * 이미 정렬된 대화를 날짜 묶음으로 자른다. 순서의 주인은 서버(`updatedAt` 내림차순)라 여기서
 * 다시 정렬하지 않는다. 빈 묶음은 안 만든다. 묶는 값과 줄에 적는 시각은 같은 `updatedAt`
 * 이어야 한다.
 */
export function groupChatsByRecency<T extends { updatedAt: string }>(
  sortedChats: readonly T[],
  now: Date,
  timeZone?: string
): ChatGroup<T>[] {
  const groups: ChatGroup<T>[] = [];

  for (const chat of sortedChats) {
    const bucket = bucketOf(chat.updatedAt, now, timeZone);
    const last = groups.at(-1);

    if (last && last.key === bucket.key) {
      last.chats.push(chat);
      continue;
    }
    groups.push({ ...bucket, chats: [chat] });
  }

  return groups;
}

/**
 * 「1분 전」·「3일 전」 같은 상대 시각. 숫자와 단위는 `Intl` 이 낸다. 1분 미만은 「방금」이다 —
 * `Intl` 에 0을 넘기면 「이번 분」이 나온다. 달·해는 30일·365일 관용값으로 자른다.
 */
export function relativeUpdatedAt(at: string, now: Date, locale?: string) {
  const elapsed = now.getTime() - Date.parse(at);
  if (elapsed < 60_000) return "방금";

  const format = new Intl.RelativeTimeFormat(locale, {
    numeric: "always",
    style: "narrow",
  });
  if (elapsed < 3_600_000) {
    return format.format(-Math.floor(elapsed / 60_000), "minute");
  }
  if (elapsed < DAY_MS) {
    return format.format(-Math.floor(elapsed / 3_600_000), "hour");
  }
  const days = Math.floor(elapsed / DAY_MS);
  if (days < 30) return format.format(-days, "day");
  if (days < 365) return format.format(-Math.floor(days / 30), "month");
  return format.format(-Math.floor(days / 365), "year");
}
