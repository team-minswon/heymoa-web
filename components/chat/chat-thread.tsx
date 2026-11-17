"use client";

import { Fragment, memo, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  Folder,
  Square,
} from "lucide-react";

import {
  AnswerRefs,
  ChainOfThought,
  PendingProgress,
  type StepBlock,
} from "@/components/chat/chain-of-thought";
import { ChatIconButton } from "@/components/chat/chat-icon-button";
import { Markdown } from "@/components/chat/markdown";
import { copyText } from "@/lib/ui/copy-text";
import { useSmoothText } from "@/lib/chat/use-smooth-text";
import { TimeRule } from "@/components/chat/time-rule";
import type { AgentChatMessagesResponseDataMessagesItem } from "@/lib/api/generated/models";
import { ApprovalCard } from "@/components/chat/approval-card";
import { resolvedStatus } from "@/lib/chat/approval-card";
import { type Group, groupBlocks, settleEndedTurn } from "@/lib/chat/blocks";
import { relativeUpdatedAt } from "@/lib/chat/chat-list";
import { dividerLabel, threadDividers } from "@/lib/chat/time-divider";
import { scopeChipClass } from "@/lib/chat/scope-chip";
import { splitScopeMarkers } from "@/lib/chat/scope-marker";
import { scopeKey } from "@/lib/chat/scope-chip";
import { cn } from "@/lib/utils";
import {
  type ApprovalDecision,
  type ChatStreamState,
  parseApprovalCard,
} from "@/lib/chat/stream-protocol";
import type { PendingApprovalCard } from "@/lib/chat/use-tool-approval";

export type ThreadMessage = AgentChatMessagesResponseDataMessagesItem;

const THREAD_PAD_PX = 24;

const TimeDivider = memo(function TimeDivider({ at }: { at: string }) {
  // 앱 언어로 적는다. 비우면 브라우저 언어를 따라 「어제 11:44 PM」이 섞인다
  const locale = useLocale();
  const tDates = useTranslations("dates");
  return (
    <TimeRule
      data-testid="thread-divider"
      label={dividerLabel(at, new Date(), tDates, locale)}
    />
  );
});

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
  cancelledTurnId = null,
}: {
  messages: ThreadMessage[];
  stream: ChatStreamState;
  pendingUserMessage: string | null;
  pendingUserAt?: string | null;
  pinSlackPx?: number | null;
  pendingUserScope?: HistoryScope;
  onApprove: (decision: ApprovalDecision) => void;
  approvalCard?: PendingApprovalCard | null;
  emptyState?: React.ReactNode;
  onOpenNote?: (noteId: string) => void;
  activeTurnId?: string | null;
  cancelledTurnId?: string | null;
}) {
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

  const slack =
    pinSlackPx && pinStart === 0
      ? Math.max(0, pinSlackPx - THREAD_PAD_PX)
      : pinSlackPx;

  const isLive = stream.phase !== "idle" || stream.content !== null;
  if (messages.length === 0 && !isLive && !pendingUserMessage && emptyState) {
    return <div className="flex flex-1 flex-col gap-3">{emptyState}</div>;
  }

  const lastRow = rows.at(-1);
  const carried =
    lastRow?.kind === "steps" &&
    activeTurnId !== null &&
    lastRow.turnId === activeTurnId &&
    stream.turnId === activeTurnId &&
    stream.phase !== "idle" &&
    (stream.phase !== "awaiting_approval" || stream.blocks.length > 0)
      ? lastRow
      : null;

  const localAnswerLast =
    stream.phase === "done" && pendingUserMessage !== null;
  const lastAnswerIndex = localAnswerLast
    ? -1
    : rows.findLastIndex(
        (each) => each.kind === "message" && each.message.role === "ASSISTANT"
      );

  const row = (item: HistoryRow, index: number) =>
    item === carried ? null : (
      <Fragment key={`${item.at}-${index}`}>
        {dividers[index] ? <TimeDivider at={item.at} /> : null}
        {item.kind === "steps" ? (
          groupBlocks(item.blocks).map((group, at) =>
            group.kind === "approval" ? (
              <ResolvedApproval
                key={`approval-${group.approval.approvalId}`}
                group={group}
              />
            ) : group.kind === "steps" ? (
              <ChainOfThought
                key={`steps-${at}`}
                blocks={group.blocks}
                live={false}
                startedAt={item.startedAt}
                endedAt={item.endedAt}
                onOpenNote={onOpenNote}
              />
            ) : null
          )
        ) : (
          <HistoryMessage
            message={item.message}
            onOpenNote={onOpenNote}
            last={index === lastAnswerIndex}
            stopped={
              cancelledTurnId !== null &&
              item.message.turnId === cancelledTurnId
            }
          />
        )}
      </Fragment>
    );

  return (
    <div className="flex flex-1 flex-col gap-5">
      {rows.slice(0, pinStart).map(row)}

      <div
        data-testid="chat-pinned-turn"
        className={cn(
          "flex flex-col gap-5",
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

        <StreamBlocks
          stream={stream}
          carried={carried}
          startedAt={pendingUserAt ?? null}
          onOpenNote={onOpenNote}
        />
        <ThinkingLine
          stream={stream}
          pending={pendingUserMessage !== null}
          startedAt={pendingUserAt ?? null}
        />

        {approvalCard ? (
          <ApprovalCard
            card={approvalCard.card}
            summary={approvalCard.summary}
            status={approvalCard.status}
            onApprove={onApprove}
          />
        ) : null}

        {stream.phase === "done" ? (
          <div className="-mt-2.5 flex flex-col gap-2.5 empty:hidden">
            <StreamTail stream={stream} onOpenNote={onOpenNote} />
            {pendingUserMessage && pendingUserAt ? (
              <MessageActions
                content={stream.content ?? ""}
                at={pendingUserAt}
                pinned
              />
            ) : null}
          </div>
        ) : null}
        <StreamNotice stream={stream} />
      </div>
    </div>
  );
}

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
  last = false,
  stopped = false,
}: {
  message: ThreadMessage;
  onOpenNote?: (noteId: string) => void;
  last?: boolean;
  stopped?: boolean;
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
      <div className="group/msg flex flex-col gap-2.5">
        <AssistantText content={message.content} />
        {stopped ? <StoppedMark /> : null}
        <AnswerRefs refs={usableRefs(message.scope)} onOpenNote={onOpenNote} />
        <MessageActions
          content={message.content}
          at={message.createdAt}
          pinned={last}
        />
      </div>
    );
  }

  return null;
}

const COPIED_MS = 1600;

function MessageActions({
  content,
  at,
  pinned = false,
}: {
  content: string;
  at: string;
  pinned?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const locale = useLocale();
  const t = useTranslations("chat.thread");
  const tDates = useTranslations("dates");

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    void copyText(content)
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  return (
    <div
      data-testid="message-actions"
      data-pinned={pinned || undefined}
      className={cn(
        "-mt-1 -ml-2 flex h-8 items-center gap-1 text-[var(--el-muted)] pointer-coarse:h-11",
        pinned
          ? "opacity-100"
          : "opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
      )}
    >
      <ChatIconButton
        label={copied ? t("copied") : t("copy")}
        tooltipSide="bottom"
        onClick={copy}
        className="text-[var(--el-muted)]"
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      </ChatIconButton>
      <span className="text-xs tabular-nums">
        {relativeUpdatedAt(at, new Date(), tDates, locale)}
      </span>
      <span className="sr-only" aria-live="polite">
        {copied ? t("copiedAnnounce") : ""}
      </span>
    </div>
  );
}

type HistoryRow = { at: string } & (
  | {
      kind: "steps";
      turnId: string | null;
      blocks: StepBlock[];
      startedAt: string;
      endedAt: string;
    }
  | { kind: "message"; message: ThreadMessage }
);

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
      summary: null,
      card: parseApprovalCard(event.card),
      decision: event.decision,
    };
  }
  if (event.status) {
    return {
      kind: "tool",
      toolCallId: `history-${index}`,
      tool: event.tool,
      summary: message.content,
      target: historyTarget(message.scope),
      status: event.status,
      url: event.url,
    };
  }
  return null;
}

function groupHistory(
  messages: ThreadMessage[],
  activeTurnId: string | null
): HistoryRow[] {
  const rows: HistoryRow[] = [];
  let approvedCallId: string | null = null;
  messages.forEach((message, index) => {
    if (message.role === "TOOL" || message.role === "THINKING") {
      let step: StepBlock | null =
        message.role === "THINKING"
          ? ({ kind: "thinking", text: message.content } as const)
          : toStepBlock(message, index);
      if (!step) return;
      if (step.kind === "approval") {
        approvedCallId = step.decision === "APPROVED" ? step.toolCallId : null;
      } else if (step.kind === "tool" && approvedCallId) {
        step = { ...step, toolCallId: approvedCallId };
        approvedCallId = null;
      }
      const last = rows.at(-1);
      if (last?.kind === "steps") {
        last.endedAt = message.createdAt;
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
          startedAt:
            last?.kind === "message" && last.message.role === "USER"
              ? last.at
              : message.createdAt,
          turnId: message.turnId ?? null,
          blocks: [step],
          endedAt: message.createdAt,
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

function UserBubble({
  content,
  scope,
  onOpenNote,
}: {
  content: string;
  scope?: HistoryScope;
  onOpenNote?: (noteId: string) => void;
}) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] min-w-0 rounded-panel bg-[var(--el-surface-strong)] px-3.5 py-2.5 text-[14.5px] leading-[1.6] whitespace-pre-wrap text-[var(--el-ink)] [overflow-wrap:anywhere]">
        {withScopeChips(content, scope, onOpenNote)}
      </p>
    </div>
  );
}

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

function withScopeChips(
  content: string,
  scope?: HistoryScope,
  onOpenNote?: (noteId: string) => void
) {
  const living = livingScope(scope);
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

  const byLength = [...living].sort((a, b) => b.title.length - a.title.length);
  const pattern = new RegExp(
    `(${byLength.map((each) => escapeForRegExp(each.title)).join("|")})`,
    "g"
  );
  return content.split(pattern).map((part, index) => {
    const hit = byLength.find((each) => each.title === part);
    if (!hit) return part;
    return <ScopeChipMark key={index} kind={hit.kind} title={part} />;
  });
}

function ScopeChipMark({
  kind,
  title,
  onOpen,
}: {
  kind: "project" | "note";
  title: string;
  onOpen?: () => void;
}) {
  const t = useTranslations("chat.thread");
  const Icon = kind === "project" ? Folder : FileText;
  const inside = (
    <>
      <Icon aria-hidden className="size-3.5 shrink-0 self-start mt-[2px]" />
      <span>{title}</span>
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
      aria-label={t("openScope", { title })}
      className={scopeChipClass(kind, {
        extra: "cursor-pointer hover:brightness-95",
      })}
    >
      {inside}
    </button>
  );
}

function AssistantText({
  content,
  partial,
  streaming,
}: {
  content: string;
  partial?: boolean;
  streaming?: boolean;
}) {
  const shown = useSmoothText(content, Boolean(streaming));
  return (
    <div
      data-testid="assistant-message"
      data-streaming={streaming ? "true" : undefined}
      data-partial={partial ? "true" : undefined}
      className={cn(partial && "opacity-60")}
    >
      <Markdown
        content={shown}
        streaming={Boolean(streaming) || shown !== content}
      />
    </div>
  );
}

function ThinkingLine({
  stream,
  pending,
  startedAt,
}: {
  stream: ChatStreamState;
  pending: boolean;
  startedAt: string | null;
}) {
  const waiting =
    stream.phase === "streaming" || (stream.phase === "idle" && pending);
  if (!waiting || stream.blocks.length > 0) return null;
  return <PendingProgress startedAt={startedAt} />;
}

function StreamBlocks({
  stream,
  carried,
  startedAt,
  onOpenNote,
}: {
  stream: ChatStreamState;
  carried: { startedAt: string; blocks: StepBlock[] } | null;
  startedAt: string | null;
  onOpenNote?: (noteId: string) => void;
}) {
  const ended =
    stream.phase === "done" ||
    stream.phase === "failed" ||
    stream.phase === "cancelled";
  const blocks = carried
    ? [...carried.blocks, ...stream.blocks]
    : stream.blocks;
  const groups = groupBlocks(
    ended
      ? settleEndedTurn(blocks, stream.error?.code !== "STREAM_INTERRUPTED")
      : blocks
  );
  if (groups.length === 0) return null;

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
            startedAt={
              index === 0 ? (carried?.startedAt ?? startedAt) : undefined
            }
            live={
              (stream.phase === "streaming" ||
                stream.phase === "awaiting_approval") &&
              index === lastIndex
            }
            onOpenNote={onOpenNote}
          />
        ) : group.kind === "approval" ? (
          <ResolvedApproval
            key={`approval-${group.approval.approvalId}`}
            group={group}
          />
        ) : (
          <Fragment key={`text-${index}`}>
            <AssistantText
              content={group.text}
              partial={isPartial}
              streaming={stream.phase === "streaming" && index === lastIndex}
            />
            {stream.phase === "cancelled" && index === lastIndex ? (
              <StoppedMark />
            ) : null}
          </Fragment>
        )
      )}
    </>
  );
}

function StoppedMark() {
  const t = useTranslations("chat.thread");
  return (
    <p
      data-testid="answer-stopped"
      className="flex items-center gap-1.5 text-xs text-[var(--el-muted)]"
    >
      <Square aria-hidden className="size-2.5 fill-current" />
      {t("stopped")}
    </p>
  );
}

function ResolvedApproval({
  group,
}: {
  group: Extract<Group, { kind: "approval" }>;
}) {
  const { approval, tool } = group;
  return (
    <ApprovalCard
      card={approval.card}
      summary={approval.summary ?? tool?.summary ?? null}
      status={resolvedStatus(approval.decision, tool)}
    />
  );
}

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

function StreamNotice({ stream }: { stream: ChatStreamState }) {
  const t = useTranslations("chat");
  if (stream.phase === "failed") {
    const error = stream.error;
    const failure =
      `errors.turnFailures.${error?.code}` as "errors.turnFailures.INTERNAL_ERROR";
    return (
      <Notice
        title={t("thread.failedTitle")}
        description={
          !error
            ? t("thread.disconnected")
            : (error.message ??
              (t.has(failure) ? t(failure) : t("errors.noResponse")))
        }
      />
    );
  }
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
