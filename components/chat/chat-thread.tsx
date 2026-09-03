"use client";

import { Fragment, memo, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Folder,
  PencilLine,
  XCircle,
} from "lucide-react";

import {
  AnswerRefs,
  ChainOfThought,
  type StepBlock,
} from "@/components/chat/chain-of-thought";
import { Markdown } from "@/components/chat/markdown";
import { useSmoothText } from "@/lib/chat/use-smooth-text";
import { TimeRule } from "@/components/chat/time-rule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AgentChatMessagesResponseDataMessagesItem } from "@/lib/api/generated/models";
import { groupBlocks } from "@/lib/chat/blocks";
import { relativeUpdatedAt } from "@/lib/chat/chat-list";
import { dividerLabel, threadDividers } from "@/lib/chat/time-divider";
import { scopeChipClass } from "@/lib/chat/scope-chip";
import { splitScopeMarkers } from "@/lib/chat/scope-marker";
import { scopeKey } from "@/lib/chat/scope-chip";
import { cn } from "@/lib/utils";
import type {
  ApprovalDecision,
  ChatStreamState,
  ToolArgs,
} from "@/lib/chat/stream-protocol";
import type {
  ApprovalCard,
  ApprovalCardState,
} from "@/lib/chat/use-tool-approval";

/**
 * 개인·공유 챗봇이 같은 스레드 컴포넌트를 쓴다. 공유 메시지는 USER에 `authorName`(멀티멤버)이
 * 붙고 개인 메시지에는 없다 — 둘 다 받아 공통 필드로 렌더하고 이름은 있을 때만 보인다.
 */
export type ThreadMessage = AgentChatMessagesResponseDataMessagesItem;

/**
 * 날짜·시각 구분선. **말풍선에는 여전히 시각이 없다** ([W-09]) — 이 줄만 시각을 말한다.
 *
 * 이 줄이 [W-12] 를 안 어기는 이유는 **질문 시각**이기 때문이다. 답이 끝나는 것과 무관하고,
 * 보내는 순간부터 서 있으므로 히스토리로 넘어갈 때 새로 끼어들지 않는다.
 *
 * `memo` 는 스트리밍 때문이다 — 토큰마다 스레드가 다시 그려지는데 `at` 이 그대로면 `Intl`
 * 포매터를 다시 만들 이유가 없다.
 */
/**
 * 스크롤 상자의 위·아래 여백(`p-6`). **원본은 `personal-chat.tsx` 의 그 클래스**이고
 * 여기서는 「위에 아무것도 없을 때 몇 px 을 덜 줄까」를 재는 데만 쓴다. 저쪽을 고치면
 * 이 값도 같이 고쳐야 한다 — 어긋나면 첫 대화에 빈 스크롤 칸이 다시 생긴다.
 */
const THREAD_PAD_PX = 24;

const TimeDivider = memo(function TimeDivider({ at }: { at: string }) {
  return (
    <TimeRule
      data-testid="thread-divider"
      label={dividerLabel(at, new Date())}
    />
  );
});

/**
 * 채팅 한 스레드. 개인·공유 챗봇이 같은 이벤트 계약을 쓰므로 이 컴포넌트는 어느 쪽인지 모른다 —
 * 히스토리 배열과 진행 중 스트림 상태만 받는다.
 */
export function ChatThread({
  messages,
  stream,
  pendingUserMessage,
  pendingUserAt,
  pinSlackPx,
  pendingUserScope,
  onApprove,
  approvalCard,
  emptyState,
  onOpenNote,
}: {
  messages: ThreadMessage[];
  stream: ChatStreamState;
  /** 방금 보냈지만 아직 히스토리에 없는 유저 메시지. */
  pendingUserMessage: string | null;
  /**
   * ★ 그 질문을 **보낸 시각**. 서버가 저장한 뒤에 오는 `createdAt` 을 기다리지 않는다.
   *
   * 없으면 보내는 동안에는 구분선이 없다가 답이 끝나 히스토리로 넘어가는 순간 **없던 줄이
   * 끼어들어 화면이 밀린다** — 그게 정확히 [W-12] 가 막던 것이다. 보내는 순간부터 서 있어야
   * 왕복에서 레이아웃이 안 움직인다.
   *
   * 렌더마다 `Date.now()` 를 읽으면 안 된다 — 구분선 계산이 순수 함수가 아니게 되고
   * 메모가 걸리지 않는다. 패널이 보낼 때 한 번 붙든 값이다.
   */
  pendingUserAt?: string | null;
  /**
   * ★ 마지막 질문 아래에 남겨 둘 자리(px). 있으면 그 질문이 스크롤 맨 위로 간다.
   *
   * 값은 패널이 잰다 — 스크롤 뷰포트 높이에서 위아래 여백을 뺀 것이다. 여기서 재면
   * 스레드가 자기 스크롤 컨테이너를 알아야 하고, 그건 이 컴포넌트가 알 일이 아니다.
   * **이 대화에서 아직 아무것도 안 보냈으면 비운다** — 옛 대화를 열자마자 아래에 빈
   * 자리가 생기면 읽을 것이 위로 밀린다.
   */
  pinSlackPx?: number | null;
  /**
   * 방금 보낸 질문이 쓴 범위. **여기서 안 그리면 히스토리로 넘어가는 순간 칩 줄이
   * 생기면서 아래가 통째로 밀린다** — 답을 읽던 자리가 어긋난다.
   */
  pendingUserScope?: HistoryScope;
  onApprove: (decision: ApprovalDecision) => void;
  /** 훅이 소유하는 승인 카드. pending이 사라진 뒤에도 무효화 카드를 남기려고 stream이 아니라 이걸 그린다. */
  approvalCard?: ApprovalCard | null;
  emptyState?: React.ReactNode;
  /**
   * 범위 밖 제안. **스트림이 아니라 패널이 든다** — 제안은 `message_end` 에만 실리고
   * 히스토리에는 담을 자리가 없어서, 스트림 상태에 두면 답이 히스토리로 넘어가는
   * 순간(`reset()`) 같이 사라진다. 그러면 이 버튼은 **눌릴 수 있었던 적이 없다.**
   */
  /** 범위 밖 안내의 제안 버튼. 같은 질문을 새 범위로 다시 보낸다. */
  /** 도구 칩·근거 칩을 눌러 그 회의록으로 간다. */
  onOpenNote?: (noteId: string) => void;
}) {
  /**
   * ★ **구분선은 순수 함수가 정하고 `useMemo` 가 붙든다.** 스트리밍 중에는 토큰마다 이
   * 컴포넌트가 다시 그려지는데, 여기서 매번 다시 계산하면 답 길이에 비례해 O(n) 이 돈다.
   * `messages` 는 위에서 이미 memo 된 참조이고 `pendingUserAt` 은 문자열이라 흐르는 동안
   * 둘 다 안 바뀐다.
   *
   * 묶음(`groupHistory`)을 먼저 만들고 **묶음의 첫 시각들**로 구분선을 잰다. 메시지 배열로
   * 재면 화면에 안 그려지는 행(형태가 계약 밖인 `TOOL`)이 구분선을 삼킬 수 있다.
   */
  const rows = useMemo(() => groupHistory(messages), [messages]);
  const dividers = useMemo(
    () =>
      threadDividers([
        ...rows.map((row) => row.at),
        ...(pendingUserAt ? [pendingUserAt] : []),
      ]),
    [pendingUserAt, rows]
  );

  /**
   * 맨 위로 올릴 질문이 어디서 시작하나. 보내는 중이면 아직 히스토리에 없으므로 끝자리이고,
   * 히스토리로 넘어간 뒤에는 **마지막 USER 행**이다 — 그 행부터 아래가 「마지막 턴」이다.
   */
  const pinStart = useMemo(() => {
    if (pendingUserMessage) return rows.length;
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const candidate = rows[index];
      if (candidate.kind === "message" && candidate.message.role === "USER") {
        return index;
      }
    }
    return rows.length;
  }, [pendingUserMessage, rows]);

  /**
   * ★ **위에 아무것도 없으면 그만큼 자리를 덜 준다.**
   *
   * 패널이 준 값은 「뷰포트 높이 − 아래 여백」이다. 그런데 스크롤 상자에는 **위 여백도**
   * 있어서, 위에 옛 대화가 하나도 없으면 그 24px 이 **아무것도 없는 스크롤 칸**으로 남는다 —
   * 바닥까지 내려도 위로 24px 이 더 열리고, 거기에는 볼 것이 없다. 첫 대화에서 QA 가 본
   * 「남는 칸」이 이것이다.
   *
   * 위에 옛 대화가 있으면 그 24px 은 죽은 자리가 아니라 **그 대화가 보이는 자리**라 그대로 둔다.
   */
  const slack =
    pinSlackPx && pinStart === 0
      ? Math.max(0, pinSlackPx - THREAD_PAD_PX)
      : pinSlackPx;

  const isLive = stream.phase !== "idle" || stream.content !== null;
  if (messages.length === 0 && !isLive && !pendingUserMessage && emptyState) {
    return (
      <div className="flex flex-1 flex-col justify-end gap-3">{emptyState}</div>
    );
  }

  const row = (item: HistoryRow, index: number) => (
    <Fragment key={`${item.at}-${index}`}>
      {dividers[index] ? <TimeDivider at={item.at} /> : null}
      {item.kind === "steps" ? (
        <ChainOfThought
          blocks={item.blocks}
          live={false}
          onOpenNote={onOpenNote}
        />
      ) : (
        <HistoryMessage message={item.message} onOpenNote={onOpenNote} />
      )}
    </Fragment>
  );

  return (
    // 대화는 위에서부터 쌓인다. 아래 정렬로 두면 짧은 대화에서 위에 빈 띠가 크게 남아
    // 밀도 합격선(200px 넘는 빈 세로 띠 없음)에 걸린다. 하단 추적은 스크롤 로직이 맡는다.
    <div className="flex flex-1 flex-col gap-4">
      {/* 「대화 시작」 줄은 없다. **구분선은 날짜·시각을 말할 때만 나온다** — 위에
          아무것도 없다는 것이 이미 시작이라는 뜻이고, 첫 메시지 위에 서는 것은 그
          메시지의 시각이지 시작 표시가 아니다. */}
      {rows.slice(0, pinStart).map(row)}

      {/**
       * ★ **마지막 질문이 스크롤 맨 위로 간다.**
       *
       * 여기에 뷰포트 한 화면만큼의 최소 높이를 주면, 바닥으로 스크롤했을 때 이 상자의
       * 위쪽(=질문)이 화면 맨 위에 선다. 답은 그 아래 빈 자리에서 흐른다.
       *
       * **`useStickToBottom` 과 안 싸운다.** 답이 자라는 만큼 이 상자의 남는 자리가 줄어
       * 전체 `scrollHeight` 가 그대로다 — 바닥에 붙이려는 힘이 아무것도 안 옮긴다. 답이
       * 한 화면을 넘어서면 그때부터는 상자가 실제로 자라고, 바닥 추적이 답을 따라간다.
       * 위로 스크롤해 옛 대화를 보고 있으면 `useStickToBottom` 이 이미 손을 뗀 상태라
       * 여기서도 아무 일이 없다.
       *
       * **턴이 끝나도 안 걷는다.** 걷으면 그 높이만큼 아래가 한 번에 올라온다 — [W-12].
       * 다음 질문을 보낼 때 그 질문 자리로 옮겨갈 뿐이다.
       */}
      <div
        data-testid="chat-pinned-turn"
        /**
         * 위 여백은 **숨 쉴 자리**다. 없으면 구분선이 화면 맨 끝에 붙어 잘린 것처럼 보인다.
         *
         * ★ **위에 아무것도 없으면 안 준다.** 그때는 상자 위가 뷰포트 위가 아니라 스크롤
         * 상자의 위 여백(`p-6`) 아래에 앉으므로, 여기서 또 주면 **24px 이 두 벌**이 된다 —
         * 새 대화의 첫 구분선만 48px 을 이고 있고 옛 턴들은 16px 이라 결이 어긋났다.
         * 지금은 두 경우 다 **첫 요소 위가 24px** 이다.
         *
         * ★ **이것은 스크롤 끝을 안 민다.** 한 번 걷었다가 되돌린 자리라 적어 둔다 —
         * 걷은 이유가 「여백만큼 더 내릴 데가 남는다」였는데, 그 전제가 틀렸다. 이 패딩은
         * `minHeight` 를 가진 **같은 상자 안**에 있고 `border-box` 라 높이에 포함된다.
         * 상자 바깥 위는 그대로 뷰포트 위에 맞고, 여백은 그 안에서 내용을 내릴 뿐이다.
         * 「다 내렸는데 위가 조금 비어 있다」가 곧 원하는 그림이고, 거기가 끝이 맞다.
         */
        className={cn("flex flex-col gap-4", slack && pinStart > 0 && "pt-6")}
        style={slack ? { minHeight: slack } : undefined}
      >
        {rows.slice(pinStart).map((item, index) => row(item, pinStart + index))}

        {pendingUserMessage ? (
          <>
            {pendingUserAt && dividers[rows.length] ? (
              <TimeDivider at={pendingUserAt} />
            ) : null}
            <UserBubble
              content={pendingUserMessage}
              scope={pendingUserScope}
              onOpenNote={onOpenNote}
            />
          </>
        ) : null}

        <StreamBlocks stream={stream} onOpenNote={onOpenNote} />
        <ThinkingLine stream={stream} pending={pendingUserMessage !== null} />

        {approvalCard ? (
          <ApprovalPrompt
            summary={approvalCard.summary}
            tool={approvalCard.tool}
            args={approvalCard.args}
            state={approvalCard.state}
            onApprove={onApprove}
          />
        ) : null}

        <StreamTail stream={stream} onOpenNote={onOpenNote} />
        <StreamNotice stream={stream} />
      </div>
    </div>
  );
}

/**
 * 히스토리 행이 들고 오는 범위·근거.
 *
 * 계약은 **한 필드(`scope`)로 접어 보냅니다** — USER 행은 그 턴에 쓴 범위, ASSISTANT 행은
 * 에이전트가 본 것. 둘은 배타라 컬럼도 화면도 갈릴 이유가 없습니다.
 *
 * `unavailable`은 **지워졌거나 권한을 잃은 것**입니다. 둘을 갈라 표시하지 않습니다 —
 * 갈라 주면 워크스페이스 밖 id의 존재 여부가 샙니다.
 */
type HistoryScope = NonNullable<ThreadMessage["scope"]>;

function usableRefs(scope: HistoryScope | undefined) {
  return (scope ?? []).flatMap((each) =>
    each.id && each.title && !each.unavailable
      ? [{ id: each.id, title: each.title }]
      : []
  );
}

function HistoryMessage({
  message,
  onOpenNote,
}: {
  message: ThreadMessage;
  onOpenNote?: (noteId: string) => void;
}) {
  if (message.role === "USER")
    return (
      <UserBubble
        content={message.content}
        scope={message.scope}
        onOpenNote={onOpenNote}
      />
    );
  if (message.role === "ASSISTANT") {
    return (
      // `group/msg` 는 아래 손잡이 줄이 **이 답에 손이 닿았을 때만** 뜨게 하는 이름이다.
      // 이름을 안 붙이면 스레드 어디에 손이 닿아도 모든 줄이 같이 뜬다.
      <div className="group/msg flex flex-col gap-1.5">
        <AssistantText content={message.content} />
        {/* 스트림이 끝나면 이 행이 라이브 말풍선을 대신한다. 여기서 안 그리면
            근거 줄이 몇 초 떴다가 사라진다. */}
        <AnswerRefs refs={usableRefs(message.scope)} onOpenNote={onOpenNote} />
        <MessageActions content={message.content} at={message.createdAt} />
      </div>
    );
  }

  // TOOL·THINKING 행은 여기 안 온다 — `groupHistory`가 스트림과 같은 블록으로 접어 낸다.
  return null;
}

/** 「복사함」이 되돌아가기까지. 눌린 것이 보일 만큼만이고 잰 값은 아니다. */
const COPIED_MS = 1600;

/**
 * ★ **답 하나에 딸린 손잡이 줄.**
 *
 * 평소에는 **투명하되 자리를 잡고 있다.** 조건부로 그리면 손이 닿는 순간 이 줄의 높이만큼
 * 아래가 밀려서, 읽던 자리가 커서를 따라 움직인다 — 이 레포가 「조건부로 나타나는 것이 옆을
 * 밀지 않게 자리를 미리 잡는다」로 못 박아 둔 자리다.
 *
 * **포커스에도 뜬다.** 투명도로만 가리면 키보드 사용자는 안 보이는 버튼에 초점이 간다.
 *
 * ★ **시각은 여기서만 말한다.** 말풍선에 시각을 안 다는 규칙([W-09])은 그대로다 — 이 줄은
 * 말풍선 밖이고 평소에는 아예 안 보인다. 구분선이 「언제쯤」을 말하고 이 줄이 물었을 때
 * 「정확히 얼마 전」을 답한다.
 */
function MessageActions({ content, at }: { content: string; at: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    // 안전하지 않은 출처(http)에는 `clipboard` 가 아예 없다. 없으면 조용히 아무 일도 안 한다 —
    // 여기서 터지면 답 하나가 아니라 스레드가 통째로 안 그려진다.
    void navigator.clipboard
      ?.writeText(content)
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  return (
    <div
      data-testid="message-actions"
      className={cn(
        "flex h-6 items-center gap-1 text-[var(--el-muted)]",
        "opacity-0 transition-opacity group-hover/msg:opacity-100",
        "focus-within:opacity-100 motion-reduce:transition-none"
      )}
    >
      <button
        type="button"
        aria-label={copied ? "복사함" : "복사"}
        onClick={copy}
        className="flex size-6 cursor-pointer items-center justify-center rounded-control transition-colors hover:bg-[var(--el-canvas-soft)] hover:text-[var(--el-ink)]"
      >
        {copied ? (
          <Check aria-hidden className="size-3.5" />
        ) : (
          <Copy aria-hidden className="size-3.5" />
        )}
      </button>
      <span className="text-[11px] tabular-nums">
        {relativeUpdatedAt(at, new Date())}
      </span>
    </div>
  );
}

/**
 * 히스토리의 TOOL 행을 **스트림이 쓰던 블록으로 되돌린다.**
 *
 * 예전에는 여기서만 흰 카드가 섰다. 같은 한 번의 도구 호출이 흐르는 동안에는 접이식
 * 묶음의 한 줄이었다가, 답이 끝나 히스토리로 넘어가는 순간 「linear.create_issue ·
 * 완료」 카드로 갈아입었다 — **사용자가 방금 본 것이 통째로 다른 모양이 됐다.**
 * 지금은 양쪽이 같은 `ChainOfThought`를 지난다.
 *
 * **생각(thinking)도 이제 계약이 저장한다.** `THINKING` 행이 그 자리라, 새로고침 뒤에도
 * 흐를 때와 같은 단계가 선다 [W-11]. 예전에는 여기서 생각이 통째로 빠져서 말이 사라지고
 * 도구 뼈대만 남았다.
 */
type HistoryRow = { at: string } & (
  | { kind: "steps"; blocks: StepBlock[] }
  | { kind: "message"; message: ThreadMessage }
);

/**
 * 승인 기록(`decision`)과 실행 기록(`status`)은 계약상 배타다. 한쪽만 검사하고 나머지를
 * 떨어뜨리면 계약 밖 형태가 반대쪽으로 새어 든다 — 둘 다 아니면 안 그린다.
 */
/**
 * TOOL 행의 `scope` 를 스트림과 같은 `target` 모양으로 되돌린다.
 *
 * 계약의 `kind` 는 `NOTE`·`PROJECT` 대문자이고 스트림의 `target.kind` 는 소문자다.
 * 한 벌만 있으니 첫 항목만 본다 — 도구 한 번은 한 곳을 향한다.
 */
function historyTarget(
  scope: HistoryScope | undefined
): Extract<StepBlock, { kind: "tool" }>["target"] {
  const first = (scope ?? [])[0];
  if (!first?.id || !first.title || first.unavailable) return null;
  const kind = first.kind === "PROJECT" ? "project" : "note";
  return { kind, id: first.id, title: first.title };
}

function toStepBlock(message: ThreadMessage, index: number): StepBlock | null {
  const event = message.toolEvent;
  if (!event) return null;
  if (event.decision) {
    return {
      kind: "approval",
      approvalId: `history-${index}`,
      toolCallId: `history-${index}`,
      tool: event.tool,
      /**
       * ★ **계약이 승인 요약을 저장하지 않는다.** 히스토리의 `toolEvent`는
       * `{tool, decision, status, url}` 뿐이라, 카드가 물을 때 쓴 사람 말(「Linear 이슈
       * 'APP 버그 수정' 생성」)은 새로고침을 못 넘긴다. `content`는 「테스트 유저님이
       * 승인」이라 「승인함」 뒤에 붙이면 같은 말을 두 번 한다.
       *
       * 그래서 여기서는 **비운다.** 도구 id를 대신 넣으면 카드는 사람 말로 묻고
       * 히스토리는 기계 이름으로 답하게 된다 — 같은 일인데 이름이 갈린다. 화면은
       * `summary`가 없으면 그 자리를 아예 안 그린다(`chain-of-thought`).
       */
      summary: null,
      decision: event.decision,
    };
  }
  if (event.status) {
    return {
      kind: "tool",
      toolCallId: `history-${index}`,
      tool: event.tool,
      summary: message.content,
      /**
       * ★ **흐를 때 서 있던 칩이 여기서도 산다.**
       *
       * `toolEvent` 에는 대상이 없지만 server 가 `tool_call_start` 의 `target` 을 TOOL 행의
       * `refs` 로 굳혀서, 읽는 쪽에는 **여느 행과 같은 `scope` 필드**로 온다 — 계약 모양이
       * 안 바뀌었다. 예전에는 여기가 `null` 이라 그 회의록으로 가는 문이 턴이 끝나는 순간
       * 닫혔고, 머리글의 「회의록 N건」도 같이 사라졌다.
       *
       * 제목을 잃은 것(지워졌거나 권한을 잃었다)은 안 세운다 — 눌러도 갈 곳이 없다.
       */
      target: historyTarget(message.scope),
      // 인자도 없다 — 승인 행이 들고 있고 그것은 `pendingApproval` 로만 나온다.
      // 확정된 뒤에는 무엇을 실행했는지를 실행 기록 한 줄이 말한다.
      args: null,
      status: event.status,
      url: event.url,
    };
  }
  return null;
}

/**
 * 스트림과 같은 묶음으로 접는다.
 *
 * ★ **`TOOL`·`THINKING`만 여기로 온다.** 새 role 이 생겼는데 이 갈래에 안 적히면
 * `HistoryMessage` 가 `null` 을 돌려주고 그 행이 **오류 하나 없이 화면에서 사라진다.**
 */
function groupHistory(messages: ThreadMessage[]): HistoryRow[] {
  const rows: HistoryRow[] = [];
  messages.forEach((message, index) => {
    if (message.role === "TOOL" || message.role === "THINKING") {
      const step =
        message.role === "THINKING"
          ? ({ kind: "thinking", text: message.content } as const)
          : toStepBlock(message, index);
      if (!step) return;
      const last = rows.at(-1);
      if (last?.kind === "steps") {
        /**
         * ★ **이어지는 생각은 흐를 때처럼 한 줄이다.**
         *
         * 스트림은 `thinking_delta` 를 만나는 족족 앞 블록에 이어 붙이는데(`appendRun`),
         * server 는 **델타마다 한 행**으로 굳힌다 — 그대로 펼치면 흐를 때 세 줄이던 것이
         * 히스토리에서 네 줄이 되어 턴이 끝나는 순간 점이 하나 늘고 줄이 밀린다.
         *
         * **붙이는 방식도 스트림과 같게 그냥 잇는다.** 구분자를 여기서 새로 만들면
         * 흐를 때와 또 달라진다 — 줄바꿈은 델타 자신이 싣고 온다.
         */
        const previous = last.blocks.at(-1);
        if (previous?.kind === "thinking" && step.kind === "thinking") {
          last.blocks[last.blocks.length - 1] = {
            ...previous,
            text: previous.text + step.text,
          };
          return;
        }
        last.blocks.push(step);
      } else {
        rows.push({ kind: "steps", at: message.createdAt, blocks: [step] });
      }
      return;
    }
    rows.push({ kind: "message", at: message.createdAt, message });
  });
  return rows;
}

/**
 * 유저 발화. **오른쪽 정렬이다.**
 *
 * 공유 챗봇이 있던 시절에는 여러 사람이 한 대화를 써서 "나는 오른쪽"이라는 메신저
 * 관용구가 성립하지 않았다. 개인 대화만 남은 지금은 이 줄기에 사람이 나 하나뿐이라
 * 좌우가 곧 「내 말 / 답」이 된다 — 이름을 안 읽어도 갈린다.
 *
 * **범위는 말풍선 아래 태그 줄이 아니라 문장 안에 있다.** 입력에서 칩은 문장에 박혀
 * 있었는데 보내고 나면 문장 밖 회색 태그로 떨어져 나갔다 — 같은 것이 두 모양으로
 * 보였다. 보낸 그대로, 같은 색으로 문장 안에 둔다.
 */
function UserBubble({
  content,
  scope,
  onOpenNote,
}: {
  content: string;
  /** 이 질문이 쓴 범위. **대화가 아니라 턴이 드는 값**이라 말풍선마다 다를 수 있다. */
  scope?: HistoryScope;
  onOpenNote?: (noteId: string) => void;
}) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-panel bg-[var(--el-surface-strong)] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-[var(--el-ink)]">
        {withScopeChips(content, scope, onOpenNote)}
      </p>
    </div>
  );
}

/** 정규식에 넣을 제목. 괄호·물음표가 든 제목이 실제로 있다. */
function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 살아 있는 범위만. 지워졌거나 권한을 잃은 것(`unavailable`)은 여기서 빠진다.
 *
 * ★ **`kind` 를 여기서 소문자로 접는다.** 같은 필드가 두 전송에서 두 모양으로 온다 —
 * SSE 는 ai 가 내서 `"note"` 이고 히스토리는 server 가 Jackson 으로 내서 `"NOTE"` 다.
 * server 는 도메인 enum 을 응답에 그대로 쓰는 것이 집안 관례라 그쪽이 틀린 게 아니고,
 * **두 출처를 한 화면으로 접는 것은 원래 여기 일이다.**
 *
 * 접기 전에는 조용히 어긋났다. 대문자가 `=== "project"` 를 못 지나 프로젝트가 **회의록
 * 칩으로** 그려지고, 마커가 붙은 프로젝트는 `each.kind === part.kind` 가 어긋나 **칩이
 * 아예 안 그려졌다.** 둘 다 안 터져서 검사도 화면도 멀쩡해 보인다.
 */
function livingScope(scope?: HistoryScope) {
  return (scope ?? []).flatMap((each) =>
    each.id && each.title && !each.unavailable
      ? [
          {
            kind: (each.kind?.toLowerCase() === "project"
              ? "project"
              : "note") as "project" | "note",
            id: each.id,
            title: each.title,
          },
        ]
      : []
  );
}

/**
 * 보낸 문장에서 범위를 칩으로 되돌린다. **길이 둘이다.**
 *
 * 지금 나가는 문장에는 칩이 마커로 실린다(`@[주간 회의](noteId:…)`) — 그 자리를 그대로
 * 읽으면 되고, id 를 들고 있으니 **눌러서 회의록으로 갈 수 있다.**
 *
 * **옛 메시지에는 마커가 없다.** 이미 쌓인 대화가 있어서 파서가 둘 다 받아야 한다.
 * 그때는 예전처럼 범위의 제목을 문장에서 찾는다 — 칩은 그려지되 못 누른다(id 가 없다).
 *
 * 어느 길이든 **배열이 이긴다.** 마커에 있는데 배열에 없는 id 는 칩으로 안 그린다 —
 * 사용자가 문장에 손으로 아무 마커나 칠 수 있고, **화면이 없는 것을 있는 것처럼 그리는
 * 쪽이 나쁘다.** 그런 마커는 글자 그대로 남는다.
 */
function withScopeChips(
  content: string,
  scope?: HistoryScope,
  onOpenNote?: (noteId: string) => void
) {
  const living = livingScope(scope);
  // **배열이 이기는 것은 파서가 안다.** 허용 집합에 없는 마커는 칩이 아니라 글자로
  // 나오므로 여기서 다시 거를 것이 없다 — 그 판정이 두 곳에 있으면 갈린다.
  const parts = splitScopeMarkers(content, new Set(living.map(scopeKey)));
  if (parts.length > 0) {
    return parts.map((part, index) => {
      if ("text" in part) return part.text;
      const hit = living.find(
        (each) => each.id === part.id && each.kind === part.kind
      )!;
      return (
        <ScopeChipMark
          key={index}
          kind={hit.kind}
          title={hit.title}
          onOpen={
            hit.kind === "note" && onOpenNote
              ? () => onOpenNote(hit.id)
              : undefined
          }
        />
      );
    });
  }

  if (living.length === 0) return content;

  // 긴 제목부터. 짧은 것이 긴 것의 일부일 때(「회고」 ⊂ 「스프린트 회고」) 긴 쪽이 먼저
  // 걸려야 반쪽짜리 칩이 안 생긴다.
  const byLength = [...living].sort((a, b) => b.title.length - a.title.length);
  const pattern = new RegExp(
    `(${byLength.map((each) => escapeForRegExp(each.title)).join("|")})`,
    "g"
  );
  return content.split(pattern).map((part, index) => {
    const hit = byLength.find((each) => each.title === part);
    if (!hit) return part;
    // **못 누른다.** 옛 문장은 제목으로만 이어져 있어서 동명 회의록을 못 가른다 —
    // 셋 중 아무 데로나 보내는 것보다 안 보내는 쪽이 낫다.
    return <ScopeChipMark key={index} kind={hit.kind} title={part} />;
  });
}

/**
 * 말풍선 안의 범위 칩. 입력창의 칩과 **같은 class 한 벌**을 쓴다 — 이유는 `scope-chip.ts`.
 *
 * `onOpen` 이 있으면 버튼이다. 문장 흐름 안에 앉아야 해서 `inline-flex` 를 그대로 두고,
 * 밑줄 대신 hover 로 눌리는 것을 말한다 — 문장에 밑줄이 섞이면 링크 더미로 읽힌다.
 */
function ScopeChipMark({
  kind,
  title,
  onOpen,
}: {
  kind: "project" | "note";
  title: string;
  onOpen?: () => void;
}) {
  const Icon = kind === "project" ? Folder : FileText;
  const inside = (
    <>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{title}</span>
    </>
  );
  if (!onOpen) {
    return (
      <span data-scope-chip={kind} className={scopeChipClass(kind)}>
        {inside}
      </span>
    );
  }
  return (
    <button
      type="button"
      data-scope-chip={kind}
      onClick={onOpen}
      // **이름에 「열기」를 붙인다.** 글자만으로는 아래 「찾은 곳」 칩과 이름이 같아서,
      // 화면 낭독기에서도 검사에서도 둘이 안 갈린다.
      aria-label={`${title} 열기`}
      className={scopeChipClass(kind, {
        extra: "cursor-pointer hover:brightness-95",
      })}
    >
      {inside}
    </button>
  );
}

/**
 * 에이전트 발화.
 *
 * **이름도 시각도 안 붙인다** ([W-09]). 이 줄기에 사람이 나 하나뿐이라 좌우가 곧
 * 「내 말 / 답」이고, 이름은 그 위에 얹는 군더더기다. 시각은 서버가 저장한 뒤에야
 * 오므로 답이 끝나는 순간 없던 줄이 끼어들어 **읽던 자리가 밀린다.**
 *
 * **커서도 없다.** 낱말이 물결처럼 떠오르는 것이 이미 「지금 오고 있다」를 말한다.
 * 둘을 같이 두면 깜빡이는 막대가 그 결을 끊는다.
 */
function AssistantText({
  content,
  partial,
  streaming,
}: {
  content: string;
  partial?: boolean;
  /** 지금 토큰이 흐르고 있다. **고르게 푸는 것**만 켠다 — 글자에는 애니메이션이 없다. */
  streaming?: boolean;
}) {
  // 받은 것을 곧바로 안 그린다 — 덩어리로 오는 것을 고른 속도로 푼다(`use-smooth-text`).
  const shown = useSmoothText(content, Boolean(streaming));
  return (
    <div
      data-testid="assistant-message"
      data-streaming={streaming ? "true" : undefined}
      data-partial={partial ? "true" : undefined}
      className={cn(partial && "opacity-60")}
    >
      <Markdown content={shown} />
    </div>
  );
}

/**
 * ★ **아직 아무것도 안 나온 구간.** 보낸 뒤 첫 프레임까지, 그리고 도구가 도는 사이가
 * 여기다 — 예전에는 그 자리에 **아무것도 없었다.** 질문만 덩그러니 남아서 보낸 것이
 * 닿았는지조차 알 수 없었다.
 *
 * 스피너를 안 쓴다. 도는 원은 「무언가 돈다」밖에 못 말하고 이 화면에는 이미 도는 것이
 * 많다. 글자 위로 빛이 지나가면 **그 문장이 지금 살아 있다**는 뜻이 된다.
 */
function ThinkingLine({
  stream,
  pending,
}: {
  stream: ChatStreamState;
  /**
   * 말풍선은 섰는데 스트림이 아직 안 열렸다. **새 대화의 첫 문장이 이 자리를 지난다** —
   * 대화를 만드는 왕복 동안 `phase` 는 아직 `idle` 이라 스트림만 보면 아무것도 못 그린다.
   */
  pending: boolean;
}) {
  const waiting =
    stream.phase === "streaming" || (stream.phase === "idle" && pending);
  if (!waiting || stream.blocks.length > 0) return null;
  return (
    <p
      data-testid="chat-thinking"
      aria-live="polite"
      className="chat-shimmer text-xs"
    >
      생각하는 중
    </p>
  );
}

/**
 * 진행 중 스트림을 **한 배열의 순서대로** 그린다. 예전에는 도구 기록이 본문과 따로
 * 있어서 카드가 언제 끼어들었든 항상 본문 위에 몰렸다.
 *
 * 생각·도구·승인이 연속이면 한 묶음(Chain of Thought)으로 접는다. 본문이 끼면 묶음이
 * 끊긴다 — 답을 쓰기 시작한 뒤의 도구 호출은 앞 묶음의 일부가 아니다.
 */
function StreamBlocks({
  stream,
  onOpenNote,
}: {
  stream: ChatStreamState;
  onOpenNote?: (noteId: string) => void;
}) {
  const groups = groupBlocks(stream.blocks);
  if (groups.length === 0) return null;

  /**
   * 반쯤 쓰이다 만 글인가. **`cancelled`이거나, 실패인데 본문이 남아 있으면**이다.
   *
   * `turn_failed`는 본문 블록을 걷으므로, `failed`인데 본문이 남아 있다는 것은
   * server가 실패를 선언한 것이 아니라 **재연결을 포기한 것**이다(`endStream`).
   */
  const isPartial =
    stream.phase === "cancelled" ||
    (stream.phase === "failed" &&
      stream.blocks.some((block) => block.kind === "text"));
  const lastIndex = groups.length - 1;

  return (
    <>
      {groups.map((group, index) =>
        group.kind === "steps" ? (
          <ChainOfThought
            key={`steps-${index}`}
            blocks={group.blocks}
            live={
              (stream.phase === "streaming" ||
                stream.phase === "awaiting_approval") &&
              index === lastIndex
            }
            onOpenNote={onOpenNote}
          />
        ) : (
          <AssistantText
            key={`text-${index}`}
            content={group.text}
            partial={isPartial}
            streaming={stream.phase === "streaming" && index === lastIndex}
          />
        )
      )}
    </>
  );
}

/**
 * 답변이 끝난 뒤에만 서는 것 — 근거 줄. 흐르는 중에 그리면 아직 안 끝난 답에 결론을
 * 붙이게 된다.
 *
 * ★ **`done` 이 그 순간이다.** 예전 조건(`phase !== "idle" || content === null` 이면 null)은
 * `content` 가 있을 때 `phase` 가 `idle` 인 적이 없어 **한 번도 렌더되지 않았다** — 근거
 * 줄이 히스토리로 갈아끼울 때 처음 튀어 들어와 높이가 한 프레임에 뛰었다(2026-09-03 실측).
 */
function StreamTail({
  stream,
  onOpenNote,
}: {
  stream: ChatStreamState;
  onOpenNote?: (noteId: string) => void;
}) {
  if (stream.phase !== "done") return null;
  return <AnswerRefs refs={stream.refs} animate onOpenNote={onOpenNote} />;
}

/**
 * ★ **「다시 보내기」 버튼은 없다.**
 *
 * 그 버튼이 할 수 있던 일은 **같은 문장을 한 글자도 못 고치고 다시 보내는 것** 하나였다.
 * 실패한 질문은 대개 고쳐서 다시 묻고 싶은 것이고, 중지한 질문은 이미 원하는 만큼 답을
 * 받은 것이다. 그래서 실패했는데 **서버가 그 문장을 안 받아 갔으면** 문장을 컴포저로
 * 되돌리고(`send` 의 실패 갈래), 나머지는 히스토리에 그대로 남는다.
 */
function StreamNotice({ stream }: { stream: ChatStreamState }) {
  if (stream.phase === "failed") {
    return (
      <Notice
        title="응답을 만들지 못했습니다"
        description={
          stream.error?.message ??
          "부분 응답은 저장되지 않았습니다. 다시 보내 주세요."
        }
      />
    );
  }
  // 중지는 배너를 안 세운다 — 사용자가 스스로 멈춘 것이라 알릴 일이 아니다. 여기까지
  // 흐른 답이 흐리게(`opacity-60`) 서 있는 것이 이미 그 말을 한다.
  return null;
}

function Notice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-block border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] p-3.5"
    >
      <div className="flex gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--el-error)]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--el-ink)]">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--el-muted)]">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

/** 한 줄로 접지 않고 그대로 보여줄 값의 길이 상한. 넘으면 접는다. */
const ARG_INLINE_MAX = 80;

/**
 * 승인 카드가 보여줄 인자 줄들.
 *
 * **날 JSON 을 쏟지 않는다.** 사람이 「무엇을 만드는지」를 읽고 판단할 자리라, 이름과 값을
 * 쌍으로 세운다. 다만 **키를 한국어로 번역하지 않는다** — 도구가 늘 때마다 사전을 고쳐야
 * 하고, 모르는 키가 오면 그때 화면이 거짓말을 한다. 도구가 쓰는 이름 그대로 보여준다.
 *
 * 값이 비면(`null`·빈 문자열) **그 줄을 아예 안 그린다.** 빈 칸은 정보가 아니라 흠이다.
 */
function argRows(args: ToolArgs): [string, string][] {
  if (!args) return [];
  return Object.entries(args).flatMap(([key, value]) => {
    if (value === null || value === undefined) return [];
    // 객체·배열은 우리가 모르는 모양이라 구조를 그대로 보여준다.
    //
    // **짧으면 한 줄로 둔다.** 들여쓴 형태만 쓰면 `["bug","payments"]` 같은 두 칸짜리
    // 배열도 세 줄이 되어 접히고, 한눈에 보일 것을 굳이 누르게 만든다.
    const text =
      typeof value === "object" ? compactOrPretty(value) : String(value);
    return text.trim() ? [[key, text] as [string, string]] : [];
  });
}

/** 한 줄에 들어가면 한 줄로, 아니면 들여써서. 판단 기준은 아래 접기와 같은 상한이다. */
function compactOrPretty(value: object): string {
  const compact = JSON.stringify(value);
  return compact.length <= ARG_INLINE_MAX
    ? compact
    : JSON.stringify(value, null, 2);
}

function ApprovalArgs({ args }: { args: ToolArgs }) {
  const rows = argRows(args);
  if (rows.length === 0) return null;
  return (
    <dl
      data-testid="approval-args"
      className="mt-3 flex flex-col gap-1.5 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-3 py-2.5"
    >
      {rows.map(([key, value]) => (
        <div key={key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="shrink-0 text-[11px] leading-5 font-medium text-[var(--el-muted)] sm:w-20">
            {key}
          </dt>
          <dd className="min-w-0 flex-1 text-xs leading-5 break-words text-[var(--el-body)]">
            {value.length > ARG_INLINE_MAX || value.includes("\n") ? (
              // ★ **`<details>` 다.** 열림 상태를 React state 로 들면 카드가 다시 그려질 때마다
              // 접히고, 승인 카드는 스트림 상태가 바뀔 때마다 다시 그려진다.
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
                  <span className="line-clamp-1 group-open:hidden">
                    {value}
                  </span>
                  <span className="hidden text-[var(--el-muted)] group-open:inline">
                    접기
                  </span>
                  <ChevronDown
                    aria-hidden
                    className="size-3 shrink-0 text-[var(--el-muted)] transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="mt-1 whitespace-pre-wrap">{value}</p>
              </details>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * 승인 카드.
 *
 * **도구 id 를 제목으로 안 쓴다.** `linear.create_issue` 는 기계 이름이고, 바로 그 자리에
 * 들어갈 `summary` 가 이미 같은 말을 사람 말로 더 잘 한다 — 「Linear 이슈 'APP 버그 수정'
 * 생성」. 둘을 같이 두면 같은 말을 두 번 한다.
 *
 * ★ **`summary` 는 계약상 nullable 이다.** 비면 배지와 버튼밖에 안 남아 **무엇을 승인하는지
 * 모르는 채 누르게 된다.** 그때만 도구 id 를 fallback 으로 쓴다 — 기계 이름이라도 있는 편이
 * 없는 것보다 낫다.
 *
 * 배지 「쓰기 도구」는 남긴다 — 되돌릴 수 있느냐를 말하는 유일한 신호다.
 * 아래 안내 줄도 남긴다 — 만료가 없다는 것을 말하는 자리다 [U-02].
 */
function ApprovalPrompt({
  summary,
  tool,
  args,
  state,
  onApprove,
}: {
  summary: string | null;
  tool: string;
  args: ToolArgs;
  state: ApprovalCardState;
  onApprove: (decision: ApprovalDecision) => void;
}) {
  const invalidated = state.kind === "invalidated";
  const submitted = state.kind === "submitted";
  return (
    // ★ **답변에 붙여 둔다.** 스레드의 기본 리듬은 `gap-4`(16px)인데 그건 「다른 것들
    // 사이」의 간격이다. 이 카드는 바로 위 본문이 하려는 일을 묻는 것이라 같은 간격을
    // 쓰면 별개의 섬으로 읽힌다 — 절반으로 당긴다. 좌우는 이미 본문과 같은 열이고,
    // 안쪽 여백 14px 은 과정 레일(`border-l-2 pl-3`)의 들여쓰기와 같은 자리다.
    <div className="-mt-2 rounded-panel border border-[var(--el-hairline)] bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <p
          data-testid="approval-summary"
          className={
            invalidated
              ? "min-w-0 flex-1 text-sm leading-relaxed text-[var(--el-muted)]"
              : "min-w-0 flex-1 text-sm leading-relaxed text-[var(--el-ink)]"
          }
        >
          {summary ?? `승인이 필요한 도구: ${tool}`}
        </p>
        {/**
         * ★ **이 카드에서 「되돌릴 수 없다」를 말하는 것은 이 배지뿐이다.** `outline`
         * 이면 카드에서 제일 흐린 것이 그 신호가 된다 — 채움과 아이콘을 준다.
         *
         * **`destructive`(붉은 틴트)는 안 쓴다.** 이 저장소에서 붉음은 되돌릴 수 없이
         * 사라지는 것(노트 삭제·멤버 내보내기·연동 해제)의 색이다. 승인은 사고가 아니라
         * 정상 흐름이라, 매번 빨개지면 진짜 삭제의 붉음이 값을 잃는다.
         */}
        <Badge variant="secondary" className="shrink-0 gap-1">
          <PencilLine aria-hidden />
          쓰기 도구
        </Badge>
      </div>

      {invalidated ? null : <ApprovalArgs args={args} />}

      {invalidated ? (
        // 카드가 죽었다 — 버튼을 지우고 사유를 남긴다. 스트림은 정상 종료돼 컴포저는 다시 열린다.
        <div
          data-approval="invalidated"
          className="mt-3 flex items-start gap-2 rounded-block border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] p-2.5"
        >
          <XCircle className="mt-0.5 size-4 shrink-0 text-[var(--el-error)]" />
          <p className="text-xs leading-relaxed text-[var(--el-body)]">
            {state.reason}
          </p>
        </div>
      ) : (
        <>
          {/* 누른 것만으로 뒤집지 않는다 — 확정은 2차 스트림의 첫 프레임이 정한다.
              submitted면 버튼을 흐리게 잠근다. */}
          <div
            className={
              submitted ? "mt-3 flex gap-2 opacity-40" : "mt-3 flex gap-2"
            }
          >
            {/**
             * **「승인」은 솔리드로 둔다.** 되돌릴 수 없는 외부 쓰기지만 이 저장소에서
             * `destructive`는 삭제 계열의 색이고(`note-delete-dialog`), 승인은 사고가
             * 아니라 정상 흐름이다. `secondary`로 낮추면 거절과 무게가 같아져 흔한
             * 선택에 매번 걸린다. 위험은 색이 아니라 위 배지가 말한다.
             */}
            <Button
              size="sm"
              className="h-[30px]"
              disabled={submitted}
              onClick={() => onApprove("APPROVED")}
            >
              승인
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-[30px]"
              disabled={submitted}
              onClick={() => onApprove("REJECTED")}
            >
              거절
            </Button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--el-muted)]">
            {submitted
              ? "확정은 응답이 재개되면 반영됩니다."
              : "답할 때까지 기다립니다. 그만두려면 「중지」를 누르세요."}
          </p>
        </>
      )}
    </div>
  );
}
