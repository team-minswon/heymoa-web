"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import {
  getGetAgentChatMessagesQueryOptions,
  getAgentChats,
  getGetAgentChatMessagesQueryKey,
  getGetAgentChatsQueryKey,
  useCancelAgentChatTurn,
  useCreateAgentChat,
  useDeleteAgentChat,
  useRenameAgentChat,
  useGetAgentChatMessages,
  useGetAgentChats,
  useResolveToolApproval,
  useSendAgentChatMessage,
} from "@/lib/api/generated/agent-chat/agent-chat";
import type {
  AgentChatMessagesResponseData,
  AgentChatMessagesResponseDataActiveTurnPendingApproval,
  AgentChatsResponseData,
  AgentChatsResponseDataChatsItem,
} from "@/lib/api/generated/models";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { isAuthError } from "@/lib/api/fetcher";
import { toast } from "@/lib/ui/toast";
import { type ApprovalDecision, decideApproval } from "@/lib/chat/blocks";
import type { ChatMutationContext } from "@/lib/analytics/track";
import {
  type ChatTitleSnapshot,
  dropChatFromList,
  isTitlePending,
  pruneTitleWaits,
  retitleChatInList,
  revertChatTitle,
  revertChatTitleInList,
  runningLabel,
  settleTitleWait,
  TITLE_TURN_WAIT_MS,
  type TitleWaits,
  titleSourceOf,
} from "@/lib/chat/chat-list";
import type { ScopeChip } from "@/lib/chat/scope-chip";
import {
  failedTurnState,
  parseApprovalCard,
  resumedState,
  startedState,
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
import { useEventStreamHealthy } from "@/lib/events/health";
import { hintedInterval } from "@/lib/events/interval";

const CHAT_LIST_POLL_MS = 5_000;

const CHAT_PAGE_SIZE = 30;

function usePruneExpiredTitleWaits(
  titleWaits: TitleWaits,
  setTitleWaits: Dispatch<SetStateAction<TitleWaits>>
) {
  useEffect(() => {
    const deadlines = Object.values(titleWaits);
    if (deadlines.length === 0) return;
    const timer = setTimeout(
      () => setTitleWaits((current) => pruneTitleWaits(current, Date.now())),
      Math.max(0, Math.min(...deadlines) - Date.now())
    );
    return () => clearTimeout(timer);
  }, [titleWaits, setTitleWaits]);
}

type ChatCursor = { afterUpdatedAt: string; afterChatId: string };

type ChatPage = Pick<
  AgentChatsResponseData,
  "hasMore" | "nextUpdatedAt" | "nextChatId"
>;

const nextCursorOf = (page: ChatPage): ChatCursor | null =>
  page.hasMore && page.nextUpdatedAt && page.nextChatId
    ? { afterUpdatedAt: page.nextUpdatedAt, afterChatId: page.nextChatId }
    : null;

function useOlderChats(workspaceId: string, firstPage: ChatPage | null) {
  const t = useTranslations("chat");
  const [older, setOlder] = useState<{
    workspaceId: string;
    anchor: string | null;
    chats: AgentChatsResponseDataChatsItem[];
    cursor: ChatCursor | null | undefined;
  }>({ workspaceId, anchor: null, chats: [], cursor: undefined });
  const [isLoadingMoreChats, setIsLoadingMoreChats] = useState(false);
  const firstTail = firstPage?.nextChatId ?? null;
  const firstTailRef = useRef(firstTail);
  useEffect(() => {
    firstTailRef.current = firstTail;
  }, [firstTail]);
  const olderHere =
    older.workspaceId === workspaceId && older.anchor === firstTail
      ? older
      : { workspaceId, anchor: firstTail, chats: [], cursor: undefined };
  const nextCursor = useMemo(() => {
    if (olderHere.cursor !== undefined) return olderHere.cursor;
    return firstPage ? nextCursorOf(firstPage) : null;
  }, [firstPage, olderHere.cursor]);
  const hasMoreChats = nextCursor !== null;
  const loadMoreChats = useCallback(async () => {
    if (!nextCursor || isLoadingMoreChats) return;
    setIsLoadingMoreChats(true);
    const anchor = firstTail;
    try {
      const response = await getAgentChats(workspaceId, {
        limit: String(CHAT_PAGE_SIZE),
        ...nextCursor,
      });
      if (response.status !== 200 || !response.data.success) {
        toast.error(t("errors.loadMoreFailed"));
        return;
      }
      const page = response.data.data;
      if (firstTailRef.current !== anchor) return;
      setOlder({
        workspaceId,
        anchor,
        chats: [...olderHere.chats, ...page.chats],
        cursor: nextCursorOf(page),
      });
    } catch {
      toast.error(t("errors.loadMoreFailed"));
    } finally {
      setIsLoadingMoreChats(false);
    }
  }, [
    firstTail,
    isLoadingMoreChats,
    nextCursor,
    olderHere.chats,
    t,
    workspaceId,
  ]);

  return {
    olderChats: olderHere.chats,
    setOlder,
    hasMoreChats,
    isLoadingMoreChats,
    loadMoreChats,
  };
}

const resumedApprovalOf = (
  pending: AgentChatMessagesResponseDataActiveTurnPendingApproval | null
) =>
  pending
    ? {
        approvalId: pending.approvalId,
        tool: pending.tool,
        summary: pending.summary,
        card: parseApprovalCard(pending.card),
      }
    : null;

function useStreamResync(
  sessionId: string | null,
  stream: ReturnType<typeof useChatStream>,
  reconcile: (chatId: string) => Promise<AgentChatMessagesResponseData | null>
) {
  const resyncedTurnRef = useRef<string | null>(null);
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
      if (reason === "resync" || !refreshed.activeTurn) {
        stream.reset();
        return;
      }
      const active = refreshed.activeTurn;
      if (turnId === null || active.turnId !== turnId) return;
      resyncedTurnRef.current = null;
      const pending = resumedApprovalOf(active.pendingApproval);
      void stream.revive(sessionId, turnId, pending).then(async (final) => {
        if (final?.phase === "done") await reconcile(sessionId);
      });
    });
  }, [reconcile, resyncRetry, sessionId, stream]);
}

function useRenameChat({
  workspaceId,
  knownChats,
  setOlder,
  forgetChat,
}: {
  workspaceId: string;
  knownChats: AgentChatsResponseDataChatsItem[];
  setOlder: ReturnType<typeof useOlderChats>["setOlder"];
  forgetChat: (chatId: string) => void;
}) {
  const queryClient = useQueryClient();
  const renameChatMutation = useRenameAgentChat({
    mutation: { meta: { suppressErrorToast: true } },
  });

  const renameLedgerRef = useRef(
    new Map<
      string,
      { seq: number; inFlight: number; base: ChatTitleSnapshot | null }
    >()
  );

  return useCallback(
    async (chatId: string, title: string, failureMessage: string) => {
      const listKey = { queryKey: getGetAgentChatsQueryKey(workspaceId) };
      const ledger = renameLedgerRef.current;
      const known = knownChats.find((chat) => chat.chatId === chatId);
      const previousSource = titleSourceOf(knownChats, chatId);
      const entry = ledger.get(chatId);
      const seq = (entry?.seq ?? 0) + 1;
      ledger.set(chatId, {
        seq,
        inFlight: (entry?.inFlight ?? 0) + 1,
        base:
          entry?.base ??
          (known
            ? {
                title: known.title,
                titleSource: (known as { titleSource?: unknown }).titleSource,
              }
            : null),
      });
      await queryClient.cancelQueries(listKey);
      queryClient.setQueriesData(listKey, (current: unknown) =>
        retitleChatInList(current, chatId, title)
      );
      setOlder((current) => ({
        ...current,
        chats: current.chats.map((chat) =>
          chat.chatId === chatId
            ? { ...chat, title, titleSource: "USER" }
            : chat
        ),
      }));
      const settle = (confirmed: boolean) => {
        const now = ledger.get(chatId);
        if (!now) return null;
        if (confirmed) now.base = { title, titleSource: "USER" };
        now.inFlight -= 1;
        const latest = now.seq === seq;
        const base = now.base;
        if (now.inFlight === 0) ledger.delete(chatId);
        return { latest, base };
      };
      try {
        const variables: {
          chatId: string;
          data: { title: string };
        } & ChatMutationContext = {
          chatId,
          data: { title },
          workspaceId,
          previousTitleSource: previousSource,
        };
        await renameChatMutation.mutateAsync(variables);
        settle(true);
        return true;
      } catch (error) {
        const settled = settle(false);
        if (errorCodeOf(error) === "AGENT_CHAT_NOT_FOUND") {
          forgetChat(chatId);
          return false;
        }
        if (settled?.latest && settled.base) {
          const restore = settled.base;
          queryClient.setQueriesData(listKey, (current: unknown) =>
            revertChatTitleInList(current, chatId, title, restore)
          );
          setOlder((current) => ({
            ...current,
            chats: revertChatTitle(current.chats, chatId, title, restore),
          }));
        }
        if (!isAuthError(error)) toast.error(failureMessage);
        return false;
      }
    },
    [
      forgetChat,
      knownChats,
      queryClient,
      renameChatMutation,
      setOlder,
      workspaceId,
    ]
  );
}

function useResumeServerTurn({
  sessionId,
  history,
  isSending,
  partialAnswer,
  stream,
  reconcile,
}: {
  sessionId: string | null;
  history: AgentChatMessagesResponseData | null;
  isSending: boolean;
  partialAnswer: ReturnType<typeof partialAnswerOf>;
  stream: ReturnType<typeof useChatStream>;
  reconcile: (chatId: string) => Promise<AgentChatMessagesResponseData | null>;
}) {
  const handledTurnRef = useRef<string | null>(null);
  const activeTurn = history?.activeTurn ?? null;
  const lastTurn = history?.lastTurn ?? null;
  const cursor = history?.cursor ?? null;
  useEffect(() => {
    if (!sessionId || !history || isSending) return;
    const turnId = activeTurn?.turnId ?? lastTurn?.turnId;
    if (!turnId) return;
    const key = `${sessionId}:${turnId}`;
    if (handledTurnRef.current === key || stream.state.turnId === turnId)
      return;
    handledTurnRef.current = key;

    if (!activeTurn) {
      if (lastTurn?.status === "FAILED") {
        stream.seed(failedTurnState(lastTurn.failureCode, lastTurn.retryable));
      }
      return;
    }

    const resumed = resumedState({
      cursor,
      partialAnswer,
      turnId: activeTurn.turnId,
      pendingApproval: resumedApprovalOf(activeTurn.pendingApproval),
    });

    if (activeTurn.pendingApproval) {
      stream.seed(resumed);
      return;
    }

    void stream.resume(sessionId, resumed).then(async (final) => {
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
  return handledTurnRef;
}

const uniqueIds = (scope: ScopeChip[], kind: ScopeChip["kind"]) => [
  ...new Set(scope.filter((chip) => chip.kind === kind).map((chip) => chip.id)),
];

export function useChatTurn({
  workspaceId,
  onTurnActiveChange,
  startAsDraft = false,
  onChatForgotten,
}: {
  workspaceId: string;
  onTurnActiveChange: (active: boolean) => void;
  startAsDraft?: boolean;
  onChatForgotten?: (chatId: string, wasOpen: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("chat");
  const tErrors = useTranslations("errors");
  const stream = useChatStream();
  const isStreaming =
    stream.state.phase === "streaming" ||
    stream.state.phase === "awaiting_approval";
  const [createdChatId, setCreatedChatId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isDraftChat, setIsDraftChat] = useState(startAsDraft);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(
    null
  );
  const [pendingScope, setPendingScope] = useState<ScopeChip[]>([]);
  const [pendingUserAt, setPendingUserAt] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [turnBaseline, setTurnBaseline] = useState(0);
  const [titleWaits, setTitleWaits] = useState<TitleWaits>({});
  usePruneExpiredTitleWaits(titleWaits, setTitleWaits);

  const streamHealthy = useEventStreamHealthy();
  const chatsQuery = useGetAgentChats(workspaceId, undefined, {
    query: {
      refetchInterval: hintedInterval(streamHealthy, CHAT_LIST_POLL_MS),
    },
  });
  const chatsResponse = chatsQuery.data;
  const chatsOk = chatsResponse?.status === 200 && chatsResponse.data.success;
  const chats = useMemo(
    () => (chatsOk ? chatsResponse.data.data.chats : []),
    [chatsOk, chatsResponse]
  );

  const firstPage = chatsOk ? chatsResponse.data.data : null;
  const {
    olderChats,
    setOlder,
    hasMoreChats,
    isLoadingMoreChats,
    loadMoreChats,
  } = useOlderChats(workspaceId, firstPage);
  const isChatsUnavailable =
    chatsQuery.isError || (chatsResponse !== undefined && !chatsOk);

  const sessionId =
    createdChatId ??
    selectedChatId ??
    (isDraftChat ? null : (chats[0]?.chatId ?? null));

  const sessionIdRef = useRef(sessionId);
  const onChatForgottenRef = useRef(onChatForgotten);
  useEffect(() => {
    sessionIdRef.current = sessionId;
    onChatForgottenRef.current = onChatForgotten;
  });

  // server 가 USER 행을 스트림 전에 저장해, 턴이 도는 동안 켜면 낙관적 말풍선과 두 벌이 됩니다.
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

  const isSessionGone =
    Boolean(sessionId) &&
    errorCodeOf(messagesQuery.error) === "AGENT_CHAT_NOT_FOUND";
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

  // `isPending` 은 enabled:false 쿼리도 참입니다.
  const isLoading = chatsQuery.isLoading || messagesQuery.isLoading;
  const createChat = useCreateAgentChat();

  const isBusy =
    isSending ||
    createChat.isPending ||
    isLoading ||
    isUnavailable ||
    isStreaming ||
    Boolean(activeTurn && activeTurn.turnId !== stream.state.turnId);

  const isSwitchBlocked = isLoading || isUnavailable || createChat.isPending;

  const sendMessage = useSendAgentChatMessage({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const resolveApprovalMutation = useResolveToolApproval({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const cancelTurn = useCancelAgentChatTurn();
  const deleteChatMutation = useDeleteAgentChat({
    mutation: { meta: { suppressErrorToast: true } },
  });

  const ensureSession = useCallback(async () => {
    if (sessionId && !isSessionGone) {
      setSelectedChatId(sessionId);
      return sessionId;
    }
    if (isChatsUnavailable) return null;
    const created = await createChat.mutateAsync({ workspaceId, data: {} });
    if (created.status !== 201 || !created.data.success) return null;
    const chatId = created.data.data.chatId;
    setCreatedChatId(chatId);
    setIsDraftChat(false);
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

  /** `invalidateQueries` 는 실패해도 resolve 하고, 떠 있는 조회에 합쳐지면 빈 응답을 성공으로 읽어 먼저 취소합니다. `staleTime: 0` 이 없으면 네트워크를 타지 않습니다. */
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

        const untitled =
          !sessionId ||
          isSessionGone ||
          titleSourceOf(chats, sessionId) === "DEFAULT";
        const chatId = await ensureSession().catch(() => null);
        if (!chatId) {
          setPendingUserMessage(null);
          return false;
        }
        if (untitled) {
          setTitleWaits((current) => ({
            ...current,
            [chatId]: Date.now() + TITLE_TURN_WAIT_MS,
          }));
        }

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
          const failure = "error" in accepted ? accepted.error : null;
          if (
            errorCodeOf(failure) !== "AGENT_CHAT_TURN_IN_PROGRESS" &&
            !isAuthError(failure)
          ) {
            toast.error(errorMessageOf(failure, tErrors("requestFailed")));
          }
          setPendingUserMessage(null);
          stream.reset();
          const refreshed = await reconcile(chatId);
          return echoesSent(refreshed, messages.length, message);
        }
        const turnId = accepted.data.data.turnId;
        const final = await stream.open(
          chatId,
          turnId,
          startedState({ turnId })
        );
        if (final?.phase !== "done") return true;
        await reconcile(chatId);
        return true;
      } finally {
        setIsSending(false);
        onTurnActiveChange(false);
      }
    },
    [
      chats,
      ensureSession,
      isBusy,
      isSessionGone,
      messages.length,
      onTurnActiveChange,
      pendingUserMessage,
      reconcile,
      sendMessage,
      sessionId,
      stream,
      tErrors,
    ]
  );

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
            message: errorMessageOf(accepted.error, t("errors.approvalFailed")),
          };
        }
        const decided = {
          ...stream.state,
          pendingApproval: null,
          blocks: decideApproval(
            stream.state.blocks,
            stream.state.pendingApproval,
            approvalId,
            decision
          ),
        };
        stream.seed(decided);
        const final = await stream.open(sessionId, turnId, {
          ...decided,
          phase: "streaming",
        });
        if (final?.phase !== "done") return null;
        if (!(await reconcile(sessionId))) return null;
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
      t,
    ]
  );

  const approval = useToolApproval({
    pending: stream.state.pendingApproval,
    streamPhase: stream.state.phase,
    resolve: resolveApproval,
  });

  const handledTurnRef = useResumeServerTurn({
    sessionId,
    history,
    isSending,
    partialAnswer,
    stream,
    reconcile,
  });

  useStreamResync(sessionId, stream, reconcile);

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

  const leaveTurn = useCallback(() => {
    stream.reset();
    setPendingUserMessage(null);
    setPendingUserAt(null);
    handledTurnRef.current = null;
  }, [handledTurnRef, stream]);

  const switchChat = useCallback(
    (chatId: string) => {
      if (isSwitchBlocked || chatId === sessionId) return false;
      leaveTurn();
      setCreatedChatId(null);
      setIsDraftChat(false);
      setSelectedChatId(chatId);
      return true;
    },
    [isSwitchBlocked, leaveTurn, sessionId]
  );

  const startNewChat = useCallback(() => {
    if (isSwitchBlocked || isDraftChat) return false;
    leaveTurn();
    setSelectedChatId(null);
    setCreatedChatId(null);
    setIsDraftChat(true);
    return true;
  }, [isDraftChat, isSwitchBlocked, leaveTurn]);

  const forgetChat = useCallback(
    (chatId: string) => {
      const wasOpen = chatId === sessionIdRef.current;
      if (wasOpen) {
        leaveTurn();
        setSelectedChatId(null);
        setCreatedChatId(null);
        setIsDraftChat(true);
      }
      onChatForgottenRef.current?.(chatId, wasOpen);
      setOlder((current) => ({
        ...current,
        chats: current.chats.filter((chat) => chat.chatId !== chatId),
      }));
      queryClient.setQueriesData(
        { queryKey: getGetAgentChatsQueryKey(workspaceId) },
        (current: unknown) => dropChatFromList(current, chatId)
      );
      queryClient.removeQueries({
        queryKey: getGetAgentChatMessagesQueryKey(chatId),
      });
      void queryClient.invalidateQueries({
        queryKey: getGetAgentChatsQueryKey(workspaceId),
      });
    },
    [leaveTurn, queryClient, setOlder, workspaceId]
  );

  const deleteChat = useCallback(
    async (chatId: string, failureMessage: string) => {
      const variables: { chatId: string } & ChatMutationContext = {
        chatId,
        workspaceId,
      };
      const ok = await deleteChatMutation
        .mutateAsync(variables)
        .then(() => true)
        .catch((error: unknown) => {
          if (errorCodeOf(error) === "AGENT_CHAT_NOT_FOUND") return true;
          if (!isAuthError(error)) {
            toast.error(errorMessageOf(error, failureMessage));
          }
          return false;
        });
      if (!ok) return false;
      forgetChat(chatId);
      return true;
    },
    [deleteChatMutation, forgetChat, workspaceId]
  );

  const knownChats = useMemo(
    () => [...chats, ...olderChats],
    [chats, olderChats]
  );
  const renameChat = useRenameChat({
    workspaceId,
    knownChats,
    setOlder,
    forgetChat,
  });

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

  const [finishedTurn, setFinishedTurn] = useState<string | null>(null);
  const settledTurnId =
    stream.state.turnId !== null &&
    (stream.state.phase === "done" ||
      stream.state.phase === "failed" ||
      stream.state.phase === "cancelled")
      ? stream.state.turnId
      : null;
  if (settledTurnId !== null && settledTurnId !== finishedTurn) {
    setFinishedTurn(settledTurnId);
    if (sessionId) {
      const done = stream.state.phase === "done";
      setTitleWaits((current) =>
        settleTitleWait(current, sessionId, done, Date.now())
      );
    }
  }

  const listedChats = useMemo(() => {
    const top = new Set(chats.map((chat) => chat.chatId));
    return [...chats, ...olderChats.filter((chat) => !top.has(chat.chatId))];
  }, [chats, olderChats]);
  const chatRows = useMemo(
    () =>
      listedChats.map((chat) => ({
        chatId: chat.chatId,
        // 서버의 기본 제목(「새 대화」)은 계약 값이라 한국어여서 화면 언어로 그립니다.
        title: chat.titleSource === "DEFAULT" ? t("newChat") : chat.title,
        titlePending: isTitlePending(chat, titleWaits),
        titleAwaited: chat.chatId in titleWaits,
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
      t,
      titleWaits,
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
    showingLocalTurn,
    isTurnReconciled: reconciled,
    messageCount: messages.length,
    threadMessages,
    activeTurnId: activeTurn?.turnId ?? null,
    cancelledTurnId: lastTurn?.status === "CANCELLED" ? lastTurn.turnId : null,
    pendingUserMessage,
    pendingUserAt,
    pendingScope,
    approval,
    send,
    stop,
    switchChat,
    startNewChat,
    deleteChat,
    renameChat,
    isDeletingChat: deleteChatMutation.isPending,
    retry,
  };
}
