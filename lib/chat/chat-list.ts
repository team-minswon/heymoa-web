import { viewerDateKey } from "@/lib/format/date";
import type { AgentChatsResponseDataChatsItem } from "@/lib/api/generated/models";
import type { ChatStreamPhase } from "@/lib/chat/stream-protocol";

/** 목록 한 줄에 서는 배지. 없으면 그 대화는 지금 아무것도 안 한다. */
export type RunningLabel = "진행 중" | "승인 대기";

/** 지금 열려 있는 대화에 대해 **SSE 가 아는 것**. 목록보다 항상 빠르다. */
export type OpenChatStatus = {
  chatId: string | null;
  /** `turn_started` 가 준 값. 스트림이 비어 있으면 null이다. */
  turnId: string | null;
  phase: ChatStreamPhase;
  /**
   * ★ 이 탭이 **끝나는 것을 본** 턴. `turnId` 와 달리 `stream.reset()` 이 안 지운다.
   *
   * 턴이 끝나면 `reset()` 이 `turnId` 를 비우는데, 목록은 아직 한 주기 동안 그 턴을
   * 「도는 중」으로 들고 있다. 맞출 열쇠가 없으면 아래 「다른 턴 id」 규칙에 걸려
   * **사라졌던 배지가 다시 선다** — 그 5초가 깜빡임이다.
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
 * ★ **목록 폴링과 SSE 가 같은 대화를 두 출처로 말한다.** 지금 보고 있는 대화는 양쪽에
 * 있고, 목록은 주기만큼 늦는다. 그대로 두면 끝난 턴이 한 주기 동안 「도는 중」으로 서고,
 * 막 시작한 턴은 배지가 늦게 뜬다 — 배지가 깜빡이는 것이 이 어긋남이다.
 *
 * 계약이 정한 규칙은 **「열려 있는 대화의 상태는 SSE 가 이긴다. 어긋나면 `turnId` 로
 * 맞춘다」**이고, 그 한 줄이 여기다.
 *
 * | 목록                       | 무엇을 믿나                                        |
 * | -------------------------- | -------------------------------------------------- |
 * | 다른 대화                  | 목록. 이 탭은 그 대화의 스트림을 안 들고 있다     |
 * | 같은 `turnId`              | **SSE.** 끝난 것을 목록이 아직 모를 뿐이다         |
 * | `null` 인데 스트림이 흐른다 | **SSE.** 시작한 것을 목록이 아직 모를 뿐이다       |
 * | 끝나는 것을 본 `turnId`     | **SSE.** 끝났다. `reset()` 이 지운 열쇠를 이걸로 맞춘다 |
 * | 다른 `turnId`              | 목록. 이 탭이 모르는 턴이라 목록이 유일한 소식이다 |
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

/**
 * 하루. 날짜 키 산술에만 쓴다 — 실제 하루가 23·25시간인 날(DST)이 있어서 시각에 그냥
 * 더하고 빼면 안 된다. 아래 `daysBetween`이 UTC 자정 위에서만 이 값을 쓰는 이유다.
 */
const DAY_MS = 86_400_000;

/**
 * 목록 한 줄이 들어가는 묶음. **셋뿐이다** — 오늘 · 최근 · 지난.
 *
 * 「어제」·「이번 달」 같은 것을 더하지 않는다 — 묶음은 굵은 자리를 말하고, 정확한 자리는
 * 줄 오른쪽의 상대 시각이 말한다. 넷이 되는 순간 둘이 같은 일을 하게 된다.
 *
 * 이름이 셋 다 두 글자인 것은 나란히 놓였을 때 결이 맞기 때문이다.
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
 * **경계는 시각이 아니라 날짜다.** 「어제 오후 11시」와 「오늘 오전 1시」는 두 시간 차이지만
 * 다른 묶음에 들어간다 — 사람이 기대하는 모습이 그쪽이다.
 *
 * 「일주일 내」는 오늘을 포함해 **일곱 날 안**, 즉 날짜 차이가 1~6일인 것이다.
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
 * 이미 정렬된 대화를 날짜 묶음으로 자른다. **여기서 다시 정렬하지 않는다** — 순서의 주인은
 * 서버(`updatedAt` 내림차순) 하나이고, 여기서 또 정렬하면 두 곳이 갈린다. 순서가 시각의
 * 내림차순이므로 순서대로 훑기만 해도 묶음이 시간순으로 떨어진다.
 *
 * **빈 묶음은 아예 안 만든다** — 오늘 것만 있으면 「오늘」 하나만 나온다.
 *
 * 묶는 값과 줄에 적는 시각이 **같은 `updatedAt`** 이어야 한다. 다르면 「1분 전인데 왜
 * 세 번째 줄」이 된다.
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
 * 「1분 전」·「9시간 전」·「3일 전」·「2개월 전」. 숫자와 단위는 `Intl`이 로케일대로 낸다 —
 * 직접 문자열을 조립하지 않는다.
 *
 * 1분 미만은 「방금」이다. `Intl`에 0을 넘기면 시각이 아니라 구간을 말하는 말(「이번 분」)이
 * 나온다.
 *
 * 달·해로 넘어가는 자리는 30일·365일로 자른다. **잰 값이 아니라 관용값이다** — 묶음
 * 머리글이 이미 「오래된 것」이라고 말하고 있어서 이 자리의 정확도는 「대략 얼마나
 * 오래됐나」면 충분하다.
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
