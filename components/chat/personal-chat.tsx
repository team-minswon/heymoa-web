"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, History, MoreHorizontal, Plus, X } from "lucide-react";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { AgentFab, type AgentAttention } from "@/components/chat/agent-fab";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatDeleteDialog } from "@/components/chat/chat-delete-dialog";
import {
  CHAT_ICON_BUTTON_LOOK,
  CHAT_ICON_BUTTON_SIZE,
  ChatIconButton,
} from "@/components/chat/chat-icon-button";
import { ChatList, ChatMenuItems } from "@/components/chat/chat-list";
import { ChatTitleInput } from "@/components/chat/chat-title-input";
import { ChatStarter, type ChatExample } from "@/components/chat/chat-starter";
import type { MentionHandle } from "@/components/chat/mention-input";
import { ChatThread } from "@/components/chat/chat-thread";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollToBottomButton } from "@/components/heymoa/scroll-to-bottom-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics/track";
import { answerText } from "@/lib/chat/blocks";
import { scopeKey, type ScopeChip } from "@/lib/chat/scope-chip";
import { dropScopeMarkers } from "@/lib/chat/scope-marker";
import { useScopeCatalog } from "@/lib/chat/use-scope-catalog";
import { initialStreamState } from "@/lib/chat/stream-protocol";
import { useChatTurn } from "@/lib/chat/use-chat-turn";
import { useStickToBottom } from "@/lib/chat/use-stick-to-bottom";
import { cn } from "@/lib/utils";

type NoteScope = { noteId: string; title: string | null; hidden: boolean };

type PersonalChatState = {
  isOpen: boolean;
  isVisible: boolean;
  open: () => void;
  close: () => void;
  setNoteScope: (scope: NoteScope | null) => void;
  setTurnActive: (active: boolean) => void;
  isTurnActive: boolean;
  setRailSlot: (element: HTMLElement | null) => void;
  startFreshChat: () => void;
};

const PersonalChatContext = createContext<PersonalChatState | null>(null);

/**
 * 여닫는 움직임. `visibility` 를 전이 목록에 넣어 나갈 때 끝까지 보이다가 끝에서만 포커스에서 빠진다.
 *
 * Tailwind v4 는 `translate-*`·`scale-*` 을 `transform` 이 아니라 개별 속성으로 내서 그 이름으로 적는다.
 */
const CHAT_MOTION =
  "transition-[opacity,translate,scale,visibility] duration-200 ease-out motion-reduce:transition-none";

/**
 * 스레드와 기록이 같은 자리에서 겹쳐 교대하는 움직임. 투명도와 아주 작은 크기 변화만 쓴다(합성만 하는 속성이라 레이아웃을
 * 다시 안 잰다). `hidden` 을 쓰면 안 된다 — 스레드가 레이아웃에서 빠지는 순간 `scrollHeight` 가 0 이 되어
 * `useStickToBottom` 이 붙들던 자리를 잃는다.
 */
const CHAT_VIEW_MOTION =
  "transition-[opacity,scale,visibility] duration-200 ease-out motion-reduce:transition-none";

const CHAT_VIEW_OUT = "pointer-events-none invisible scale-[0.985] opacity-0";
const CHAT_VIEW_IN = "visible scale-100 opacity-100";

export function usePersonalChat() {
  const context = useContext(PersonalChatContext);
  if (!context) {
    throw new Error("usePersonalChat must be used inside PersonalChatProvider");
  }
  return context;
}

export function usePersonalChatScope(scope: NoteScope | null) {
  const { setNoteScope } = usePersonalChat();
  const noteId = scope?.noteId ?? null;
  const title = scope?.title ?? null;
  const hidden = scope?.hidden ?? false;

  useEffect(() => {
    if (!noteId) return;
    return () => setNoteScope(null);
  }, [noteId, setNoteScope]);

  useEffect(() => {
    setNoteScope(noteId ? { noteId, title, hidden } : null);
  }, [hidden, noteId, setNoteScope, title]);
}

export function PersonalChatProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scopeNote, setScopeNote] = useState<{
    noteId: string;
    title: string | null;
  } | null>(null);

  const [railSlot, setRailSlotState] = useState<HTMLElement | null>(null);
  const setRailSlot = useCallback((element: HTMLElement | null) => {
    setRailSlotState(element);
    if (element) setHasOpened(true);
  }, []);

  const [freshChatPending, setFreshChatPending] = useState(false);
  const startFreshChat = useCallback(() => setFreshChatPending(true), []);
  const consumeFreshChat = useCallback(() => setFreshChatPending(false), []);

  const wasHiddenRef = useRef(false);

  const setNoteScope = useCallback((scope: NoteScope | null) => {
    const nextHidden = scope?.hidden ?? false;
    if (nextHidden && !wasHiddenRef.current) setIsOpen(false);
    wasHiddenRef.current = nextHidden;
    setHidden(nextHidden);
    setScopeNote((current) => {
      const next = scope ? { noteId: scope.noteId, title: scope.title } : null;
      if (current?.noteId === next?.noteId && current?.title === next?.title) {
        return current;
      }
      return next;
    });
  }, []);

  const [isTurnActive, setIsTurnActive] = useState(false);
  const [attention, setAttention] = useState<AgentAttention>(null);

  const railed = railSlot !== null;
  const fabHidden = hidden || isOpen || railed;

  const value = useMemo<PersonalChatState>(
    () => ({
      isOpen,
      isVisible: isOpen && !hidden && !railed,
      open: () => {
        setHasOpened(true);
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
      setNoteScope,
      setTurnActive: setIsTurnActive,
      isTurnActive,
      setRailSlot,
      startFreshChat,
    }),
    [
      hidden,
      isOpen,
      isTurnActive,
      railed,
      setNoteScope,
      setRailSlot,
      startFreshChat,
    ]
  );

  return (
    <PersonalChatContext.Provider value={value}>
      {children}
      <AgentFab
        hidden={fabHidden}
        engaged={hasOpened || railed}
        attention={attention}
        onOpen={value.open}
        className={cn(
          CHAT_MOTION,
          fabHidden
            ? "invisible scale-90 opacity-0"
            : "visible scale-100 opacity-100"
        )}
      />
      {hasOpened || railed ? (
        <PersonalChatPanel
          key={workspaceId}
          hidden={railed ? false : hidden || !isOpen}
          railSlot={railSlot}
          workspaceId={workspaceId}
          suggestedNote={scopeNote}
          freshChatPending={freshChatPending}
          onFreshChatConsumed={consumeFreshChat}
          onTurnActiveChange={setIsTurnActive}
          onAttentionChange={setAttention}
          onClose={value.close}
        />
      ) : null}
    </PersonalChatContext.Provider>
  );
}

function PersonalChatPanel({
  hidden,
  railSlot = null,
  workspaceId,
  suggestedNote,
  freshChatPending = false,
  onFreshChatConsumed,
  onTurnActiveChange,
  onAttentionChange,
  onClose,
}: {
  hidden: boolean;
  railSlot?: HTMLElement | null;
  workspaceId: string;
  suggestedNote: { noteId: string; title: string | null } | null;
  freshChatPending?: boolean;
  onFreshChatConsumed?: () => void;
  onTurnActiveChange: (active: boolean) => void;
  onAttentionChange?: (attention: AgentAttention) => void;
  onClose: () => void;
}) {
  const forgottenRef = useRef<(chatId: string, wasOpen: boolean) => void>(
    () => {}
  );
  const turn = useChatTurn({
    workspaceId,
    onTurnActiveChange,
    startAsDraft: freshChatPending,
    onChatForgotten: (chatId, wasOpen) => forgottenRef.current(chatId, wasOpen),
  });
  const {
    isBusy,
    send: sendTurn,
    switchChat: switchTurnChat,
    startNewChat: startTurnChat,
  } = turn;
  const [view, setView] = useState<"thread" | "history">("thread");

  const [chips, setChips] = useState<ScopeChip[]>([]);
  const editorRef = useRef<MentionHandle | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const prefilledRef = useRef<Set<string>>(new Set());
  const clearingForSendRef = useRef(false);

  const prefillSuggested = useCallback(() => {
    const noteId = suggestedNote?.noteId;
    const title = suggestedNote?.title;
    prefilledRef.current.forEach((id) => {
      if (id === noteId) return;
      prefilledRef.current.delete(id);
      editorRef.current?.remove({ kind: "note", id, title: "" });
    });
    if (!noteId || !title) return;
    if (dismissedRef.current.has(noteId)) return;
    if (prefilledRef.current.has(noteId)) return;
    if (
      editorRef.current
        ?.read()
        .chips.some((chip) => chip.kind === "note" && chip.id === noteId)
    )
      return;
    prefilledRef.current.add(noteId);
    editorRef.current?.prepend({ kind: "note", id: noteId, title });
  }, [suggestedNote]);

  useEffect(() => prefillSuggested(), [prefillSuggested]);

  const handleChipsChange = useCallback((next: ScopeChip[]) => {
    if (!clearingForSendRef.current) {
      const present = new Set(next.map(scopeKey));
      prefilledRef.current.forEach((noteId) => {
        if (!present.has(scopeKey({ kind: "note", id: noteId })))
          dismissedRef.current.add(noteId);
      });
    }
    setChips(next);
  }, []);

  const restoreComposer = useCallback((message: string, scope: ScopeChip[]) => {
    editorRef.current?.append(
      dropScopeMarkers(message, new Set(scope.map((chip) => chip.id)))
    );
    const present = new Set(
      (editorRef.current?.read().chips ?? []).map(scopeKey)
    );
    scope
      .filter((chip) => !present.has(scopeKey(chip)))
      .forEach((chip) => editorRef.current?.prepend(chip));
    setChips(scope);
  }, []);

  const resetComposer = useCallback(() => {
    editorRef.current?.clear();
    setChips([]);
    dismissedRef.current.clear();
    prefilledRef.current.clear();
    prefillSuggested();
  }, [prefillSuggested]);

  const { viewportRef, atBottom, scrollToBottom, scrollToSent } =
    useStickToBottom(
      `${turn.messageCount}:${turn.pendingUserMessage ?? ""}:${answerText(turn.stream.blocks)}:${turn.stream.blocks.length}`
    );

  const [viewportHeight, setViewportHeight] = useState(0);
  const measureViewport = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setViewportHeight((current) =>
      current === viewport.clientHeight ? current : viewport.clientHeight
    );
  }, [viewportRef]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    measureViewport();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measureViewport);
    observer?.observe(viewport);
    return () => observer?.disconnect();
  }, [measureViewport, viewportRef]);

  const send = useCallback(
    async (text: string, override?: ScopeChip[]) => {
      const message = text.trim();
      if (!message || isBusy) return;
      const scope = override ?? chips;
      clearingForSendRef.current = true;
      editorRef.current?.clear();
      clearingForSendRef.current = false;
      prefilledRef.current.clear();
      prefillSuggested();
      measureViewport();
      scrollToSent();
      if (!(await sendTurn(message, scope))) restoreComposer(message, scope);
    },
    [
      chips,
      isBusy,
      measureViewport,
      prefillSuggested,
      restoreComposer,
      scrollToSent,
      sendTurn,
    ]
  );

  const switchChat = useCallback(
    (chatId: string) => {
      setView("thread");
      if (switchTurnChat(chatId)) resetComposer();
    },
    [resetComposer, switchTurnChat]
  );

  const startNewChat = useCallback(() => {
    setView("thread");
    if (startTurnChat()) resetComposer();
  }, [resetComposer, startTurnChat]);

  useEffect(() => {
    if (!freshChatPending || turn.isSwitchBlocked) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 바깥(새 노트)의 요청을 막힘이 풀린 뒤에 한 번 받는다
    startNewChat();
    onFreshChatConsumed?.();
  }, [
    freshChatPending,
    onFreshChatConsumed,
    startNewChat,
    turn.isSwitchBlocked,
  ]);

  const router = useRouter();
  const openNote = useCallback(
    (noteId: string) => {
      router.push(`/w/${workspaceId}/notes/${noteId}?view=full&tab=transcript`);
    },
    [router, workspaceId]
  );

  const [mentioning, setMentioning] = useState(false);
  const needsCatalog =
    mentioning || chips.some((chip) => chip.kind === "project");
  const catalog = useScopeCatalog(workspaceId, needsCatalog);
  const takenScope = useMemo(() => new Set(chips.map(scopeKey)), [chips]);

  const overlap = useMemo(() => {
    const projectIds = new Set(
      chips.filter((chip) => chip.kind === "project").map((chip) => chip.id)
    );
    if (projectIds.size === 0) return null;
    const inside = chips.find(
      (chip) =>
        chip.kind === "note" &&
        catalog.notes.some(
          (note) =>
            note.id === chip.id &&
            note.projectId &&
            projectIds.has(note.projectId)
        )
    );
    if (!inside) return null;
    const parent = catalog.notes.find((note) => note.id === inside.id);
    const project = chips.find(
      (chip) => chip.kind === "project" && chip.id === parent?.projectId
    );
    return { note: inside, project };
  }, [catalog.notes, chips]);

  const historyButtonRef = useRef<HTMLButtonElement | null>(null);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const viewSettledRef = useRef(false);
  useEffect(() => {
    if (!viewSettledRef.current) {
      viewSettledRef.current = true;
      return;
    }
    const target = view === "history" ? backButtonRef : historyButtonRef;
    target.current?.focus();
  }, [view]);

  const isThreadLoading = turn.isLoading && !turn.showingLocalTurn;
  const pinSlackPx =
    turn.pendingUserAt && viewportHeight
      ? Math.max(0, viewportHeight - 24)
      : null;

  const t = useTranslations("chat");
  const tActions = useTranslations("common.actions");

  const [deleteTarget, setDeleteTarget] = useState<{
    chatId: string;
    title: string;
  } | null>(null);
  const deleteChat = useCallback(
    (chatId: string) => turn.deleteChat(chatId, t("deleteFailed")),
    [t, turn]
  );

  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  useEffect(() => {
    forgottenRef.current = (chatId, wasOpen) => {
      if (wasOpen) resetComposer();
      setEditingTitleId((current) => (current === chatId ? null : current));
      setEditingRowId((current) => (current === chatId ? null : current));
    };
  });
  const titleButtonRef = useRef<HTMLButtonElement>(null);
  const focusTitleAfterEdit = useRef(false);
  const menuRenameRef = useRef(false);
  useEffect(() => {
    if (editingTitleId !== null || !focusTitleAfterEdit.current) return;
    focusTitleAfterEdit.current = false;
    titleButtonRef.current?.focus();
  }, [editingTitleId]);
  const renameChat = useCallback(
    (chatId: string, title: string) =>
      void turn.renameChat(chatId, title, t("renameFailed")),
    [t, turn]
  );

  const headerTitle =
    turn.chatRows.find((chat) => chat.chatId === turn.sessionId)?.title ??
    t("newChat");
  const editingTitle =
    turn.chatRows.find((chat) => chat.chatId === editingTitleId)?.title ??
    headerTitle;
  const isTitlePending =
    (turn.chatRows.find((chat) => chat.chatId === turn.sessionId)
      ?.titlePending ??
      false) ||
    (headerTitle === t("newChat") && turn.isBusy);
  const shownTitle = isTitlePending ? t("newChat") : headerTitle;

  const attention: AgentAttention =
    turn.stream.phase === "awaiting_approval"
      ? "approval"
      : turn.isStreaming || (turn.isBusy && turn.pendingUserMessage !== null)
        ? "running"
        : null;
  useEffect(() => {
    onAttentionChange?.(attention);
  }, [attention, onAttentionChange]);
  useEffect(() => () => onAttentionChange?.(null), [onAttentionChange]);

  const pickExample = useCallback(
    (example: ChatExample) => {
      track("chat_example_clicked", {
        workspace_id: workspaceId,
        kind: example.kind,
        state: example.state,
      });
      const draft = editorRef.current?.read();
      const scope = example.scope;
      if (
        scope &&
        !draft?.chips.some((chip) => scopeKey(chip) === scopeKey(scope))
      )
        editorRef.current?.prepend(scope);
      const written = draft
        ? dropScopeMarkers(
            draft.text,
            new Set(draft.chips.map((chip) => chip.id))
          ).trim()
        : "";
      editorRef.current?.append(
        written ? ` ${example.question}` : example.question
      );
    },
    [workspaceId]
  );

  const noteChip = chips.find((chip) => chip.kind === "note");
  const contextNote = noteChip
    ? { noteId: noteChip.id, title: noteChip.title }
    : null;

  const retry = (
    <Button
      variant="outline"
      size="sm"
      className="h-[30px]"
      onClick={turn.retry}
    >
      {tActions("retry")}
    </Button>
  );

  const titleBlock =
    editingTitleId !== null ? (
      <ChatTitleInput
        initial={editingTitle}
        label={t("titleInput")}
        onSubmit={(title) => renameChat(editingTitleId, title)}
        onDone={(restoreFocus) => {
          focusTitleAfterEdit.current = restoreFocus;
          setEditingTitleId(null);
        }}
        className="h-8 font-medium"
      />
    ) : (
      <button
        ref={titleButtonRef}
        type="button"
        disabled={!turn.sessionId}
        aria-label={
          isTitlePending
            ? t("titlePending")
            : turn.sessionId
              ? `${t("editTitle")}: ${headerTitle}`
              : undefined
        }
        aria-busy={isTitlePending || undefined}
        title={shownTitle}
        onClick={() => setEditingTitleId(turn.sessionId)}
        className="flex h-8 w-full min-w-0 items-center rounded-control px-2 text-left outline-none enabled:cursor-text enabled:hover:bg-[var(--el-canvas-soft)] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
      >
        <span
          key={isTitlePending ? "" : headerTitle}
          className={cn(
            "truncate text-sm font-medium",
            isTitlePending
              ? "chat-shimmer"
              : "chat-title-in text-[var(--el-ink)]"
          )}
        >
          {shownTitle}
        </span>
      </button>
    );

  const panel = (
    <aside
      data-testid="personal-chat-panel"
      data-hidden={hidden || undefined}
      data-railed={railSlot ? "" : undefined}
      aria-label={t("panelLabel")}
      inert={hidden}
      onKeyDownCapture={(event) => {
        const target = event.target as HTMLElement;
        if (
          event.key !== "Escape" ||
          view !== "history" ||
          !event.currentTarget.contains(target) ||
          target.closest("input, textarea, [contenteditable='true']")
        )
          return;
        event.preventDefault();
        setView("thread");
      }}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-[var(--el-surface-card)]",
        railSlot
          ? "h-full w-full"
          : cn(
              "fixed top-2 right-2 bottom-2 z-30 w-[min(448px,calc(100vw-1rem))] rounded-panel border border-[var(--el-hairline)] shadow-e2",
              "max-md:inset-0 max-md:w-full max-md:rounded-none max-md:border-0 max-md:shadow-none",
              CHAT_MOTION,
              "starting:translate-x-4 starting:opacity-0 max-md:starting:translate-x-0 max-md:starting:translate-y-4",
              hidden
                ? "invisible translate-x-4 opacity-0 max-md:translate-x-0 max-md:translate-y-4"
                : "visible translate-x-0 translate-y-0 opacity-100"
            )
      )}
    >
      <header
        className={cn(
          "flex shrink-0 items-center gap-0.5 border-b border-[var(--el-hairline)] px-3",
          railSlot ? "h-12" : "h-[52px]"
        )}
      >
        {view === "history" ? (
          <>
            <ChatIconButton
              ref={backButtonRef}
              size="header"
              label={t("back")}
              onClick={() => setView("thread")}
            >
              <ArrowLeft aria-hidden />
            </ChatIconButton>
            <h2 className="min-w-0 flex-1 truncate px-2 text-sm font-medium text-[var(--el-ink)]">
              {t("history.title")}
            </h2>
          </>
        ) : (
          <>
            <ChatIconButton
              ref={historyButtonRef}
              size="header"
              label={t("openHistory")}
              disabled={turn.isSwitchBlocked}
              onClick={() => setView("history")}
            >
              <History aria-hidden />
            </ChatIconButton>
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              <div className="min-w-0 flex-1">{titleBlock}</div>
              {turn.sessionId && editingTitleId === null ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    data-testid="chat-menu"
                    aria-label={t("chatMenu")}
                    disabled={turn.isSwitchBlocked || turn.isDeletingChat}
                    className={cn(
                      CHAT_ICON_BUTTON_LOOK,
                      CHAT_ICON_BUTTON_SIZE.md,
                      "text-[var(--el-muted)]"
                    )}
                  >
                    <MoreHorizontal aria-hidden />
                  </DropdownMenuTrigger>
                  <ChatMenuItems
                    align="start"
                    onRename={() => {
                      menuRenameRef.current = true;
                      setEditingTitleId(turn.sessionId);
                    }}
                    onDelete={() => {
                      if (!turn.sessionId) return;
                      setDeleteTarget({
                        chatId: turn.sessionId,
                        title: headerTitle,
                      });
                    }}
                    finalFocus={() => {
                      const restore = !menuRenameRef.current;
                      menuRenameRef.current = false;
                      return restore;
                    }}
                  />
                </DropdownMenu>
              ) : null}
            </div>
          </>
        )}
        <ChatIconButton
          data-testid="chat-list-new"
          size="header"
          label={t("newChat")}
          disabled={turn.isSwitchBlocked}
          onClick={startNewChat}
        >
          <Plus aria-hidden />
        </ChatIconButton>
        {railSlot ? (
          <span
            aria-hidden
            className="size-[34px] shrink-0 pointer-coarse:size-11"
          />
        ) : (
          <ChatIconButton
            size="header"
            label={tActions("close")}
            onClick={onClose}
          >
            <X aria-hidden />
          </ChatIconButton>
        )}
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          data-testid="chat-thread-view"
          inert={view === "history"}
          className={cn(
            "absolute inset-0 flex flex-col",
            CHAT_VIEW_MOTION,
            view === "history" ? CHAT_VIEW_OUT : CHAT_VIEW_IN
          )}
        >
          <ScrollArea
            className="min-h-0 flex-1"
            viewportRef={viewportRef}
            quietScrollbar
            viewportClassName="overflow-x-hidden [mask-image:linear-gradient(to_bottom,black_calc(100%-16px),transparent)]"
            overlay={
              <ScrollToBottomButton
                label={t("panel.scrollToBottom")}
                visible={!atBottom}
                onClick={scrollToBottom}
              />
            }
          >
            <div className="flex min-h-full flex-col justify-end px-5 pt-5 pb-6">
              {isThreadLoading ? (
                <div
                  aria-label={t("panel.loading")}
                  className="flex flex-1 flex-col justify-end gap-5"
                >
                  <div className="flex justify-end">
                    <Skeleton className="h-10 w-1/2 rounded-panel" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ) : turn.isUnavailable && !turn.showingLocalTurn ? (
                <div role="alert" className="space-y-2">
                  <p className="text-sm text-[var(--el-ink)]">
                    {t("panel.loadFailed")}
                  </p>
                  <p className="text-xs leading-relaxed text-[var(--el-muted)]">
                    {turn.isChatsUnavailable
                      ? t("panel.loadFailedChats")
                      : t("panel.loadFailedMessages")}
                  </p>
                  {retry}
                </div>
              ) : (
                <ChatThread
                  messages={turn.threadMessages}
                  stream={
                    turn.isTurnReconciled ? initialStreamState : turn.stream
                  }
                  pendingUserMessage={
                    turn.isTurnReconciled ? null : turn.pendingUserMessage
                  }
                  pendingUserAt={turn.pendingUserAt}
                  pinSlackPx={pinSlackPx}
                  pendingUserScope={turn.pendingScope.map((chip) => ({
                    kind: chip.kind.toUpperCase() as "NOTE" | "PROJECT",
                    id: chip.id,
                    title: chip.title,
                    unavailable: false,
                  }))}
                  onApprove={turn.approval.approve}
                  approvalCard={turn.approval.card}
                  onOpenNote={openNote}
                  activeTurnId={turn.activeTurnId}
                  cancelledTurnId={turn.cancelledTurnId}
                  emptyState={
                    <ChatStarter
                      workspaceId={workspaceId}
                      context={contextNote}
                      disabled={
                        turn.isBusy ||
                        turn.isUnavailable ||
                        turn.stream.phase === "awaiting_approval"
                      }
                      onPick={pickExample}
                    />
                  }
                />
              )}
            </div>
          </ScrollArea>

          <ChatComposer
            inputRef={editorRef}
            onSubmit={(draft) => void send(draft.text, draft.chips)}
            onStop={turn.stop}
            isBusy={turn.isBusy}
            isStreaming={turn.isStreaming}
            placeholder={t("panel.placeholder")}
            onChipsChange={handleChipsChange}
            onMentioningChange={setMentioning}
            scope={{
              candidates: { projects: catalog.projects, notes: catalog.notes },
              isPending: catalog.isPending,
              taken: takenScope,
            }}
            footer={
              <>
                {overlap ? (
                  <p className="mt-2 text-xs text-[var(--el-muted)]">
                    {t("panel.overlap", {
                      note: overlap.note.title,
                      project:
                        overlap.project?.title ??
                        t("panel.overlapProjectFallback"),
                    })}
                  </p>
                ) : null}
                {turn.stream.phase === "awaiting_approval" ? (
                  <p className="mt-2 text-xs text-[var(--el-muted)]">
                    {t("panel.awaitingApproval")}
                  </p>
                ) : null}
                {turn.isUnavailable && turn.showingLocalTurn ? (
                  <div
                    role="alert"
                    className="mt-2 flex items-center gap-2 text-xs text-[var(--el-muted)]"
                  >
                    <span>
                      {turn.isChatsUnavailable
                        ? t("panel.refetchFailedChats")
                        : t("panel.refetchFailedMessages")}
                    </span>
                    <Button variant="outline" size="sm" onClick={turn.retry}>
                      {tActions("retry")}
                    </Button>
                  </div>
                ) : null}
              </>
            }
          />
        </div>

        <div
          data-testid="chat-history-view"
          inert={view !== "history"}
          className={cn(
            "absolute inset-0 flex flex-col",
            CHAT_VIEW_MOTION,
            view === "history" ? CHAT_VIEW_IN : CHAT_VIEW_OUT
          )}
        >
          <ChatList
            chats={turn.chatRows}
            currentChatId={turn.sessionId}
            onSelect={switchChat}
            onDelete={(chat) =>
              setDeleteTarget({ chatId: chat.chatId, title: chat.title })
            }
            onRename={renameChat}
            onNewChat={startNewChat}
            editingId={editingRowId}
            onEditingChange={setEditingRowId}
            hasMore={turn.hasMoreChats}
            isLoadingMore={turn.isLoadingMoreChats}
            onLoadMore={() => void turn.loadMoreChats()}
          />
        </div>
      </div>
      <ChatDeleteDialog
        target={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={deleteChat}
      />
    </aside>
  );

  return railSlot ? createPortal(panel, railSlot) : panel;
}
