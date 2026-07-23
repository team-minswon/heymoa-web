"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CirclePlay, Lock, PauseCircle, Send, Square } from "lucide-react";

import { ChatThread } from "@/components/chat/chat-thread";
import { usePersonalChat } from "@/components/chat/personal-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { errorCodeOf } from "@/lib/api/error-message";
// 승인 API는 공유·개인 공용 경로(`/v1/agent-chats/{chatId}/approvals/...`)라 agent-chat 모듈에 있다.
import { useResolveToolApproval } from "@/lib/api/generated/agent-chat/agent-chat";
import {
  getGetNoteSharedChatMessagesQueryOptions,
  getSendNoteSharedChatMessageUrl,
  useGetNoteSharedChatMessages,
} from "@/lib/api/generated/note-shared-chat/note-shared-chat";
import type { ApprovalDecision } from "@/lib/chat/stream-protocol";
import { initialStreamState } from "@/lib/chat/stream-protocol";
import { useChatStream } from "@/lib/chat/use-chat-stream";
import type { SharedChatPhase } from "@/lib/notes/meeting-state";

/** 이 코드로 실패한 승인은 카드가 죽은 것이다 — 다시 눌러도 같은 오류다 (심화는 APP-114). */
const TERMINAL_APPROVAL_CODES = new Set([
  "APPROVAL_NOT_FOUND",
  "MEETING_NOT_ACTIVE",
  "NOT_APPROVAL_OWNER",
]);

const POLL_INTERVAL_MS = 3_000;

/**
 * 노트 공유 챗봇. 개인 챗봇과 **같은 SSE 레이어**(`use-chat-stream`·`chat-thread`)를 쓰고,
 * 공유만의 것 — 회의 상태 게이트, 입력 잠금, 관전자 폴링 — 을 더한다.
 *
 * 관전자 판별은 이름이 아니라 **"내가 스트리밍 중인가"** 다. 내가 보내면 나는 스트림 위에
 * 있고, 안 보냈는데 `lock.locked`면 나는 관전자다 (계약: 스트림 수신은 입력자만).
 */
export function SharedChatPanel({
  noteId,
  phase,
  onTurnActiveChange,
}: {
  noteId: string;
  phase: SharedChatPhase;
  /** 한 턴(전송~스트림)이 도는 동안 참. 부모가 회의 종료로 이 패널을 언마운트하지 않게 한다. */
  onTurnActiveChange?: (active: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const stream = useChatStream();
  const personalChat = usePersonalChat();
  const [draft, setDraft] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [submittedApprovalId, setSubmittedApprovalId] = useState<string | null>(
    null
  );
  const [turnBaseline, setTurnBaseline] = useState(0);

  const isStreaming =
    stream.state.phase === "streaming" ||
    stream.state.phase === "awaiting_approval";

  // 회의가 흐를 때만, 내가 보내는 중이 아닐 때만 폴링한다. 내 스트림이 진실의 출처인 동안
  // 폴링이 낡은 히스토리로 덮으면 흐르는 답변이 깜빡인다.
  const messagesQuery = useGetNoteSharedChatMessages(noteId, {
    query: {
      enabled: !isSending,
      refetchInterval:
        phase === "active" && !isStreaming && !isSending ? POLL_INTERVAL_MS : false,
    },
  });
  const response = messagesQuery.data;
  const ok = response?.status === 200 && response.data.success;
  const data = ok ? response.data.data : null;
  const messages = data?.messages ?? [];
  const lock = data?.lock ?? null;
  const chatId = data?.chatId ?? null;
  // 관전자는 스트림을 못 받으므로 승인 대기를 이 폴링 필드로만 안다 (계약). 없으면 그냥 입력 중.
  const pendingApproval = lock?.pendingApproval ?? null;

  // 내가 스트리밍 중이 아닌데 잠금이 있으면 관전자다 — 다른 멤버가 입력 중이다.
  const isSpectator = !isSending && !isStreaming && Boolean(lock?.locked);

  const isLoading = messagesQuery.isLoading;

  /**
   * 주 데이터(히스토리)를 못 읽은 상태. 빈 배열로 접으면 잠금·대화 상태를 모른 채
   * "대화 없음"으로 보이고 전송까지 열린다 — 화면과 실제가 어긋난다. 전송을 정지 중에
   * 낡은 에러가 남을 수 있어 그때는 제외한다.
   */
  const isUnavailable =
    !isSending && (messagesQuery.isError || (response !== undefined && !ok));

  const resolveApproval = useResolveToolApproval();

  const canSend = phase === "active" && !isSpectator && !isUnavailable;
  const isBusy = isSending || isLoading || isUnavailable;

  /**
   * 히스토리가 방금 끝난 턴을 이미 담고 있는가. 즉시 반영이 실패해 로컬 사본을 남겨 둔 뒤
   * 히스토리가 스스로(폴링) 성공하면 같은 턴이 두 벌 그려진다 — 그때는 로컬 사본을 가린다.
   */
  const isTurnReconciled =
    ok &&
    stream.state.phase === "idle" &&
    stream.state.content !== null &&
    messages
      .slice(turnBaseline)
      .some(
        (message) =>
          message.role === "ASSISTANT" &&
          message.content === stream.state.content
      );

  /**
   * 폴링한 히스토리가 이번 턴의 USER 메시지를 이미 담고 있는가. 서버·목은 `message_end`가
   * 없어도 USER 메시지를 저장하므로, 실패·정지·중단 뒤 폴링이 그것을 올리면 로컬
   * `pendingUserMessage`와 겹쳐 유저 버블이 두 벌 남는다 — 그때는 로컬 사본을 가린다.
   */
  const isPendingReconciled =
    pendingUserMessage !== null &&
    ok &&
    messages
      .slice(turnBaseline)
      .some(
        (message) =>
          message.role === "USER" && message.content === pendingUserMessage
      );

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || !canSend || isBusy) return;
      setIsSending(true);
      try {
        setDraft("");
        setTurnBaseline(messages.length);
        setPendingUserMessage(message);
        setLastSent(message);
        const final = await stream.send(getSendNoteSharedChatMessageUrl(noteId), {
          message,
        });
        // 정상 종료가 아니면(실패·정지·중단) 스트림 상태가 스레드 안에 안내를 그린다.
        if (final?.phase !== "idle") return;

        // server가 tee한 기록을 다시 읽은 뒤에 스트림을 비운다 — 그래야 말풍선이 잠깐
        // 사라지지 않는다. 진행 중인 조회를 먼저 취소한다(폴링이 이 턴 없는 응답을 합칠 수 있다).
        const options = getGetNoteSharedChatMessagesQueryOptions(noteId);
        await queryClient.cancelQueries({ queryKey: options.queryKey });
        const refreshed = await queryClient
          .fetchQuery({ ...options, staleTime: 0 })
          .catch(() => null);
        if (refreshed?.status !== 200 || !refreshed.data.success) return;
        setPendingUserMessage(null);
        stream.reset();
      } finally {
        setIsSending(false);
      }
    },
    [canSend, isBusy, messages.length, noteId, queryClient, stream]
  );

  const approve = useCallback(
    (decision: ApprovalDecision) => {
      const approvalId = stream.state.pendingApproval?.approvalId;
      if (!approvalId || !chatId) return;
      // 204는 접수일 뿐 — 확정은 스트림의 tool_approval_resolved가 한다. 그때까지 잠근다.
      setSubmittedApprovalId(approvalId);
      resolveApproval.mutate(
        { chatId, approvalId, data: { decision } },
        {
          onError: (error: unknown) => {
            const code = errorCodeOf(error);
            if (code && TERMINAL_APPROVAL_CODES.has(code)) return;
            setSubmittedApprovalId(null);
          },
        }
      );
    },
    [chatId, resolveApproval, stream.state.pendingApproval]
  );

  // 새 내용은 아래로 쌓인다. 유저가 위를 읽고 있을 때 끌어내리지 않도록 바닥 근처일 때만 따라간다.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const tail = `${messages.length}:${pendingUserMessage ?? ""}:${stream.state.text}:${stream.state.records.length}`;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // scroll 이벤트는 버블링하지 않아 부모에 onScroll을 걸 수 없다.
    const onScroll = () => {
      stickToBottomRef.current =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 48;
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !stickToBottomRef.current) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [tail]);

  // 한 턴이 도는 동안 부모에게 알린다 — 회의가 종료돼도 이 패널을 언마운트해 스트림을 끊지
  // 않게 (계약상 부분 응답은 저장되지 않아 답변이 통째로 사라진다). 언마운트 시엔 false.
  const turnActive = isSending || isStreaming;
  useEffect(() => {
    onTurnActiveChange?.(turnActive);
  }, [turnActive, onTurnActiveChange]);
  useEffect(() => () => onTurnActiveChange?.(false), [onTurnActiveChange]);

  const lockedByLabel = lock?.lockedBy ?? "다른 멤버";

  return (
    <aside
      data-testid="shared-chat-panel"
      aria-label="회의 챗봇"
      className="flex h-full min-h-0 w-full flex-col bg-white lg:border-l lg:border-[var(--el-hairline)]"
    >
      <header className="border-b border-[var(--el-hairline)] px-5 py-4">
        <p className="text-[11px] tracking-wide text-[var(--el-muted)] uppercase">
          회의 챗봇
        </p>
        <p className="truncate text-sm font-medium text-[var(--el-ink)]">
          이 회의에 대해 물어보세요
        </p>
      </header>

      <ScrollArea className="flex-1" viewportRef={viewportRef}>
        <div className="flex min-h-full flex-col justify-end p-5">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : isUnavailable ? (
            // 주 데이터를 못 읽었다 — 빈 상태로 그리면 있는 대화를 없는 것처럼 보인다.
            <div role="alert" className="space-y-2">
              <p className="text-sm text-[var(--el-ink)]">
                대화를 불러오지 못했습니다.
              </p>
              <p className="text-xs text-[var(--el-muted)]">
                이어서 보내면 화면과 실제 대화가 어긋나므로 전송을 막아 둡니다.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-[30px]"
                onClick={() => void messagesQuery.refetch()}
              >
                다시 시도
              </Button>
            </div>
          ) : (
            <>
              <ChatThread
                messages={messages}
                stream={isTurnReconciled ? initialStreamState : stream.state}
                pendingUserMessage={
                  isTurnReconciled || isPendingReconciled ? null : pendingUserMessage
                }
                isRetryDisabled={isBusy || !lastSent || !canSend}
                onRetry={() => {
                  if (isBusy || !lastSent || !canSend) return;
                  stream.reset();
                  void send(lastSent);
                }}
                onApprove={approve}
                isApprovalPending={
                  resolveApproval.isPending ||
                  submittedApprovalId === stream.state.pendingApproval?.approvalId
                }
                emptyState={
                  phase === "not-started" ? (
                    <p className="text-sm text-[var(--el-muted)]">
                      녹음을 시작하면 이 회의에 대해 물어볼 수 있습니다.
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--el-muted)]">
                      아직 나눈 대화가 없습니다.
                    </p>
                  )
                }
              />
              {isSpectator ? (
                <p
                  data-testid="typing-divider"
                  className="mt-4 text-center text-xs text-[var(--el-muted)]"
                >
                  {pendingApproval
                    ? `${lockedByLabel}님이 승인 대기 중 · 완료되면 여기에 올라옵니다`
                    : `${lockedByLabel}님이 입력 중 · 응답이 끝나면 여기에 올라옵니다`}
                </p>
              ) : null}
            </>
          )}
        </div>
      </ScrollArea>

      <Composer
        phase={phase}
        isSpectator={isSpectator}
        pendingApproval={pendingApproval}
        lockedByLabel={lockedByLabel}
        draft={draft}
        onDraftChange={setDraft}
        isBusy={isBusy}
        isStreaming={isStreaming}
        onSubmit={() => void send(draft)}
        onStop={stream.stop}
        onOpenPersonal={personalChat.open}
      />
    </aside>
  );
}

function Composer({
  phase,
  isSpectator,
  pendingApproval,
  lockedByLabel,
  draft,
  onDraftChange,
  isBusy,
  isStreaming,
  onSubmit,
  onStop,
  onOpenPersonal,
}: {
  phase: SharedChatPhase;
  isSpectator: boolean;
  /** 관전자가 폴링으로 보는 승인 대기 (없으면 그냥 입력 중). */
  pendingApproval: { tool: string; summary: string | null } | null;
  lockedByLabel: string;
  draft: string;
  onDraftChange: (value: string) => void;
  isBusy: boolean;
  isStreaming: boolean;
  onSubmit: () => void;
  onStop: () => void;
  onOpenPersonal: () => void;
}) {
  // 지속 상태(중지·관전·미시작)는 인라인 Alert다 — 토스트로 하면 왜 못 쓰는지 사라진다.
  if (phase === "paused") {
    return (
      <ComposerNotice
        icon={<PauseCircle className="size-4 text-[var(--el-muted)]" />}
        title="회의가 중지되어 있습니다"
        description="중지 중에는 개인 챗봇을 이용하세요."
        action={
          <Button variant="outline" size="sm" className="h-[30px]" onClick={onOpenPersonal}>
            개인 챗봇 열기
          </Button>
        }
      />
    );
  }

  if (phase === "not-started") {
    return (
      <ComposerNotice
        icon={<CirclePlay className="size-4 text-[var(--el-muted)]" />}
        title="아직 회의가 시작되지 않았습니다"
        description="아래 녹음을 시작하면 공유 챗봇을 쓸 수 있습니다."
      />
    );
  }

  if (isSpectator) {
    // 승인 대기 중이면 "입력 중"이 아니라 그 사실을 보인다 — 관전자에겐 이 폴링 필드가 전부다.
    const waiting = pendingApproval !== null;
    return (
      <ComposerNotice
        icon={<Lock className="size-4 text-[var(--el-muted)]" />}
        title={`${lockedByLabel}님이 ${waiting ? "승인 대기 중" : "입력 중"}`}
        description={
          waiting
            ? (pendingApproval.summary ??
              `${pendingApproval.tool} 실행을 검토하고 있습니다.`)
            : "입력을 마칠 때까지 기다려 주세요."
        }
        input={
          <Input
            value=""
            disabled
            aria-label="메시지"
            placeholder={
              waiting
                ? `${lockedByLabel}님이 승인을 마칠 때까지 기다려 주세요`
                : `${lockedByLabel}님이 입력을 마칠 때까지 기다려 주세요`
            }
          />
        }
      />
    );
  }

  return (
    <form
      className="border-t border-[var(--el-hairline)] px-5 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          disabled={isBusy}
          placeholder="이 회의에 대해 물어보세요"
          aria-label="메시지"
        />
        {isStreaming ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="중지"
            onClick={onStop}
          >
            <Square className="size-3.5" />
          </Button>
        ) : (
          <Button type="submit" size="icon" aria-label="보내기" disabled={isBusy}>
            <Send className="size-4" />
          </Button>
        )}
      </div>
    </form>
  );
}

function ComposerNotice({
  icon,
  title,
  description,
  action,
  input,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  input?: React.ReactNode;
}) {
  return (
    <div className="border-t border-[var(--el-hairline)] px-5 py-4">
      <div
        role="alert"
        className="rounded-2xl border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-3.5"
      >
        <div className="flex gap-2.5">
          <span className="mt-0.5 shrink-0">{icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--el-ink)]">{title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--el-muted)]">
              {description}
            </p>
            {action ? <div className="mt-2.5">{action}</div> : null}
          </div>
        </div>
      </div>
      {input ? <div className="mt-2.5">{input}</div> : null}
    </div>
  );
}
