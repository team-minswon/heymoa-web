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
import { groupBlocks, settleEndedTurn } from "@/lib/chat/blocks";
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

export type ThreadMessage = AgentChatMessagesResponseDataMessagesItem;

/** 스크롤 상자의 위 여백. 원본은 `personal-chat.tsx` 의 `p-6` 이라 저쪽을 고치면 같이 고친다. */
const THREAD_PAD_PX = 24;

// 토큰마다 스레드가 다시 그려져도 `at` 이 같으면 포매터를 다시 만들지 않는다.
const TimeDivider = memo(function TimeDivider({ at }: { at: string }) {
  return (
    <TimeRule
      data-testid="thread-divider"
      label={dividerLabel(at, new Date())}
    />
  );
});

/** 채팅 한 스레드. 히스토리 배열과 진행 중 스트림 상태만 받는다. */
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
  activeTurnId = null,
}: {
  messages: ThreadMessage[];
  stream: ChatStreamState;
  /** 방금 보냈지만 아직 히스토리에 없는 유저 메시지. */
  pendingUserMessage: string | null;
  /**
   * 그 질문을 보낸 시각. 서버 `createdAt` 을 기다리면 히스토리로 넘어가는 순간 구분선이
   * 끼어들어 화면이 밀린다. 렌더마다 `Date.now()` 를 읽으면 메모가 안 걸리므로 보낼 때
   * 한 번 붙든 값을 준다.
   */
  pendingUserAt?: string | null;
  /**
   * 마지막 질문 아래에 남길 자리(px). 있으면 그 질문이 스크롤 맨 위로 간다. 값은 패널이
   * 잰다. 이 대화에서 아직 보낸 게 없으면 비운다 — 옛 대화를 열자마자 읽을 것이 위로 밀린다.
   */
  pinSlackPx?: number | null;
  /** 방금 보낸 질문의 범위. 여기서 안 그리면 히스토리로 넘어갈 때 칩이 생기며 아래가 밀린다. */
  pendingUserScope?: HistoryScope;
  onApprove: (decision: ApprovalDecision) => void;
  /** 훅이 소유하는 승인 카드. pending이 사라진 뒤에도 무효화 카드를 남기려고 stream이 아니라 이걸 그린다. */
  approvalCard?: ApprovalCard | null;
  emptyState?: React.ReactNode;
  /** 도구 칩·근거 칩을 눌러 그 회의록으로 간다. */
  onOpenNote?: (noteId: string) => void;
  /** 지금 도는 턴(`activeTurn.turnId`). 이 턴의 히스토리 행만 끝난 턴으로 닫지 않는다. */
  activeTurnId?: string | null;
}) {
  // 스트리밍 중에는 토큰마다 다시 그려지므로 구분선 계산을 붙든다. 구분선은 메시지가 아니라
  // 묶음의 첫 시각으로 잰다 — 화면에 안 그려지는 행이 구분선을 삼키지 않게.
  const rows = useMemo(
    () => groupHistory(messages, activeTurnId),
    [activeTurnId, messages]
  );
  const dividers = useMemo(
    () =>
      threadDividers([
        ...rows.map((row) => row.at),
        ...(pendingUserAt ? [pendingUserAt] : []),
      ]),
    [pendingUserAt, rows]
  );

  // 맨 위로 올릴 질문의 시작 행. 보내는 중이면 끝자리, 아니면 마지막 USER 행이다.
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

  // 위에 옛 대화가 없으면 스크롤 상자의 위 여백만큼 덜 준다. 안 빼면 바닥까지 내려도 볼 것
  // 없는 칸이 24px 남는다.
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
    // 위에서부터 쌓는다. 아래 정렬이면 짧은 대화 위에 빈 띠가 크게 남는다. 하단 추적은
    // 스크롤 로직이 맡는다.
    <div className="flex flex-1 flex-col gap-4">
      {rows.slice(0, pinStart).map(row)}

      {/*
       * 마지막 턴에 뷰포트 높이만큼 최소 높이를 줘서 질문이 스크롤 맨 위에 서게 한다.
       * 답이 자라는 만큼 남는 자리가 줄어 scrollHeight 가 그대로라 `useStickToBottom` 과
       * 안 싸운다. 턴이 끝나도 걷지 않는다 — 걷으면 그 높이만큼 아래가 한 번에 올라온다.
       */}
      <div
        data-testid="chat-pinned-turn"
        /**
         * 위 여백은 구분선이 화면 끝에 붙어 잘려 보이지 않게 하는 자리다. 위에 아무것도
         * 없으면 스크롤 상자의 `p-6` 과 겹쳐 두 벌이 되므로 안 준다. `border-box` 라
         * `minHeight` 안에 들어가고 스크롤 끝을 밀지 않는다.
         */
        className={cn(
          "flex flex-col gap-4",
          slack && pinStart > 0 && "pt-6",
          stream.phase === "done" && pendingUserMessage && "group/msg"
        )}
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
        {stream.phase === "done" && pendingUserMessage && pendingUserAt ? (
          <MessageActions content={stream.content ?? ""} at={pendingUserAt} />
        ) : null}
        <StreamNotice stream={stream} />
      </div>
    </div>
  );
}

/**
 * 히스토리 행의 범위·근거. USER 행은 그 턴에 쓴 범위, ASSISTANT 행은 에이전트가 본 것이다.
 * `unavailable` 은 지워졌거나 권한을 잃은 것인데 둘을 가르지 않는다 — 가르면 워크스페이스
 * 밖 id 의 존재 여부가 샌다.
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
      // `group/msg` 로 이름을 붙여야 이 답에 손이 닿았을 때만 손잡이 줄이 뜬다.
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
 * 답 하나에 딸린 손잡이 줄. 조건부로 그리면 손이 닿을 때 아래가 밀려서 투명하게 자리를
 * 잡아 둔다. 투명도만 쓰면 키보드 초점이 안 보이는 버튼에 가므로 포커스에도 뜬다.
 */
function MessageActions({ content, at }: { content: string; at: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    // 안전하지 않은 출처(http)에는 `clipboard` 가 없다. 여기서 던지면 스레드가 통째로 안 그려진다.
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

// 히스토리 행을 스트림과 같은 블록으로 되돌린다. 흐를 때와 끝난 뒤의 모양이 같아야 한다.
type HistoryRow = { at: string } & (
  | { kind: "steps"; turnId: string | null; blocks: StepBlock[] }
  | { kind: "message"; message: ThreadMessage }
);

/**
 * TOOL 행의 `scope` 를 스트림의 `target` 모양으로 되돌린다. 계약의 `kind` 는 대문자,
 * 스트림은 소문자다. 도구 한 번은 한 곳을 향하므로 첫 항목만 본다.
 */
function historyTarget(
  scope: HistoryScope | undefined
): Extract<StepBlock, { kind: "tool" }>["target"] {
  const first = (scope ?? [])[0];
  if (!first?.id || !first.title || first.unavailable) return null;
  const kind = first.kind === "PROJECT" ? "project" : "note";
  return { kind, id: first.id, title: first.title };
}

// 승인 기록(`decision`)과 실행 기록(`status`)은 계약상 배타다. 둘 다 아니면 안 그린다.
function toStepBlock(message: ThreadMessage, index: number): StepBlock | null {
  const event = message.toolEvent;
  if (!event) return null;
  if (event.decision) {
    return {
      kind: "approval",
      approvalId: `history-${index}`,
      toolCallId: `history-${index}`,
      tool: event.tool,
      // 히스토리 `toolEvent` 에는 승인 요약이 없다. `content` 는 「…님이 승인」이라 붙이면
      // 같은 말을 두 번 하고, 도구 id 를 넣으면 카드와 이름이 갈린다. 비우면 그 자리를 안 그린다.
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
      // server 가 `tool_call_start` 의 `target` 을 TOOL 행의 `scope` 로 굳혀 준다.
      target: historyTarget(message.scope),
      // 인자는 승인 행만 들고 `pendingApproval` 로만 나온다.
      args: null,
      status: event.status,
      url: event.url,
    };
  }
  return null;
}

/**
 * 스트림과 같은 묶음으로 접는다. `TOOL`·`THINKING` 만 이리 온다 — 새 role 을 여기 안 적으면
 * `HistoryMessage` 가 null 을 돌려 그 행이 조용히 사라진다.
 */
function groupHistory(
  messages: ThreadMessage[],
  activeTurnId: string | null
): HistoryRow[] {
  const rows: HistoryRow[] = [];
  // 히스토리 행에는 `toolCallId` 가 없다. server 는 승인 뒤 재개에서 그 도구를 먼저 실행해 결과를
  // 쓰므로, APPROVED 뒤 첫 결과 행이 그 승인의 짝이다.
  let approvedCallId: string | null = null;
  messages.forEach((message, index) => {
    if (message.role === "TOOL" || message.role === "THINKING") {
      let step: StepBlock | null =
        message.role === "THINKING"
          ? ({ kind: "thinking", text: message.content } as const)
          : toStepBlock(message, index);
      if (!step) return;
      if (step.kind === "approval") {
        approvedCallId =
          step.decision === "APPROVED" ? step.toolCallId : null;
      } else if (step.kind === "tool" && approvedCallId) {
        step = { ...step, toolCallId: approvedCallId };
        approvedCallId = null;
      }
      const last = rows.at(-1);
      if (last?.kind === "steps") {
        // 스트림은 이어지는 `thinking_delta` 를 앞 블록에 붙이는데 server 는 델타마다 한 행으로
        // 굳힌다. 여기서도 구분자 없이 이어 붙여야 턴이 끝날 때 줄 수가 안 바뀐다.
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
        rows.push({
          kind: "steps",
          at: message.createdAt,
          turnId: message.turnId ?? null,
          blocks: [step],
        });
      }
      return;
    }
    approvedCallId = null;
    rows.push({ kind: "message", at: message.createdAt, message });
  });
  return rows.map((row) =>
    row.kind === "steps" && (!activeTurnId || row.turnId !== activeTurnId)
      ? { ...row, blocks: settleEndedTurn(row.blocks) as StepBlock[] }
      : row
  );
}

/** 유저 발화. 오른쪽 정렬이고, 범위는 입력할 때처럼 문장 안에 칩으로 둔다. */
function UserBubble({
  content,
  scope,
  onOpenNote,
}: {
  content: string;
  /** 이 질문이 쓴 범위. 대화가 아니라 턴의 값이라 말풍선마다 다를 수 있다. */
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
 * 살아 있는 범위만. `kind` 는 SSE(ai)가 `"note"`, 히스토리(server)가 `"NOTE"` 로 보내므로
 * 여기서 소문자로 접는다. 안 접으면 프로젝트가 회의록 칩으로 그려지거나 칩이 아예 빠진다.
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
 * 보낸 문장에서 범위를 칩으로 되돌린다. 마커(`@[제목](noteId:…)`)가 있으면 그 자리를 쓰고
 * 누를 수 있다. 마커가 없는 옛 메시지는 제목을 찾아 칩만 그린다(id 가 없어 못 누른다).
 * 어느 쪽이든 범위 배열에 없는 것은 칩으로 안 그린다 — 마커는 손으로도 칠 수 있다.
 */
function withScopeChips(
  content: string,
  scope?: HistoryScope,
  onOpenNote?: (noteId: string) => void
) {
  const living = livingScope(scope);
  // 배열에 없는 마커는 파서가 글자로 내므로 아래 `find` 는 늘 찾는다.
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
    // 옛 문장은 제목으로만 이어져 동명 회의록을 못 가르므로 못 누르게 둔다.
    return <ScopeChipMark key={index} kind={hit.kind} title={part} />;
  });
}

/**
 * 말풍선 안의 범위 칩. 입력창 칩과 같은 class 를 쓴다(`scope-chip.ts`). 문장 안이라 밑줄
 * 대신 hover 로 눌리는 것을 보인다.
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
      // 아래 「찾은 곳」 칩과 접근성 이름이 같아지지 않게 「열기」를 붙인다.
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
 * 에이전트 발화. 이름·시각·커서를 안 붙인다. 시각은 서버 저장 뒤에야 와서 답이 끝나는
 * 순간 줄이 끼어든다.
 */
function AssistantText({
  content,
  partial,
  streaming,
}: {
  content: string;
  partial?: boolean;
  /** 지금 토큰이 흐르고 있다. 고르게 푸는 것만 켠다. */
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

/** 보낸 뒤 첫 블록이 오기 전까지 서는 줄. */
function ThinkingLine({
  stream,
  pending,
}: {
  stream: ChatStreamState;
  /** 말풍선은 섰는데 스트림이 아직 안 열렸다. 새 대화는 대화를 만드는 동안 `phase` 가 `idle` 이다. */
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
 * 진행 중 스트림을 블록 순서대로 그린다. 생각·도구·승인이 이어지면 한 묶음으로 접고,
 * 본문이 끼면 묶음이 끊긴다.
 */
function StreamBlocks({
  stream,
  onOpenNote,
}: {
  stream: ChatStreamState;
  onOpenNote?: (noteId: string) => void;
}) {
  const ended =
    stream.phase === "done" ||
    stream.phase === "failed" ||
    stream.phase === "cancelled";
  const groups = groupBlocks(
    ended
      ? settleEndedTurn(
          stream.blocks,
          stream.error?.code !== "STREAM_INTERRUPTED"
        )
      : stream.blocks
  );
  if (groups.length === 0) return null;

  // `turn_failed` 는 본문 블록을 걷으므로, 실패인데 본문이 남았으면 재연결을 포기한 것이다
  // (`endStream`).
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

/** 근거 줄. 끝나지 않은 답에 결론을 붙이지 않게 `done` 에서만 선다. */
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

// 「다시 보내기」는 없다. 서버가 문장을 안 받아 갔으면 `send` 가 컴포저로 되돌린다.
function StreamNotice({ stream }: { stream: ChatStreamState }) {
  if (stream.phase === "failed") {
    return (
      <Notice
        title="응답을 만들지 못했습니다"
        description={
          stream.error?.message ??
          "연결이 끊겼습니다. 새로고침하면 지금까지 굳은 답이 보입니다."
        }
      />
    );
  }
  // 중지는 사용자가 한 일이라 배너를 안 세운다. 흐리게 남은 답이 이미 그 말을 한다.
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
 * 승인 카드의 인자 줄. 키는 도구가 쓰는 이름 그대로 둔다 — 번역 사전은 도구가 늘 때마다
 * 낡는다. 빈 값은 줄째 뺀다.
 */
function argRows(args: ToolArgs): [string, string][] {
  if (!args) return [];
  return Object.entries(args).flatMap(([key, value]) => {
    if (value === null || value === undefined) return [];
    // 객체·배열은 모르는 모양이라 JSON 으로 보이고, 짧으면 한 줄로 둔다.
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
              // 열림을 React state 로 들면 카드가 다시 그려질 때마다 접힌다.
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
 * 승인 카드. `summary` 는 계약상 nullable 이라 비면 도구 id 를 대신 쓴다 — 무엇을
 * 승인하는지 모르고 누르게 두지 않는다.
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
    // 바로 위 본문이 하려는 일을 묻는 카드라 스레드 간격의 절반으로 당긴다.
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
        {/* 되돌릴 수 없는 쓰기라는 유일한 신호라 채움과 아이콘을 준다. `destructive` 는
            삭제 계열의 색이라 안 쓴다. */}
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
          {/* 누른 것만으로 뒤집지 않는다. 확정은 재개 스트림의 첫 프레임이 정한다. */}
          <div
            className={
              submitted ? "mt-3 flex gap-2 opacity-40" : "mt-3 flex gap-2"
            }
          >
            {/* 승인은 정상 흐름이라 솔리드로 둔다. 위험은 배지가 말한다. */}
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
