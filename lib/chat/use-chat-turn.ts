"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  getGetAgentChatMessagesQueryOptions,
  getAgentChats,
  getGetAgentChatsQueryKey,
  useCancelAgentChatTurn,
  useCreateAgentChat,
  useGetAgentChatMessages,
  useGetAgentChats,
  useResolveToolApproval,
  useSendAgentChatMessage,
} from "@/lib/api/generated/agent-chat/agent-chat";
import type { AgentChatsResponseDataChatsItem } from "@/lib/api/generated/models";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { isAuthError } from "@/lib/api/fetcher";
import { toast } from "@/lib/ui/toast";
import {
  type ApprovalDecision,
  resolveApproval as recordDecision,
} from "@/lib/chat/blocks";
import { runningLabel } from "@/lib/chat/chat-list";
import type { ScopeChip } from "@/lib/chat/scope-chip";
import {
  failedTurnState,
  resumedState,
  startedState,
  toolArgs,
} from "@/lib/chat/stream-protocol";
import {
  echoesSent,
  freezeTurnTime,
  isTurnReconciled,
  partialAnswerOf,
  visibleTurnMessages,
} from "@/lib/chat/turn-messages";
import { useChatStream } from "@/lib/chat/use-chat-stream";
import { useToolApproval } from "@/lib/chat/use-tool-approval";

/**
 * 목록 폴링 간격. 근거 있는 값이 아니다. 정하는 것은 남의 턴을 늦어도 언제 알아채나뿐이다 —
 * 열린 대화는 SSE 가 즉시 말하고, 어긋나면 `runningLabel` 이 `turnId` 로 맞춘다.
 */
const CHAT_LIST_POLL_MS = 5_000;

/** 「이전 대화 더 보기」 한 번에 읽는 수. */
const CHAT_PAGE_SIZE = 30;

const uniqueIds = (scope: ScopeChip[], kind: ScopeChip["kind"]) => [
  ...new Set(scope.filter((chip) => chip.kind === kind).map((chip) => chip.id)),
];

/**
 * 개인 챗봇 한 워크스페이스의 대화 선택과 턴 수명(전송·이어받기·재동기·중지). 화면과 컴포저는
 * 모른다 — 문장을 되돌리는 것은 `send()` 가 `false` 를 돌려줄 때 부르는 쪽이 한다.
 *
 * 대화는 클라이언트가 고른다. 방금 만든 대화, 목록에서 고른 대화, 그 밖에는 목록 첫 줄(마지막에
 * 쓴 대화) 순이다. ＋ 는 서버를 안 부르고(`isDraftChat`) 대화는 첫 전송이 만든다 — 아무 말 없이
 * 나간 빈 대화가 기록에 쌓이지 않는다.
 */
export function useChatTurn({
  workspaceId,
  onTurnActiveChange,
}: {
  workspaceId: string;
  /** 턴이 도는 동안 참. 그 사이 패널을 치우면 중지·승인에 닿을 길을 잃는다. */
  onTurnActiveChange: (active: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const stream = useChatStream();
  const isStreaming =
    stream.state.phase === "streaming" ||
    stream.state.phase === "awaiting_approval";
  const [createdChatId, setCreatedChatId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isDraftChat, setIsDraftChat] = useState(false);
  /** 방금 보낸 질문과 범위. 히스토리가 받아 줄 때까지 낙관적 말풍선으로 선다. */
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(
    null
  );
  const [pendingScope, setPendingScope] = useState<ScopeChip[]>([]);
  /**
   * 그 질문을 보낸 시각. 서버 `createdAt` 을 기다리면 답이 히스토리로 넘어가는 순간 구분선이 끼어든다.
   * `pendingUserMessage` 와 함께 비우지 않는다 — 비우면 `isTurnReconciled` 로 가리는 한 프레임
   * 동안 구분선만 먼저 사라진다.
   */
  const [pendingUserAt, setPendingUserAt] = useState<string | null>(null);
  /** 세션 생성 → 스트림 → 히스토리 반영까지 한 전송 전체가 진행 중. */
  const [isSending, setIsSending] = useState(false);
  /** 이 턴을 시작할 때의 히스토리 길이. 뒤에 붙은 것만 이 턴으로 본다. */
  const [turnBaseline, setTurnBaseline] = useState(0);

  const chatsQuery = useGetAgentChats(workspaceId, undefined, {
    query: { refetchInterval: CHAT_LIST_POLL_MS },
  });
  const chatsResponse = chatsQuery.data;
  const chatsOk = chatsResponse?.status === 200 && chatsResponse.data.success;
  const chats = useMemo(
    () => (chatsOk ? chatsResponse.data.data.chats : []),
    [chatsOk, chatsResponse]
  );

  /**
   * **첫 쪽(최근 50개)만 폴링하고, 그 뒤 대화는 「더 보기」로 한 번씩 읽어 붙인다** (APP-1020). 옛 대화의
   * 제목·진행 배지는 5초마다 다시 읽을 값이 아니다 — 옛 대화에 이어 쓰면 그 대화가 첫 쪽으로 올라와
   * 첫 쪽이 알려 준다. 워크스페이스를 바꾸면 붙여 둔 것을 버린다.
   */
  const [older, setOlder] = useState<{
    workspaceId: string;
    chats: AgentChatsResponseDataChatsItem[];
    /** `undefined` 면 아직 안 읽었다(첫 쪽의 커서를 쓴다). `null` 이면 끝까지 읽었다. */
    cursor: { afterUpdatedAt: string; afterChatId: string } | null | undefined;
  }>({ workspaceId, chats: [], cursor: undefined });
  const [isLoadingMoreChats, setIsLoadingMoreChats] = useState(false);
  const olderHere =
    older.workspaceId === workspaceId
      ? older
      : { workspaceId, chats: [], cursor: undefined };
  const firstPage = chatsOk ? chatsResponse.data.data : null;
  const nextCursor = useMemo(() => {
    if (olderHere.cursor !== undefined) return olderHere.cursor;
    return firstPage?.hasMore && firstPage.nextUpdatedAt && firstPage.nextChatId
      ? {
          afterUpdatedAt: firstPage.nextUpdatedAt,
          afterChatId: firstPage.nextChatId,
        }
      : null;
  }, [firstPage, olderHere.cursor]);
  const hasMoreChats = nextCursor !== null;
  const loadMoreChats = useCallback(async () => {
    if (!nextCursor || isLoadingMoreChats) return;
    setIsLoadingMoreChats(true);
    try {
      const response = await getAgentChats(workspaceId, {
        limit: String(CHAT_PAGE_SIZE),
        ...nextCursor,
      });
      if (response.status !== 200 || !response.data.success) {
        toast.error("이전 대화를 더 불러오지 못했습니다.");
        return;
      }
      const page = response.data.data;
      setOlder({
        workspaceId,
        chats: [...olderHere.chats, ...page.chats],
        cursor:
          page.hasMore && page.nextUpdatedAt && page.nextChatId
            ? {
                afterUpdatedAt: page.nextUpdatedAt,
                afterChatId: page.nextChatId,
              }
            : null,
      });
    } catch {
      toast.error("이전 대화를 더 불러오지 못했습니다.");
    } finally {
      setIsLoadingMoreChats(false);
    }
  }, [isLoadingMoreChats, nextCursor, olderHere.chats, workspaceId]);
  /** 빈 목록과 조회 실패는 다르다. 실패를 빈 목록으로 접으면 이미 있는 대화 옆에 하나를 더 만든다. */
  const isChatsUnavailable =
    chatsQuery.isError || (chatsResponse !== undefined && !chatsOk);

  const sessionId =
    createdChatId ??
    selectedChatId ??
    (isDraftChat ? null : (chats[0]?.chatId ?? null));

  // 턴이 도는 동안(승인 대기 포함)에는 켜지 않는다. server 가 USER 행을 스트림 전에 저장해서, 켜면
  // 그 행이 낙관적 말풍선과 겹쳐 두 벌이 되고 흐르는 스레드를 스켈레톤이 덮는다.
  const messagesQuery = useGetAgentChatMessages(sessionId ?? "", {
    query: { enabled: Boolean(sessionId) && !isSending && !isStreaming },
  });
  const messagesResponse = messagesQuery.data;
  const messagesOk =
    messagesResponse?.status === 200 && messagesResponse.data.success;
  const history = messagesOk ? messagesResponse.data.data : null;
  const messages = useMemo(() => history?.messages ?? [], [history]);
  const activeTurn = history?.activeTurn ?? null;
  const lastTurn = history?.lastTurn ?? null;
  const cursor = history?.cursor ?? null;
  const partialAnswer = useMemo(
    () => partialAnswerOf(messages, activeTurn?.turnId, cursor),
    [activeTurn?.turnId, cursor, messages]
  );

  /** 세션이 없다(404)는 막다른 길이 아니라 빈 대화다. 새로 만들면 되므로 잠그지 않는다. */
  const isSessionGone =
    Boolean(sessionId) &&
    errorCodeOf(messagesQuery.error) === "AGENT_CHAT_NOT_FOUND";
  /** 있는 대화의 히스토리를 못 읽었다. 빈 대화로 접고 보내면 화면과 서버가 어긋난다. */
  const isHistoryUnavailable =
    Boolean(sessionId) &&
    !isSessionGone &&
    (messagesQuery.isError || (messagesResponse !== undefined && !messagesOk));
  const isUnavailable = isChatsUnavailable || isHistoryUnavailable;

  const showingLocalTurn =
    stream.state.phase === "done" && pendingUserMessage !== null;
  const reconciled =
    messagesOk &&
    isTurnReconciled({
      messages,
      stream: stream.state,
      baseline: turnBaseline,
      showingLocalTurn,
    });

  // `isPending` 은 enabled:false 쿼리도 참이라 대화가 없을 때 스켈레톤이 안 걷힌다
  const isLoading = chatsQuery.isLoading || messagesQuery.isLoading;
  const createChat = useCreateAgentChat();

  /**
   * 전송을 막는 상태. 전부 「지금 보내면 엉뚱한 대화에 닿는다」다. `isStreaming` 은 이어받은 턴을,
   * 마지막 줄은 남(다른 탭·새로고침 전)이 시작한 턴을 본다 — 안 잠그면 겹쳐 보낸 메시지가 409 를
   * 받는다. 이 탭이 이미 그 턴을 그리고 있으면 `turnId` 가 같아 다시 잠그지 않는다.
   */
  const isBusy =
    isSending ||
    createChat.isPending ||
    isLoading ||
    isUnavailable ||
    isStreaming ||
    Boolean(activeTurn && activeTurn.turnId !== stream.state.turnId);

  /**
   * 대화를 갈아 끼울 수 없는 상태. `isBusy` 보다 좁다 — 답이 흐르는 중에도 다른 대화를 열 수 있어야
   * 한다. 대화 생성 중에 고르면 끝난 `ensureSession()` 이 방금 고른 대화를 덮는다.
   */
  const isSwitchBlocked = isLoading || isUnavailable || createChat.isPending;

  // 409 는 오류가 아니라 이어받기 신호라 전역 토스트를 끄고 `send()` 가 코드로 갈라 띄운다
  const sendMessage = useSendAgentChatMessage({
    mutation: { meta: { suppressErrorToast: true } },
  });
  // 승인 실패는 카드가 인라인으로 그린다
  const resolveApprovalMutation = useResolveToolApproval({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const cancelTurn = useCancelAgentChatTurn();

  const ensureSession = useCallback(async () => {
    if (sessionId && !isSessionGone) {
      // 목록 첫 줄을 보고 보냈어도 고정한다. 폴링으로 첫 줄이 바뀌어도 이 턴이 딴 대화에 붙지 않게
      setSelectedChatId(sessionId);
      return sessionId;
    }
    // 조회가 실패한 채 만들면 이미 있는 대화 위에 하나를 더 얹는다
    if (isChatsUnavailable) return null;
    const created = await createChat.mutateAsync({ workspaceId, data: {} });
    if (created.status !== 201 || !created.data.success) return null;
    const chatId = created.data.data.chatId;
    setCreatedChatId(chatId);
    setIsDraftChat(false);
    // 목록 캐시에 아직 없다. 안 고치면 대화를 갈아 끼우는 순간 방금 만든 대화를 잃는다
    void queryClient.invalidateQueries({
      queryKey: getGetAgentChatsQueryKey(workspaceId),
    });
    return chatId;
  }, [
    createChat,
    isChatsUnavailable,
    isSessionGone,
    queryClient,
    sessionId,
    workspaceId,
  ]);

  /**
   * 끝난 턴의 서버 기록을 다시 읽어 캐시에 넣고 돌려준다(실패면 null).
   *
   * `invalidateQueries` 는 실패해도 resolve 해서 믿고 지우면 방금 끝난 턴이 사라진다.
   * `messagesQuery.refetch()` 는 첫 전송에서 아직 `sessionId === null` 로 렌더된 클로저라 못 쓴다.
   * 떠 있는 조회를 먼저 취소한다 — 아직 이 턴이 없는 GET 에 합쳐지면 빈 응답을 성공으로 읽는다.
   * `staleTime: 0` 이 없으면 전역 기본값에 걸려 네트워크를 안 탄다.
   */
  const reconcile = useCallback(
    async (chatId: string) => {
      const messagesKey = getGetAgentChatMessagesQueryOptions(chatId).queryKey;
      await queryClient.cancelQueries({ queryKey: messagesKey });
      const refreshed = await queryClient
        .fetchQuery({
          ...getGetAgentChatMessagesQueryOptions(chatId),
          staleTime: 0,
        })
        .catch(() => null);
      return refreshed?.status === 200 && refreshed.data.success
        ? refreshed.data.data
        : null;
    },
    [queryClient]
  );

  /**
   * 질문을 보낸다. 말풍선은 세션 생성을 안 기다리고 곧바로 선다. 문장을 컴포저로 되돌려야 하면
   * (세션을 못 만들었거나 서버가 문장을 안 받아 갔다) `false` 를 돌려준다.
   *
   * 세션 생성부터 히스토리 반영까지가 한 트랜잭션이다. 스트리밍만 잠그면 생성 중 두 번째 전송이
   * 세션을 하나 더 만든다. 완료된 로컬 턴은 다음 질문을 보낼 때에야 히스토리로 넘긴다 — 그 전에
   * 비우면 말풍선 DOM 이 통째로 다시 만들어져 번쩍인다.
   */
  const send = useCallback(
    async (message: string, scope: ScopeChip[]): Promise<boolean> => {
      if (isBusy) return true;
      if (stream.state.phase === "done" && pendingUserMessage !== null) {
        stream.reset();
      }
      setIsSending(true);
      onTurnActiveChange(true);
      try {
        setTurnBaseline(messages.length);
        setPendingUserMessage(message);
        setPendingUserAt(new Date().toISOString());
        setPendingScope(scope);

        // 실패 문구는 전역 MutationCache 가 토스트한다
        const chatId = await ensureSession().catch(() => null);
        if (!chatId) {
          setPendingUserMessage(null);
          return false;
        }

        // 범위는 본문이 아니라 칩 배열이 정한다
        const accepted = await sendMessage
          .mutateAsync({
            chatId,
            data: {
              message,
              noteIds: uniqueIds(scope, "note"),
              projectIds: uniqueIds(scope, "project"),
            },
          })
          .catch((error: unknown) => ({ error }));
        if ("error" in accepted || accepted.status !== 202) {
          // 409 는 이미 도는 턴이 있다는 이어받기 신호다. 오류로 그리고 「다시 보내기」를 두면 그것이
          // 또 409 를 받아 루프가 된다. 그 밖의 실패는 POST 가 닿았는지 모르므로 히스토리를 다시
          // 읽는다 — 살아 있는 턴은 재진입 effect 가 이어받고, 끝났으면 답이 그대로 그려진다.
          const failure = "error" in accepted ? accepted.error : null;
          if (
            errorCodeOf(failure) !== "AGENT_CHAT_TURN_IN_PROGRESS" &&
            !isAuthError(failure)
          ) {
            toast.error(errorMessageOf(failure, "요청을 처리하지 못했습니다."));
          }
          setPendingUserMessage(null);
          stream.reset();
          const refreshed = await reconcile(chatId);
          // 서버가 이미 받았으면 되돌리지 않는다. 되돌리면 화면과 컴포저에 같은 질문이 한 벌씩 선다
          return echoesSent(refreshed, messages.length, message);
        }
        const turnId = accepted.data.data.turnId;
        const final = await stream.open(
          chatId,
          turnId,
          startedState({ turnId })
        );
        if (final?.phase !== "done") return true;
        // 캐시만 갱신하고 완료된 로컬 턴은 그대로 둔다
        await reconcile(chatId);
        return true;
      } finally {
        setIsSending(false);
        onTurnActiveChange(false);
      }
    },
    [
      ensureSession,
      isBusy,
      messages.length,
      onTurnActiveChange,
      pendingUserMessage,
      reconcile,
      sendMessage,
      stream,
    ]
  );

  /**
   * 승인을 보낸다. `202` 뒤 같은 턴 스트림에 지금 커서로 다시 붙는다. 실패 사유를 돌려주면 카드가
   * 「다시 눌러도 소용없나」를 가른다. 승인 대기에는 열린 연결이 없어 `stream.state` 가 낡지 않는다.
   */
  const resolveApproval = useCallback(
    async (approvalId: string, decision: ApprovalDecision) => {
      const turnId = stream.state.turnId;
      if (!sessionId || !turnId) return null;
      setIsSending(true);
      onTurnActiveChange(true);
      try {
        const accepted = await resolveApprovalMutation
          .mutateAsync({ chatId: sessionId, approvalId, data: { decision } })
          .catch((error: unknown) => ({ error }));
        if ("error" in accepted) {
          return {
            code: errorCodeOf(accepted.error) ?? "STREAM_FAILED",
            message: errorMessageOf(
              accepted.error,
              "승인을 처리하지 못했습니다."
            ),
          };
        }
        // 결정을 먼저 적는다. 재접속이 끊겨 끝나도 승인받은 쓰기가 「중단됨」이 아니라 「확인 필요」로
        // 닫힌다. `open` 은 앞 스트림이 안 닫혔으면 시드를 버리므로 `seed` 로 먼저 적는다.
        const decided = {
          ...stream.state,
          blocks: recordDecision(stream.state.blocks, approvalId, decision),
        };
        stream.seed(decided);
        const final = await stream.open(sessionId, turnId, {
          ...decided,
          phase: "streaming",
        });
        // 202 뒤라 승인은 받아졌다. 스트림 오류를 여기서 돌려주면 카드가 「승인 실패」로 굳는다
        if (final?.phase !== "done") return null;
        if (!(await reconcile(sessionId))) return null;
        // 다른 탭에서 시작한 턴을 이어받았다면 로컬 질문이 없으므로 캐시로 넘긴다
        if (pendingUserMessage === null) stream.reset();
        return null;
      } finally {
        setIsSending(false);
        onTurnActiveChange(false);
      }
    },
    [
      onTurnActiveChange,
      pendingUserMessage,
      reconcile,
      resolveApprovalMutation,
      sessionId,
      stream,
    ]
  );

  const approval = useToolApproval({
    pending: stream.state.pendingApproval,
    streamPhase: stream.state.phase,
    resolve: resolveApproval,
  });

  /**
   * 돌아오면 이어받는다. `activeTurn` 이 있으면 `cursor` 부터 턴 스트림으로 잇고(커서가 없으면 턴의
   * 처음부터), 없으면 `lastTurn` 이 FAILED 일 때만 배너를 세운다. 승인 대기는 스트림을 안 연다 —
   * 턴 스트림이 카드 뒤에 닫혀 있어 여는 순간 EOF 다.
   */
  const handledTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sessionId || !history || isSending) return;
    const turnId = activeTurn?.turnId ?? lastTurn?.turnId;
    if (!turnId) return;
    // 같은 턴에 두 번 붙지 않는다. 이 탭이 시작한 턴은 `stream.state.turnId` 가 이미 같아서 중지
    // 직후의 재조회가 되살리지 못한다.
    const key = `${sessionId}:${turnId}`;
    if (handledTurnRef.current === key || stream.state.turnId === turnId)
      return;
    handledTurnRef.current = key;

    if (!activeTurn) {
      // 도는 턴이 곧 마지막 턴인 것이 정상이라, 도는 턴이 없을 때만 실패를 그린다
      if (lastTurn?.status === "FAILED") {
        stream.seed(failedTurnState(lastTurn.failureCode, lastTurn.retryable));
      }
      return;
    }

    const resumed = resumedState({
      cursor,
      partialAnswer,
      turnId: activeTurn.turnId,
      pendingApproval: activeTurn.pendingApproval
        ? {
            approvalId: activeTurn.pendingApproval.approvalId,
            tool: activeTurn.pendingApproval.tool,
            summary: activeTurn.pendingApproval.summary,
            // 돌아온 화면은 `tool_call_start` 를 못 봤다. server 는 이 값을 JSON 문자열로 준다
            args: toolArgs(activeTurn.pendingApproval.args),
          }
        : null,
    });

    if (activeTurn.pendingApproval) {
      stream.seed(resumed);
      return;
    }

    void stream.resume(sessionId, resumed).then(async (final) => {
      // 히스토리로 넘겨야 `activeTurn` 이 비고 전송이 풀린다
      if (final?.phase !== "done") return;
      if (await reconcile(sessionId)) stream.reset();
    });
  }, [
    activeTurn,
    cursor,
    history,
    isSending,
    lastTurn,
    partialAnswer,
    reconcile,
    sessionId,
    stream,
  ]);

  /**
   * 재생으로 못 채운 자리를 굳은 기록으로 메운다. `needsResync`(410)는 스트림이 사라졌다는 서버의
   * 말이고, `STREAM_INTERRUPTED` 는 재연결을 다 쓰고 포기한 것이다. 둘 다 히스토리가 유일한 사실이다.
   * `messagesQuery` 는 흐르는 동안 꺼져 있어 `reconcile()` 로 직접 읽는다. 한 턴에 한 번만 당긴다.
   */
  const resyncedTurnRef = useRef<string | null>(null);
  /** 재조회가 실패한 열쇠. 곧바로 다시 물으면 렌더마다 도므로 탭 복귀·온라인 복귀까지 기다린다. */
  const failedResyncRef = useRef<string | null>(null);
  const [resyncRetry, retryResync] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const retry = () => {
      if (document.visibilityState !== "visible") return;
      const failed = failedResyncRef.current;
      if (failed === null || resyncedTurnRef.current !== failed) return;
      failedResyncRef.current = null;
      resyncedTurnRef.current = null;
      retryResync();
    };
    document.addEventListener("visibilitychange", retry);
    window.addEventListener("online", retry);
    return () => {
      document.removeEventListener("visibilitychange", retry);
      window.removeEventListener("online", retry);
    };
  }, []);
  useEffect(() => {
    if (!sessionId) return;
    const gaveUp =
      stream.state.phase === "failed" &&
      stream.state.error?.code === "STREAM_INTERRUPTED";
    const reason = stream.state.needsResync
      ? "resync"
      : gaveUp
        ? "gaveUp"
        : null;
    if (!reason) return;
    const key = `${sessionId}:${stream.state.turnId ?? ""}:${reason}`;
    if (resyncedTurnRef.current === key) return;
    resyncedTurnRef.current = key;
    const turnId = stream.state.turnId;
    void reconcile(sessionId).then((refreshed) => {
      if (!refreshed) {
        failedResyncRef.current = key;
        return;
      }
      // 포기한 쪽도 히스토리가 끝났다고 답하면 로컬 사본을 버린다. 안 버리면 굳은 행과 받아 둔
      // 프레임이 같은 생각·도구 줄을 두 벌 그린다. 실패 배너는 `lastTurn` 으로 다시 선다.
      if (reason === "resync" || !refreshed.activeTurn) {
        stream.reset();
        return;
      }
      // 아직 돈다. 「끊겼습니다」로 굳히지 않고 다시 붙거나 승인 대기로 옮긴다(N3). 다음 포기도
      // 다시 물어야 하므로 기억을 푼다 — 포기 한 번이 최소 45초라 되묻기가 몰리지 않는다.
      const active = refreshed.activeTurn;
      if (turnId === null || active.turnId !== turnId) return;
      resyncedTurnRef.current = null;
      const pending = active.pendingApproval
        ? {
            approvalId: active.pendingApproval.approvalId,
            tool: active.pendingApproval.tool,
            summary: active.pendingApproval.summary,
            args: toolArgs(active.pendingApproval.args),
          }
        : null;
      void stream.revive(sessionId, turnId, pending).then(async (final) => {
        if (final?.phase === "done") await reconcile(sessionId);
      });
    });
  }, [reconcile, resyncRetry, sessionId, stream]);

  /**
   * 중지. 이 탭의 구독을 끊고 서버의 턴도 취소한다 — 끊기만 하면 답이 계속 쌓이고 다음 전송이 409 를
   * 받는다. 다 읽었으면 로컬 사본을 버린다. 토큰 없이 멈춘 턴은 server 가 ASSISTANT 행을 안 써서
   * `isTurnReconciled` 로는 안 접힌다.
   */
  const stop = useCallback(() => {
    const turnId = stream.state.turnId;
    stream.stop();
    if (!sessionId || !turnId) return;
    cancelTurn.mutate(
      { chatId: sessionId, turnId },
      {
        onSuccess: () =>
          void reconcile(sessionId).then((refreshed) => {
            if (!refreshed) return;
            setPendingUserMessage(null);
            stream.reset();
          }),
      }
    );
  }, [cancelTurn, reconcile, sessionId, stream]);

  /**
   * 대화를 갈아 끼울 때 이 턴의 흔적을 비운다. 스트림을 먼저 끊어야 앞 대화의 토큰이 새 스레드에
   * 안 그려진다. 서버의 턴은 계속 돌고, 돌아오면 `activeTurn`·`cursor` 로 이어받는다 — 그래서
   * 이어받기 기억도 푼다. 안 풀면 A → B → A 로 돌아왔을 때 A 의 턴에 다시 안 붙는다.
   */
  const leaveTurn = useCallback(() => {
    stream.reset();
    setPendingUserMessage(null);
    setPendingUserAt(null);
    handledTurnRef.current = null;
  }, [stream]);

  /** 목록에서 고른 대화로 옮긴다. 옮겼으면 true. */
  const switchChat = useCallback(
    (chatId: string) => {
      if (isSwitchBlocked || chatId === sessionId) return false;
      leaveTurn();
      // 방금 만든 대화가 우선이라 안 비우면 무엇을 골라도 화면이 안 바뀐다
      setCreatedChatId(null);
      setIsDraftChat(false);
      setSelectedChatId(chatId);
      return true;
    },
    [isSwitchBlocked, leaveTurn, sessionId]
  );

  /** 빈 새 대화를 쓰기 시작한다. 이미 빈 새 대화면 아무 일도 안 한다. 옮겼으면 true. */
  const startNewChat = useCallback(() => {
    if (isSwitchBlocked || isDraftChat) return false;
    leaveTurn();
    setSelectedChatId(null);
    setCreatedChatId(null);
    setIsDraftChat(true);
    return true;
  }, [isDraftChat, isSwitchBlocked, leaveTurn]);

  const streamPhase = stream.state.phase;
  const streamTurnId = stream.state.turnId;
  const threadMessages = useMemo(
    () =>
      freezeTurnTime(
        visibleTurnMessages(messages, {
          stream: { phase: streamPhase, turnId: streamTurnId },
          cursor,
          showingLocalTurn,
        }),
        turnBaseline,
        pendingUserAt
      ),
    [
      cursor,
      messages,
      pendingUserAt,
      showingLocalTurn,
      streamPhase,
      streamTurnId,
      turnBaseline,
    ]
  );

  /**
   * 이 탭이 끝나는 것을 본 턴. `stream.reset()` 이 `turnId` 를 지워도 들고 있어야, 답이 히스토리로
   * 넘어가는 순간 목록 배지가 다음 폴링까지 「진행 중」으로 되살아나지 않는다. 대화 전환의
   * `reset()` 은 종료 phase 가 아니라 여기 안 걸린다 — 그 턴은 서버에서 계속 돈다.
   */
  const [finishedTurn, setFinishedTurn] = useState<string | null>(null);
  const settledTurnId =
    stream.state.turnId !== null &&
    (stream.state.phase === "done" ||
      stream.state.phase === "failed" ||
      stream.state.phase === "cancelled")
      ? stream.state.turnId
      : null;
  // 렌더 중에 맞춘다. effect 로 미루면 낡은 값으로 한 번 그리는 것이 곧 깜빡임이다
  if (settledTurnId !== null && settledTurnId !== finishedTurn) {
    setFinishedTurn(settledTurnId);
  }

  // 첫 쪽에 올라온 대화는 옛 쪽에서 뺀다 — 옛 대화에 이어 쓰면 두 쪽에 다 있다.
  const listedChats = useMemo(() => {
    const top = new Set(chats.map((chat) => chat.chatId));
    return [
      ...chats,
      ...olderHere.chats.filter((chat) => !top.has(chat.chatId)),
    ];
  }, [chats, olderHere.chats]);
  const chatRows = useMemo(
    () =>
      listedChats.map((chat) => ({
        chatId: chat.chatId,
        title: chat.title,
        // 목록 정렬 기준과 같은 값을 적어야 「1분 전인데 세 번째 줄」이 안 생긴다
        updatedAt: chat.updatedAt,
        label: runningLabel(chat, {
          chatId: sessionId,
          turnId: stream.state.turnId,
          phase: stream.state.phase,
          finishedTurnId: finishedTurn,
        }),
      })),
    [
      listedChats,
      finishedTurn,
      sessionId,
      stream.state.phase,
      stream.state.turnId,
    ]
  );

  const retry = useCallback(
    () =>
      void (isChatsUnavailable
        ? chatsQuery.refetch()
        : messagesQuery.refetch()),
    [chatsQuery, isChatsUnavailable, messagesQuery]
  );

  return {
    sessionId,
    chatRows,
    hasMoreChats,
    isLoadingMoreChats,
    loadMoreChats,
    stream: stream.state,
    isStreaming,
    isBusy,
    isSwitchBlocked,
    isLoading,
    isUnavailable,
    isChatsUnavailable,
    /** 이 탭에서 보낸 질문의 완료 턴이 화면에 로컬로 남아 있다. */
    showingLocalTurn,
    /** 히스토리가 이 턴을 이미 담았다. 로컬 사본을 지우지 않고 가린다. */
    isTurnReconciled: reconciled,
    messageCount: messages.length,
    threadMessages,
    activeTurnId: activeTurn?.turnId ?? null,
    pendingUserMessage,
    pendingUserAt,
    pendingScope,
    approval,
    send,
    stop,
    switchChat,
    startNewChat,
    retry,
  };
}
