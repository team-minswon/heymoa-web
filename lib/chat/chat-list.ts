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
 * 목록 묶음은 오늘 · 어제 · 지난 7일 · 이전 넷이다. 정확한 자리는 줄 오른쪽의 상대 시각이 말한다.
 */
export type ChatGroup<T> = {
  key: "today" | "yesterday" | "week" | "older";
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
 * 경계는 시각이 아니라 날짜다. 「어제」는 날짜 차이가 1일, 「지난 7일」은 2~6일인 것이다.
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
  if (days === 1) return { key: "yesterday", label: "어제" };
  if (days < 7) return { key: "week", label: "지난 7일" };
  return { key: "older", label: "이전" };
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
 * 「1분 전」·「3일 전」 같은 상대 시각. **앱 언어(`locale`)를 꼭 넘긴다.** 숫자와 단위는 `Intl` 이 낸다. 1분 미만은 「방금」이다 —
 * `Intl` 에 0을 넘기면 「이번 분」이 나온다. 달·해는 30일·365일 관용값으로 자른다.
 */
export function relativeUpdatedAt(at: string, now: Date, locale?: string) {
  const elapsed = now.getTime() - Date.parse(at);
  // 로케일은 앱 언어를 받는다(`useLocale`). 비우면 브라우저 언어를 따라 한국어 화면에 「57m ago」가 섞인다
  if (elapsed < 60_000)
    return locale && !locale.startsWith("ko") ? "just now" : "방금";

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

type ChatListResponse<T> = {
  status: 200;
  data: { success: true; data: { chats: T[] } };
};

/**
 * 대화 목록 캐시(`GET /agent-chats` 응답)가 줄을 가진 성공 응답일 때만 돌려준다. 실패 응답이나 아직 안 읽은
 * 캐시를 바꾼 것처럼 만들거나 빈 목록으로 읽으면 안 된다.
 */
function chatListOf<T>(current: unknown): ChatListResponse<T> | null {
  const response = current as
    | {
        status?: number;
        data?: { success?: boolean; data?: { chats?: T[] } };
      }
    | undefined;
  return response?.status === 200 &&
    response.data?.success &&
    response.data.data?.chats
    ? (response as ChatListResponse<T>)
    : null;
}

function mapChatList<T extends { chatId: string }>(
  current: unknown,
  update: (chats: T[]) => T[]
): unknown {
  const response = chatListOf<T>(current);
  if (!response) return current;
  return {
    ...response,
    data: {
      ...response.data,
      data: { ...response.data.data, chats: update(response.data.data.chats) },
    },
  };
}

/** 그 대화 줄만 뺀다(APP-1409). */
export function dropChatFromList(current: unknown, chatId: string): unknown {
  return mapChatList(current, (chats) =>
    chats.filter((chat) => chat.chatId !== chatId)
  );
}

/**
 * 그 대화 줄의 제목을 바꾼다. 이름 바꾸기의 낙관적 갱신이 쓴다. 출처도 `USER` 로 둔다 — 다시 바꿀 때의 계측이
 * 다음 조회를 기다리지 않고 「사람이 붙인 이름을 또 고쳤다」를 알게.
 */
export function retitleChatInList(
  current: unknown,
  chatId: string,
  title: string
): unknown {
  return mapChatList<{ chatId: string; title: string }>(current, (chats) =>
    chats.map((chat) =>
      chat.chatId === chatId ? { ...chat, title, titleSource: "USER" } : chat
    )
  );
}

/** 이름 바꾸기가 실패했을 때 돌아갈 제목과 출처. */
export type ChatTitleSnapshot = { title: string; titleSource?: unknown };

/**
 * 그 대화의 제목이 아직 `optimistic`(이 요청이 낙관적으로 세운 값)일 때만 `restore` 로 되돌린다. 그 사이 다른
 * 이름 바꾸기·AI 제목·다른 탭의 변경이 들어왔으면 그쪽이 더 새 값이라 건드리지 않는다. 다른 줄은 그대로다.
 */
export function revertChatTitle<T extends { chatId: string; title: string }>(
  chats: readonly T[],
  chatId: string,
  optimistic: string,
  restore: ChatTitleSnapshot
): T[] {
  return chats.map((chat) =>
    chat.chatId === chatId && chat.title === optimistic
      ? { ...chat, title: restore.title, titleSource: restore.titleSource }
      : chat
  );
}

/** 목록 캐시 응답에 `revertChatTitle` 을 적용한다. */
export function revertChatTitleInList(
  current: unknown,
  chatId: string,
  optimistic: string,
  restore: ChatTitleSnapshot
): unknown {
  return mapChatList<{ chatId: string; title: string }>(current, (chats) =>
    revertChatTitle(chats, chatId, optimistic, restore)
  );
}

export type TitleSource = "DEFAULT" | "QUESTION" | "AI" | "USER" | "UNKNOWN";
const TITLE_SOURCES = new Set(["DEFAULT", "QUESTION", "AI", "USER"]);

/**
 * 그 대화 제목의 출처(계약 `titleSource`). 목록 응답에 아직 없는 서버면 UNKNOWN 이다 — 생성 타입이 이 필드를
 * 갖게 되면 이 좁히기는 타입이 대신한다.
 */
export function titleSourceOf(
  chats: readonly { chatId: string }[],
  chatId: string
): TitleSource {
  const source = (
    chats.find((chat) => chat.chatId === chatId) as
      | { titleSource?: unknown }
      | undefined
  )?.titleSource;
  return typeof source === "string" && TITLE_SOURCES.has(source)
    ? (source as TitleSource)
    : "UNKNOWN";
}
