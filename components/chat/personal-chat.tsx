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
import { History, MessageCircle, Plus, X } from "lucide-react";

import { useRouter } from "next/navigation";

import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatList } from "@/components/chat/chat-list";
import type { MentionHandle } from "@/components/chat/mention-input";
import { ChatThread } from "@/components/chat/chat-thread";
import { Button } from "@/components/ui/button";
import { ScrollToBottomButton } from "@/components/heymoa/scroll-to-bottom-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { answerText } from "@/lib/chat/blocks";
import { scopeKey, type ScopeChip } from "@/lib/chat/scope-chip";
import { dropScopeMarkers } from "@/lib/chat/scope-marker";
import { useScopeCatalog } from "@/lib/chat/use-scope-catalog";
import { initialStreamState } from "@/lib/chat/stream-protocol";
import { useChatTurn } from "@/lib/chat/use-chat-turn";
import { useStickToBottom } from "@/lib/chat/use-stick-to-bottom";
import { cn } from "@/lib/utils";

/**
 * 노트 화면이 등록하는 스코프. `hidden` 은 side 모드에서 패널을 감추기 위한 것이다. 제목도 함께
 * 받는다 — 여기서 다시 조회하면 그 왕복 동안 칩이 늦게 붙는다.
 */
type NoteScope = { noteId: string; title: string | null; hidden: boolean };

type PersonalChatState = {
  isOpen: boolean;
  /** 열려 있고 감춰지지 않았을 때만 참. 셸이 본문 여백을 이걸로 정한다. */
  isVisible: boolean;
  /** 패널을 연다. 라우트가 감췄으면(`hidden`) 존중한다. */
  open: () => void;
  close: () => void;
  setNoteScope: (scope: NoteScope | null) => void;
  setTurnActive: (active: boolean) => void;
  /** 한 턴이 도는 중(답이 흐르거나 승인을 기다린다). 그동안 패널을 화면에서 치우면 안 된다. */
  isTurnActive: boolean;
  /** 노트 전체 화면의 레일이 내준 자리. 등록되면 떠 있는 카드 대신 그 자리에 그린다. */
  setRailSlot: (element: HTMLElement | null) => void;
};

const PersonalChatContext = createContext<PersonalChatState | null>(null);

/**
 * 여닫는 움직임. `visibility` 를 전이 목록에 넣어 들어올 때는 즉시 보이고 나갈 때는 끝까지 보이다가
 * 끝에서만 포커스·접근성 트리에서 빠진다. `display:none` 으로는 둘을 같이 못 한다. 언마운트는 금지다 —
 * 흐르는 화면과 중지·승인에 닿는 길을 잃는다. `starting:` 은 첫 마운트용이다.
 *
 * Tailwind v4 는 `translate-*`·`scale-*` 을 `transform` 이 아니라 개별 속성으로 내서 그 이름으로 적는다.
 */
const CHAT_MOTION =
  "transition-[opacity,translate,scale,visibility] duration-200 ease-out motion-reduce:transition-none";

/**
 * 스레드와 기록이 같은 자리에서 겹쳐 교대하는 움직임. `hidden` 을 쓰면 안 된다 — 스레드가 레이아웃에서
 * 빠지는 순간 `scrollHeight` 가 0 이 되어 `useStickToBottom` 이 붙들던 자리를 잃는다.
 */
const CHAT_VIEW_MOTION =
  "transition-[filter,opacity,scale,visibility] duration-200 ease-out motion-reduce:transition-none";

/** 나가는 쪽의 끝 상태. 잰 값이 아니라 브라우저에서 보고 고른 값이다. */
const CHAT_VIEW_OUT =
  "pointer-events-none invisible scale-[0.985] opacity-0 blur-[5px]";
const CHAT_VIEW_IN = "visible scale-100 opacity-100 blur-0";

export function usePersonalChat() {
  const context = useContext(PersonalChatContext);
  if (!context) {
    throw new Error("usePersonalChat must be used inside PersonalChatProvider");
  }
  return context;
}

/**
 * 노트 화면이 자기 스코프를 등록한다. full 이면 노트가 범위 힌트가 되고, side 면 감춘다 — 감출 뿐
 * 언마운트하지 않는다.
 */
export function usePersonalChatScope(scope: NoteScope | null) {
  const { setNoteScope } = usePersonalChat();
  const noteId = scope?.noteId ?? null;
  const title = scope?.title ?? null;
  const hidden = scope?.hidden ?? false;

  // 해제는 노트를 떠날 때만 한다. `hidden` 까지 의존성에 넣으면 full→side 전환에서 cleanup 이
  // 먼저 돌아 스코프를 지운다.
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
  workspaceName,
  children,
}: {
  workspaceId: string;
  workspaceName?: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  /** 한 번이라도 열었는가. 열기 전에는 마운트하지 않고(조회를 안 건다), 연 뒤에는 닫아도 유지한다. */
  const [hasOpened, setHasOpened] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scopeNote, setScopeNote] = useState<{
    noteId: string;
    title: string | null;
  } | null>(null);

  /** 포털이라 자리가 레일로 옮겨가도 패널 자신은 이 트리에 남아 흐르던 답이 안 끊긴다. */
  const [railSlot, setRailSlotState] = useState<HTMLElement | null>(null);
  const setRailSlot = useCallback((element: HTMLElement | null) => {
    setRailSlotState(element);
    // 레일에서 처음 열었어도 연 것이다. 안 세우면 레일을 떠나는 순간 패널이 언마운트된다
    if (element) setHasOpened(true);
  }, []);

  const wasHiddenRef = useRef(false);

  const setNoteScope = useCallback((scope: NoteScope | null) => {
    const nextHidden = scope?.hidden ?? false;
    // 회의록이 켜지는 순간에는 감추는 게 아니라 닫는다. 감추기만 하면 회의록을 끄는 순간 부르지 않은
    // 채팅이 다시 열린다. 켜진 동안 매번 닫으면 회의록을 둔 채로는 채팅을 못 여니 바뀌는 순간에만 닫는다.
    if (nextHidden && !wasHiddenRef.current) setIsOpen(false);
    wasHiddenRef.current = nextHidden;
    setHidden(nextHidden);
    // 노트 화면이 매 렌더 부르므로 같은 값이면 새 객체를 안 세운다
    setScopeNote((current) => {
      const next = scope ? { noteId: scope.noteId, title: scope.title } : null;
      if (current?.noteId === next?.noteId && current?.title === next?.title) {
        return current;
      }
      return next;
    });
  }, []);

  // 좁은 화면의 노트 레일이 이 값을 보고 답이 흐르는 동안 자기를 접지 않는다
  const [isTurnActive, setIsTurnActive] = useState(false);

  // 레일에 들어가 있으면 떠 있는 카드의 여닫기와 무관하다 — 레일 탭이 곧 열림이다.
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
    }),
    [hidden, isOpen, isTurnActive, railed, setNoteScope, setRailSlot]
  );

  return (
    <PersonalChatContext.Provider value={value}>
      {children}
      {/* FAB 는 패널과 자리를 주고받는 한 쌍이라 언마운트하지 않고 같은 길이로 물러난다. */}
      <Button
        size="icon"
        aria-label="개인 챗봇 열기"
        aria-hidden={fabHidden || undefined}
        inert={fabHidden}
        tabIndex={fabHidden ? -1 : undefined}
        onClick={value.open}
        className={cn(
          "fixed right-6 bottom-6 z-40 size-12 rounded-full shadow-e2",
          CHAT_MOTION,
          fabHidden
            ? "invisible scale-90 opacity-0"
            : "visible scale-100 opacity-100"
        )}
      >
        <MessageCircle className="size-5" />
      </Button>
      {hasOpened || railed ? (
        <PersonalChatPanel
          // 워크스페이스로만 키잉한다. 대화 id 를 넣으면 첫 전송이 대화를 만드는 순간 언마운트되어
          // 방금 연 스트림이 끊긴다. 대화를 갈아 끼울 때는 패널이 손으로 비운다.
          key={workspaceId}
          hidden={railed ? false : hidden || !isOpen}
          railSlot={railSlot}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          suggestedNote={scopeNote}
          onTurnActiveChange={setIsTurnActive}
          onClose={value.close}
        />
      ) : null}
    </PersonalChatContext.Provider>
  );
}

const EXAMPLE_QUESTIONS = [
  "지난 회의에서 정한 것만 정리해줘",
  "남은 액션 아이템이 뭐야?",
  "논의된 이슈를 Linear 이슈로 만들어줘",
];

function PersonalChatPanel({
  hidden,
  railSlot = null,
  workspaceId,
  workspaceName,
  suggestedNote,
  onTurnActiveChange,
  onClose,
}: {
  hidden: boolean;
  /** 있으면 이 자리로 포털한다. 노트 전체 화면의 「내 에이전트」 레일이다. */
  railSlot?: HTMLElement | null;
  workspaceId: string;
  workspaceName?: string;
  /** 회의록 화면이 미리 붙여 주는 칩. 강제가 아니다 — 사용자가 지우면 다시 안 붙는다. */
  suggestedNote: { noteId: string; title: string | null } | null;
  onTurnActiveChange: (active: boolean) => void;
  onClose: () => void;
}) {
  const turn = useChatTurn({ workspaceId, onTurnActiveChange });
  const {
    isBusy,
    send: sendTurn,
    switchChat: switchTurnChat,
    startNewChat: startTurnChat,
  } = turn;
  /** 스레드와 기록은 둘 다 마운트된 채 교대한다. 스레드를 내리면 흐르던 답과 스크롤 위치를 잃는다. */
  const [view, setView] = useState<"thread" | "history">("thread");

  /** 이 턴에 붙은 범위. 대화가 아니라 메시지가 갖는다. */
  const [chips, setChips] = useState<ScopeChip[]>([]);
  /** 편집기 손잡이. 문장과 칩이 한 DOM 에 있어 상태가 아니라 여기로 만진다. */
  const editorRef = useRef<MentionHandle | null>(null);
  /** 사용자가 손으로 지운 회의록. 기억하지 않으면 회의록을 나갔다 오는 것만으로 되살아난다. */
  const dismissedRef = useRef<Set<string>>(new Set());
  /** 이미 박아 넣은 프리필. 편집기가 자기 DOM 을 드니 두 번 넣지 않는다. */
  const prefilledRef = useRef<Set<string>>(new Set());
  /** 보내면서 비우는 동안 켠다. 그때 사라진 칩은 거절이 아니다. */
  const clearingForSendRef = useRef(false);

  const prefillSuggested = useCallback(() => {
    const noteId = suggestedNote?.noteId;
    const title = suggestedNote?.title;
    // 제목이 와야 붙는다 — id 만 있는 칩은 누른 사람이 무엇을 붙였는지 모른다
    if (!noteId || !title) return;
    if (dismissedRef.current.has(noteId)) return;
    if (prefilledRef.current.has(noteId)) return;
    prefilledRef.current.add(noteId);
    editorRef.current?.prepend({ kind: "note", id: noteId, title });
  }, [suggestedNote]);

  useEffect(() => prefillSuggested(), [prefillSuggested]);

  /** 칩이 사라졌으면 백스페이스로 지운 것이다. 프리필했던 회의록이면 거절로 기억한다. */
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

  /**
   * 못 보낸 문장을 컴포저로 되돌린다. 칩이 될 마커는 글자까지 지운다 — 칩을 다시 박으므로 남기면 같은
   * 이름이 칩 한 벌 + 날글자 한 벌로 선다. 보낼 때 다시 붙인 회의록 칩은 또 박지 않는다.
   */
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

  /** 다른 대화로 옮길 때 문장·범위와 지운 기억을 비운다. 회의록 안에 있으면 그 회의록이 다시 힌트다. */
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

  /**
   * 스크롤 뷰포트 높이. 마지막 질문 아래에 한 화면만큼 자리를 두어, 바닥으로 내리면 질문이 위에 서고
   * 답이 그 아래에서 흐르게 한다. `ResizeObserver` 가 같은 값을 여러 번 주므로 바뀔 때만 세운다.
   */
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
    // jsdom 에는 `ResizeObserver` 가 없다. 없으면 첫 측정만 한다
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
      // 확장 제안을 누른 것이면 문장의 칩도 같이 바뀐다
      const scope = override ?? chips;
      clearingForSendRef.current = true;
      editorRef.current?.clear();
      clearingForSendRef.current = false;
      // 회의록 안에 서 있으면 다음 질문에도 그 회의록이 힌트다
      prefilledRef.current.clear();
      prefillSuggested();
      // 방금 접힌 컴포저 높이를 여기서 잰다. `ResizeObserver` 는 한 렌더 늦어서, 질문 아래 자리가
      // 낡은 높이로 잡히고 부드러운 이동 창이 닫힌 뒤 한 프레임에 튄다. `clear()` 가 DOM 을 그 자리에서
      // 고쳐서 여기서 읽는 값은 이미 접힌 높이다.
      measureViewport();
      // 보내기는 사용자가 지금 한 행동이다. 위를 읽던 중이어도 질문을 따라 올라간다
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
      // 같은 대화를 다시 골랐어도 스레드로 돌아온다 — 누른 사람은 이 대화를 보겠다고 했다
      setView("thread");
      if (switchTurnChat(chatId)) resetComposer();
    },
    [resetComposer, switchTurnChat]
  );

  const startNewChat = useCallback(() => {
    setView("thread");
    if (startTurnChat()) resetComposer();
  }, [resetComposer, startTurnChat]);

  const router = useRouter();
  const openNote = useCallback(
    (noteId: string) => {
      router.push(`/w/${workspaceId}/notes/${noteId}?view=side&tab=details`);
    },
    [router, workspaceId]
  );

  // 목록은 `@` 를 치기 시작했거나 프로젝트 칩이 붙었을 때(겹침 판정)만 받는다. 프로젝트 수만큼
  // 조회가 나가는 팬아웃이라 열기만 해도 도는 것은 낭비다.
  const [mentioning, setMentioning] = useState(false);
  const needsCatalog =
    mentioning || chips.some((chip) => chip.kind === "project");
  const catalog = useScopeCatalog(workspaceId, needsCatalog);
  const takenScope = useMemo(() => new Set(chips.map(scopeKey)), [chips]);

  /** 회의록이 붙은 프로젝트 안에 있으면 알린다. 막지는 않는다 — 일부러 넓게 잡을 수 있다. */
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

  // 뷰가 갈리면 포커스를 손으로 옮긴다. 안 옮기면 키보드 포커스가 `invisible` 이 된 상자 안에 남는다.
  // 첫 렌더에서는 옮기지 않는다 — 열자마자 포커스를 빼앗을 이유가 없다.
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

  // 첫 전송 후 히스토리가 켜지는 동안에도 완료된 로컬 턴은 화면에 있다. 덮으면 말풍선이 번쩍인다
  const isThreadLoading = turn.isLoading && !turn.showingLocalTurn;
  /**
   * 마지막 질문 아래에 남길 자리. 아래 여백(`p-6` 의 24px)만 뺀다 — 위아래를 다 빼면 바닥까지 내려도
   * 앞 메시지의 끝줄이 위에 보인다. 이 대화에서 아직 안 보냈으면 주지 않는다.
   */
  const pinSlackPx =
    turn.pendingUserAt && viewportHeight
      ? Math.max(0, viewportHeight - 24)
      : null;

  /** 헤더 첫 줄. 아직 목록에 없는 새 대화는 기본 제목으로 선다. */
  const headerTitle =
    turn.chatRows.find((chat) => chat.chatId === turn.sessionId)?.title ??
    "새 대화";
  /** 첫 턴에서 server 가 제목을 지어 줄 때까지 「곧 바뀐다」를 빛으로 알린다. */
  const isTitlePending = headerTitle === "새 대화" && turn.isBusy;

  const retry = (
    <Button
      variant="outline"
      size="sm"
      className="h-[30px]"
      onClick={turn.retry}
    >
      다시 시도
    </Button>
  );

  const panel = (
    <aside
      data-testid="personal-chat-panel"
      data-hidden={hidden || undefined}
      data-railed={railSlot ? "" : undefined}
      aria-label="개인 챗봇"
      inert={hidden}
      className={cn(
        "flex min-h-0 flex-col bg-white",
        railSlot
          ? // 레일에 들어가면 테두리·radius·그림자와 여닫는 움직임은 레일이 갖는다
            "h-full w-full"
          : cn(
              // 부양 카드는 e2 2연타다. 단일 티어 0_4px_16px 는 흰 마케팅 면 전용이다
              "fixed top-2 right-2 bottom-2 z-30 w-[min(448px,calc(100vw-1rem))] rounded-panel border border-[var(--el-hairline)] shadow-e2",
              CHAT_MOTION,
              "starting:translate-x-4 starting:opacity-0",
              hidden
                ? "invisible translate-x-4 opacity-0"
                : "visible translate-x-0 opacity-100"
            )
      )}
    >
      <header
        className={cn(
          "flex items-center gap-1 border-b border-[var(--el-hairline)] pr-3 pl-6",
          railSlot ? "py-2" : "py-4"
        )}
      >
        <div className="min-w-0 flex-1">
          {/* 제목이 정해지면 `key` 가 바뀌어 다시 마운트되고, 마운트 애니메이션이 건너오기를 그린다.
              빛(정해지는 중)과 건너오기(정해졌다)는 둘 다 `animation` 이라 같이 못 선다. */}
          <p
            key={headerTitle}
            className={cn(
              "truncate text-sm font-medium",
              isTitlePending
                ? "chat-shimmer"
                : "chat-title-in text-[var(--el-ink)]"
            )}
          >
            {headerTitle}
          </p>
          {/* 참조 칩이 없으면 전체 범위를 알린다. 빈 부제 줄은 남기지 않는다. */}
          {chips.length ? null : (
            <p className="truncate text-[11px] text-[var(--el-muted)]">
              {`${workspaceName ?? "워크스페이스"} 전체`}
            </p>
          )}
        </div>
        {/* 대화 전환은 `isSwitchBlocked` 로 잠근다. `isBusy` 로 잠그면 답이 흐르는 동안 다른 대화를
            못 연다. */}
        <Button
          data-testid="chat-list-new"
          variant="ghost"
          size="icon"
          aria-label="새 대화"
          disabled={turn.isSwitchBlocked}
          onClick={startNewChat}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          ref={historyButtonRef}
          variant="ghost"
          size="icon"
          aria-label="기록"
          disabled={turn.isSwitchBlocked}
          onClick={() => setView("history")}
        >
          <History className="size-4" />
        </Button>
        {/* 레일에서는 탭이 자리를 가르므로 닫기가 없다. */}
        {railSlot ? null : (
          <Button
            variant="ghost"
            size="icon"
            aria-label="닫기"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
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
            overlay={
              atBottom ? null : (
                <ScrollToBottomButton
                  label="맨 아래로"
                  onClick={scrollToBottom}
                />
              )
            }
          >
            <div className="flex min-h-full flex-col justify-end p-6">
              {isThreadLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : turn.isUnavailable && !turn.showingLocalTurn ? (
                // 빈 상태로 그리면 이미 있는 대화를 없는 것처럼 보인다
                <div role="alert" className="space-y-2">
                  <p className="text-sm text-[var(--el-ink)]">
                    대화를 불러오지 못했습니다.
                  </p>
                  <p className="text-xs text-[var(--el-muted)]">
                    {turn.isChatsUnavailable
                      ? "기존 대화가 있는지 확인하지 못해 새 대화를 시작하지 않습니다."
                      : "이어서 보내면 화면과 실제 대화가 어긋나므로 전송을 막아 둡니다."}
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
                  // 히스토리가 돌려줄 모양으로 맞춘다 — 칩 kind 는 소문자, 히스토리는 대문자다
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
                  emptyState={
                    <div className="space-y-3">
                      <p className="text-sm text-[var(--el-body)]">
                        아직 시작된 대화가 없습니다.
                      </p>
                      <div className="flex flex-col items-start gap-1.5">
                        {EXAMPLE_QUESTIONS.map((question) => (
                          <button
                            key={question}
                            type="button"
                            disabled={turn.isBusy}
                            // 바로 안 보낸다. 붙여 둔 칩이 딸려 나가는 것이 뜻밖이라 문장만 넣는다
                            onClick={() => editorRef.current?.append(question)}
                            className="rounded-full border border-[var(--el-hairline)] px-3 py-1.5 text-xs text-[var(--el-body)] hover:bg-[var(--el-canvas-soft)]"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    </div>
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
            placeholder="@로 프로젝트·회의록을 참조해 물어보세요"
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
                    {`'${overlap.note.title}'는 '${overlap.project?.title ?? "그 프로젝트"}' 안에 있습니다. 회의록 칩만 남길까요?`}
                  </p>
                ) : null}
                {turn.stream.phase === "awaiting_approval" ? (
                  <p className="mt-2 text-xs text-[var(--el-muted)]">
                    승인을 기다리는 동안에는 입력할 수 없습니다.
                  </p>
                ) : null}
                {turn.isUnavailable && turn.showingLocalTurn ? (
                  <div
                    role="alert"
                    className="mt-2 flex items-center gap-2 text-xs text-[var(--el-muted)]"
                  >
                    <span>
                      {turn.isChatsUnavailable ? "대화 목록" : "대화 기록"}을
                      다시 읽지 못했습니다. 답변은 화면에 남아 있습니다.
                    </span>
                    <Button variant="outline" size="sm" onClick={turn.retry}>
                      다시 시도
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
            onBack={() => setView("thread")}
            backRef={backButtonRef}
          />
        </div>
      </div>
    </aside>
  );

  // 포털이라 이 컴포넌트는 그대로 남는다. 자리가 레일로 옮겨가도 옮겨지는 것은 DOM 뿐이다.
  return railSlot ? createPortal(panel, railSlot) : panel;
}
