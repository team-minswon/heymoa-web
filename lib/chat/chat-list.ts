import { viewerDateKey } from "@/lib/format/date";
import type { AgentChatsResponseDataChatsItem } from "@/lib/api/generated/models";
import type { ChatStreamPhase } from "@/lib/chat/stream-protocol";
import type { DatesT } from "@/lib/i18n/translator";

export type RunningLabel = "streaming" | "approval";

export type OpenChatStatus = {
  chatId: string | null;
  turnId: string | null;
  phase: ChatStreamPhase;
  finishedTurnId: string | null;
};

function labelOfPhase(phase: ChatStreamPhase): RunningLabel | null {
  if (phase === "awaiting_approval") return "approval";
  return phase === "streaming" ? "streaming" : null;
}

function labelOfList(
  runningTurn: AgentChatsResponseDataChatsItem["runningTurn"]
): RunningLabel | null {
  if (!runningTurn) return null;
  return runningTurn.status === "WAITING_APPROVAL" ? "approval" : "streaming";
}

export function runningLabel(
  chat: Pick<AgentChatsResponseDataChatsItem, "chatId" | "runningTurn">,
  open: OpenChatStatus
): RunningLabel | null {
  if (chat.chatId !== open.chatId) return labelOfList(chat.runningTurn);
  if (chat.runningTurn === null || chat.runningTurn.turnId === open.turnId) {
    return labelOfPhase(open.phase);
  }
  if (chat.runningTurn.turnId === open.finishedTurnId) return null;
  return labelOfList(chat.runningTurn);
}

/** 날짜 키 산술에만 씁니다. DST 로 하루가 23·25시간인 날이 있습니다. */
const DAY_MS = 86_400_000;

type ChatGroup<T> = {
  key: "today" | "yesterday" | "week" | "older";
  chats: T[];
};

function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS
  );
}

function bucketOf(
  at: string,
  now: Date,
  timeZone?: string
): Pick<ChatGroup<never>, "key"> {
  const days = daysBetween(
    viewerDateKey(at, timeZone),
    viewerDateKey(now, timeZone)
  );

  if (days <= 0) return { key: "today" };
  if (days === 1) return { key: "yesterday" };
  if (days < 7) return { key: "week" };
  return { key: "older" };
}

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

/** 1분 미만은 「방금」입니다 — `Intl` 에 0을 넘기면 「이번 분」이 나옵니다. */
export function relativeUpdatedAt(
  at: string,
  now: Date,
  t: DatesT,
  locale?: string
) {
  const elapsed = now.getTime() - Date.parse(at);
  // 앱 언어를 넘깁니다. 비우면 브라우저 언어를 따라 「57m ago」가 섞입니다.
  if (elapsed < 60_000) return t("justNow");

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

export function dropChatFromList(current: unknown, chatId: string): unknown {
  return mapChatList(current, (chats) =>
    chats.filter((chat) => chat.chatId !== chatId)
  );
}

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

export type ChatTitleSnapshot = { title: string; titleSource?: unknown };

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

type TitleSource = "DEFAULT" | "QUESTION" | "AI" | "USER" | "UNKNOWN";
const TITLE_SOURCES = new Set(["DEFAULT", "QUESTION", "AI", "USER"]);

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

export const TITLE_TURN_WAIT_MS = 10 * 60_000;
export const AI_TITLE_WAIT_MS = 15_000;

export type TitleWaits = Readonly<Record<string, number>>;

export function settleTitleWait(
  waits: TitleWaits,
  chatId: string,
  done: boolean,
  now: number
): TitleWaits {
  if (!(chatId in waits)) return waits;
  if (done) return { ...waits, [chatId]: now + AI_TITLE_WAIT_MS };
  return Object.fromEntries(
    Object.entries(waits).filter(([waiting]) => waiting !== chatId)
  );
}

export function pruneTitleWaits(waits: TitleWaits, now: number): TitleWaits {
  const kept = Object.entries(waits).filter(([, deadline]) => deadline > now);
  return kept.length === Object.keys(waits).length
    ? waits
    : Object.fromEntries(kept);
}

export function isTitlePending(
  chat: { chatId: string; titleSource?: unknown },
  waits: TitleWaits
): boolean {
  return (
    chat.chatId in waits &&
    (chat.titleSource === "DEFAULT" || chat.titleSource === "QUESTION")
  );
}
