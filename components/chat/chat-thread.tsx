"use client";

import { AlertTriangle, ExternalLink, PauseCircle, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  AgentChatMessagesResponseDataMessagesItem,
  NoteSharedChatResponseDataMessagesItem,
} from "@/lib/api/generated/models";
import type {
  ApprovalDecision,
  ChatStreamState,
  LiveToolRecord,
} from "@/lib/chat/stream-protocol";
import type { ApprovalCard, ApprovalCardState } from "@/lib/chat/use-tool-approval";

/**
 * 개인·공유 챗봇이 같은 스레드 컴포넌트를 쓴다. 공유 메시지는 USER에 `authorName`(멀티멤버)이
 * 붙고 개인 메시지에는 없다 — 둘 다 받아 공통 필드로 렌더하고 이름은 있을 때만 보인다.
 */
export type ThreadMessage =
  | AgentChatMessagesResponseDataMessagesItem
  | NoteSharedChatResponseDataMessagesItem;

function authorOf(message: ThreadMessage): string | null {
  return "authorName" in message ? (message.authorName ?? null) : null;
}

/**
 * 채팅 한 스레드. 개인·공유 챗봇이 같은 이벤트 계약을 쓰므로 이 컴포넌트는 어느 쪽인지 모른다 —
 * 히스토리 배열과 진행 중 스트림 상태만 받는다.
 */
export function ChatThread({
  messages,
  stream,
  pendingUserMessage,
  onRetry,
  isRetryDisabled,
  onApprove,
  approvalCard,
  emptyState,
}: {
  messages: ThreadMessage[];
  stream: ChatStreamState;
  /** 방금 보냈지만 아직 히스토리에 없는 유저 메시지. */
  pendingUserMessage: string | null;
  onRetry: () => void;
  /** 앞 전송이 아직 정리되지 않았으면 재전송을 막는다. */
  isRetryDisabled?: boolean;
  onApprove: (decision: ApprovalDecision) => void;
  /** 훅이 소유하는 승인 카드. pending이 사라진 뒤에도 무효화 카드를 남기려고 stream이 아니라 이걸 그린다. */
  approvalCard?: ApprovalCard | null;
  emptyState?: React.ReactNode;
}) {
  const isLive = stream.phase !== "idle" || stream.content !== null;
  if (messages.length === 0 && !isLive && !pendingUserMessage && emptyState) {
    return <div className="flex flex-1 flex-col justify-end gap-3">{emptyState}</div>;
  }

  return (
    <div className="flex flex-1 flex-col justify-end gap-4">
      {messages.map((message, index) => (
        <HistoryMessage key={`${message.createdAt}-${index}`} message={message} />
      ))}

      {pendingUserMessage ? <UserBubble content={pendingUserMessage} /> : null}

      {stream.records.map((record) => (
        <ToolRecord key={recordKey(record)} record={record} />
      ))}

      {approvalCard ? (
        <ApprovalPrompt
          summary={approvalCard.summary ?? `${approvalCard.tool} 실행`}
          tool={approvalCard.tool}
          state={approvalCard.state}
          onApprove={onApprove}
        />
      ) : null}

      <StreamText stream={stream} />
      <StreamNotice
        stream={stream}
        onRetry={onRetry}
        isRetryDisabled={isRetryDisabled}
      />
    </div>
  );
}

function recordKey(record: LiveToolRecord) {
  return record.kind === "approval"
    ? `approval-${record.approvalId}`
    : `call-${record.toolCallId}`;
}

function HistoryMessage({ message }: { message: ThreadMessage }) {
  if (message.role === "USER")
    return <UserBubble content={message.content} author={authorOf(message)} />;
  if (message.role === "ASSISTANT") {
    return <AssistantText content={message.content} />;
  }

  // TOOL은 승인 기록(decision)과 실행 기록(status) 두 종류이고 계약상 배타다.
  // 한쪽만 검사하고 나머지를 떨어뜨리면 계약 밖 형태가 반대쪽으로 새어 든다.
  const event = message.toolEvent;
  if (event?.decision) {
    return (
      <ApprovalRecordRow
        label={message.content}
        tool={event.tool}
        decision={event.decision}
      />
    );
  }
  if (event?.status) {
    return (
      <CallRecordCard
        label={message.content}
        tool={event.tool}
        status={event.status}
        url={event.url}
      />
    );
  }
  return null;
}

function UserBubble({
  content,
  author,
}: {
  content: string;
  author?: string | null;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      {author ? (
        <p className="px-1 text-xs font-medium text-[var(--el-muted)]">
          {author}
        </p>
      ) : null}
      <p className="max-w-[85%] rounded-2xl bg-[var(--el-surface-strong)] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-[var(--el-ink)]">
        {content}
      </p>
    </div>
  );
}

function AssistantText({
  content,
  partial,
  cursor,
}: {
  content: string;
  partial?: boolean;
  cursor?: boolean;
}) {
  return (
    <p
      data-partial={partial ? "true" : undefined}
      className={
        partial
          ? "text-sm leading-[1.65] whitespace-pre-wrap text-[var(--el-muted-soft)]"
          : "text-sm leading-[1.65] whitespace-pre-wrap text-[var(--el-body)]"
      }
    >
      {content}
      {cursor ? (
        <span
          data-stream="cursor"
          aria-hidden
          className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-[var(--el-ink)]"
        />
      ) : null}
    </p>
  );
}

function StreamText({ stream }: { stream: ChatStreamState }) {
  // error는 부분 응답을 저장하지 않는다 — 반쯤 쓰인 말풍선을 남기면 없는 글이 남는다.
  if (stream.phase === "failed") return null;
  if (!stream.text) return null;
  const isPartial = stream.phase === "stalled" || stream.phase === "aborted";
  return (
    <AssistantText
      content={stream.text}
      partial={isPartial}
      cursor={stream.phase === "streaming"}
    />
  );
}

function StreamNotice({
  stream,
  onRetry,
  isRetryDisabled,
}: {
  stream: ChatStreamState;
  onRetry: () => void;
  isRetryDisabled?: boolean;
}) {
  if (stream.phase === "failed") {
    return (
      <Notice
        tone="error"
        title="응답을 만들지 못했습니다"
        description={
          stream.error?.message ??
          "부분 응답은 저장되지 않았습니다. 다시 보내 주세요."
        }
        onRetry={onRetry}
        isRetryDisabled={isRetryDisabled}
      />
    );
  }
  if (stream.phase === "stalled") {
    return (
      <Notice
        tone="neutral"
        title="응답이 중간에 끊겼습니다"
        description="다시 시도하면 위 조각은 버려집니다."
        onRetry={onRetry}
        isRetryDisabled={isRetryDisabled}
      />
    );
  }
  if (stream.phase === "aborted") {
    return (
      <div className="flex justify-start">
        <Button
          variant="outline"
          size="sm"
          className="h-[30px]"
          disabled={isRetryDisabled}
          onClick={onRetry}
        >
          다시 보내기
        </Button>
      </div>
    );
  }
  return null;
}

function Notice({
  tone,
  title,
  description,
  onRetry,
  isRetryDisabled,
}: {
  tone: "error" | "neutral";
  title: string;
  description: string;
  onRetry: () => void;
  isRetryDisabled?: boolean;
}) {
  const isError = tone === "error";
  const Icon = isError ? AlertTriangle : PauseCircle;
  return (
    <div
      role="alert"
      className={
        isError
          ? "rounded-2xl border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] p-3.5"
          : "rounded-2xl border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-3.5"
      }
    >
      <div className="flex gap-2.5">
        <Icon
          className={
            isError
              ? "mt-0.5 size-4 shrink-0 text-[var(--el-error)]"
              : "mt-0.5 size-4 shrink-0 text-[var(--el-muted)]"
          }
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--el-ink)]">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--el-muted)]">
            {description}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2.5 h-[30px]"
            disabled={isRetryDisabled}
            onClick={onRetry}
          >
            다시 보내기
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToolRecord({ record }: { record: LiveToolRecord }) {
  if (record.kind === "approval") {
    // 확정 전에는 승인 카드가 따로 서 있다 — 기록은 결정이 온 뒤에만 남는다.
    if (!record.decision) return null;
    return (
      <ApprovalRecordRow
        label={record.decision === "APPROVED" ? "승인함" : "거절함"}
        tool={record.tool}
        decision={record.decision}
      />
    );
  }
  return (
    <CallRecordCard
      label={record.summary ?? record.tool}
      tool={record.tool}
      status={record.status}
      url={record.url}
    />
  );
}

function ApprovalRecordRow({
  label,
  tool,
  decision,
}: {
  label: string;
  tool: string;
  decision: ApprovalDecision;
}) {
  return (
    <div
      data-record="approval"
      className="border-l-2 border-[var(--el-hairline-strong)] pl-3"
    >
      <p className="text-xs font-medium text-[var(--el-body-strong)]">{label}</p>
      <p className="mt-0.5 text-xs text-[var(--el-muted)]">
        {tool}
        {decision === "REJECTED"
          ? " · 실행 기록 없음 — 도구는 실행되지 않았습니다"
          : null}
      </p>
    </div>
  );
}

function CallRecordCard({
  label,
  tool,
  status,
  url,
}: {
  label: string;
  tool: string;
  status: "success" | "error" | null;
  url: string | null;
}) {
  return (
    <div
      data-record="call"
      className={
        status === "error"
          ? "rounded-2xl border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.04] p-3"
          : "rounded-2xl border border-[var(--el-hairline)] bg-white p-3"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-[var(--el-body-strong)]">
          {tool}
        </p>
        <Badge variant={status === "error" ? "destructive" : "secondary"}>
          {status === "error" ? "실패" : status === "success" ? "완료" : "실행 중"}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-[var(--el-muted)]">{label}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--el-ink)] underline underline-offset-2"
        >
          열어 보기
          <ExternalLink className="size-3" />
        </a>
      ) : null}
    </div>
  );
}

function ApprovalPrompt({
  summary,
  tool,
  state,
  onApprove,
}: {
  summary: string;
  tool: string;
  state: ApprovalCardState;
  onApprove: (decision: ApprovalDecision) => void;
}) {
  const invalidated = state.kind === "invalidated";
  const submitted = state.kind === "submitted";
  return (
    <div className="rounded-2xl border border-[var(--el-hairline)] bg-white p-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <p
          className={
            invalidated
              ? "truncate text-xs font-medium text-[var(--el-muted)]"
              : "truncate text-xs font-medium text-[var(--el-body-strong)]"
          }
        >
          {tool}
        </p>
        <Badge variant="outline">쓰기 도구</Badge>
      </div>
      <p
        className={
          invalidated
            ? "mt-1.5 text-sm leading-relaxed text-[var(--el-muted)]"
            : "mt-1.5 text-sm leading-relaxed text-[var(--el-ink)]"
        }
      >
        {summary}
      </p>

      {invalidated ? (
        // 카드가 죽었다 — 버튼을 지우고 사유를 남긴다. 스트림은 정상 종료돼 컴포저는 다시 열린다.
        <div
          data-approval="invalidated"
          className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] p-2.5"
        >
          <XCircle className="mt-0.5 size-4 shrink-0 text-[var(--el-error)]" />
          <p className="text-xs leading-relaxed text-[var(--el-body)]">
            {state.reason}
          </p>
        </div>
      ) : (
        <>
          {/* 204는 접수일 뿐 낙관적으로 뒤집지 않는다 — submitted면 버튼을 흐리게 잠근다. */}
          <div
            className={submitted ? "mt-3 flex gap-2 opacity-40" : "mt-3 flex gap-2"}
          >
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
              : "응답이 없으면 5분 뒤 자동으로 거절 처리됩니다."}
          </p>
        </>
      )}
    </div>
  );
}
