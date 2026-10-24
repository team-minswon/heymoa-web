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
  /** 다음에 보일 때 빈 새 대화로 시작한다. 새 노트를 만들 때 부른다(APP-1278). */
  startFreshChat: () => void;
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
 * 스레드와 기록이 같은 자리에서 겹쳐 교대하는 움직임. 투명도와 아주 작은 크기 변화만 쓴다(합성만 하는 속성이라 레이아웃을
 * 다시 안 잰다). `hidden` 을 쓰면 안 된다 — 스레드가 레이아웃에서 빠지는 순간 `scrollHeight` 가 0 이 되어
 * `useStickToBottom` 이 붙들던 자리를 잃는다.
 */
const CHAT_VIEW_MOTION =
  "transition-[opacity,scale,visibility] duration-200 ease-out motion-reduce:transition-none";

/** 나가는 쪽의 끝 상태. 흐림은 쓰지 않는다 — 큰 면에 걸면 비싸고 「초점을 잡는다」로 읽힌다. */
const CHAT_VIEW_OUT = "pointer-events-none invisible scale-[0.985] opacity-0";
const CHAT_VIEW_IN = "visible scale-100 opacity-100";

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
  children,
}: {
  workspaceId: string;
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

  /**
   * 새 대화 요청이 아직 패널에 닿지 않았다. 패널이 대화 목록을 읽는 중이면 바로 못 옮기므로, 받을
   * 수 있을 때 패널이 소비하고 내린다.
   */
  const [freshChatPending, setFreshChatPending] = useState(false);
  const startFreshChat = useCallback(() => setFreshChatPending(true), []);
  const consumeFreshChat = useCallback(() => setFreshChatPending(false), []);

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
  /** 패널이 닫힌 동안 런처가 알릴 턴 상태(도는 중 · 승인 대기). */
  const [attention, setAttention] = useState<AgentAttention>(null);

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
      {/* FAB 는 패널과 자리를 주고받는 한 쌍이라 언마운트하지 않고 같은 길이로 물러난다. */}
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
          // 워크스페이스로만 키잉한다. 대화 id 를 넣으면 첫 전송이 대화를 만드는 순간 언마운트되어
          // 방금 연 스트림이 끊긴다. 대화를 갈아 끼울 때는 패널이 손으로 비운다.
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
  /** 있으면 이 자리로 포털한다. 노트 전체 화면의 「내 에이전트」 레일이다. */
  railSlot?: HTMLElement | null;
  workspaceId: string;
  /** 회의록 화면이 미리 붙여 주는 칩. 강제가 아니다 — 사용자가 지우면 다시 안 붙는다. */
  suggestedNote: { noteId: string; title: string | null } | null;
  /** 새 노트가 빈 새 대화를 요청했다. 이 요청을 안고 마운트되면 처음부터 빈 대화로 선다. */
  freshChatPending?: boolean;
  onFreshChatConsumed?: () => void;
  onTurnActiveChange: (active: boolean) => void;
  /** 닫힌 패널 대신 런처가 알릴 턴 상태. */
  onAttentionChange?: (attention: AgentAttention) => void;
  onClose: () => void;
}) {
  /** 서버에 없어 치운 대화. 열려 있던 대화면 쓰던 문장·범위도, 고치던 제목도 그 대화 것이라 비운다. */
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

  // 새 노트의 요청은 ＋ 와 같은 길로 받는다. 목록을 읽는 중이면 막혀 있으니 풀릴 때까지 들고
  // 있는다. 이미 빈 새 대화면 `startNewChat` 이 아무 일도 안 하므로 그대로 내린다.
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
      // 근거를 확인하러 누른 것이다 — 회의 정보 폼이 아니라 스크립트로 연다. 전체 화면이라 이 패널이 노트 옆 레일로
      // 옮겨 가 답과 원문을 나란히 본다(사이드 뷰는 패널을 감춘다). 근거에 발화 위치가 없어 스크립트 첫머리에 선다
      router.push(`/w/${workspaceId}/notes/${noteId}?view=full&tab=transcript`);
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

  const t = useTranslations("common.agentChat");

  /** 삭제를 확인 중인 대화(APP-1409). 기록 줄과 헤더가 함께 연다. */
  const [deleteTarget, setDeleteTarget] = useState<{
    chatId: string;
    title: string;
  } | null>(null);
  // 열려 있던 대화를 지웠는지는 지운 요청이 끝난 순간에 `useChatTurn` 이 가른다(`onChatForgotten`)
  const deleteChat = useCallback(
    (chatId: string) => turn.deleteChat(chatId, t("deleteFailed")),
    [t, turn]
  );

  /**
   * 헤더에서 이름을 고치는 중인 대화. 열린 대화가 아니라 **편집을 시작한 대화**를 쥔다 — 목록 재조회(`chats.changed`)로
   * 열린 대화가 바뀌어도 입력이 내려가지 않는다. 끝나는 것은 사용자가 끝냈거나 그 대화가 실제로 지워졌을 때뿐이다.
   */
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  /** 기록 줄에서 이름을 고치는 대화. 머리글 편집과 같은 규칙이다. */
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  useEffect(() => {
    forgottenRef.current = (chatId, wasOpen) => {
      if (wasOpen) resetComposer();
      setEditingTitleId((current) => (current === chatId ? null : current));
      setEditingRowId((current) => (current === chatId ? null : current));
    };
  });
  // 편집이 끝나면 제목 버튼으로 돌아간다. 입력이 사라지고 버튼이 다시 선 뒤라야 한다
  const titleButtonRef = useRef<HTMLButtonElement>(null);
  const focusTitleAfterEdit = useRef(false);
  /** 머리글 ⋯ 메뉴의 「이름 바꾸기」로 메뉴가 닫히는 중. 그때는 메뉴 버튼으로 포커스를 돌려주지 않는다. */
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

  /** 헤더 첫 줄. 아직 목록에 없는 새 대화는 기본 제목으로 선다. */
  const headerTitle =
    turn.chatRows.find((chat) => chat.chatId === turn.sessionId)?.title ??
    "새 대화";
  /** 고치는 중인 대화의 처음 제목. 입력은 처음 한 번만 읽으므로 그 뒤 바뀌어도 쓰던 글자를 덮지 않는다. */
  const editingTitle =
    turn.chatRows.find((chat) => chat.chatId === editingTitleId)?.title ??
    headerTitle;
  /**
   * 제목이 정해질 때까지 「곧 바뀐다」를 빛으로 알린다. 아직 목록에 없는 새 대화의 첫 턴이거나, AI 제목을 기다리는
   * 대화다(APP-1440) — 그동안 첫 질문 문장 대신 「새 대화」가 빛난다.
   */
  const isTitlePending =
    (turn.chatRows.find((chat) => chat.chatId === turn.sessionId)
      ?.titlePending ??
      false) ||
    (headerTitle === "새 대화" && turn.isBusy);
  const shownTitle = isTitlePending ? "새 대화" : headerTitle;

  // 닫힌 패널 대신 런처가 알린다. 승인 대기는 사람을 기다리는 중이라 따로 말한다
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

  /**
   * 예시 질문을 골랐다. 보내지 않고 입력창만 채운다 — 쓰던 글이 있으면 뒤에 덧붙인다. 붙은 칩은 그대로 두고, 예시가 기대는
   * 회의록이 아직 안 붙었으면 범위 칩으로 앞에 붙인다.
   */
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
      // 칩은 글자로도 읽힌다(`@[제목](noteId:…)`) — 마커를 걷어 내고 남는 글이 있을 때만 「쓰던 글」로 본다.
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

  /** 붙어 있는 회의록. 빈 대화의 예시가 이 회의 기준으로 선다. */
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
      다시 시도
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
      // 서버에 있는 대화만 이름을 바꾼다. 누르면 그 자리에서 고친다.
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
        {/* 제목이 정해지면 `key` 가 바뀌어 다시 마운트되고, 마운트 애니메이션이 건너오기를 그린다.
            빛(정해지는 중)과 건너오기(정해졌다)는 둘 다 `animation` 이라 같이 못 선다. */}
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
      // 캡처로 듣는다. 포커스를 받으면 뜨는 툴팁이 Esc 를 먼저 먹고 전파를 끊기 때문이다(툴팁은 함께 닫힌다).
      onKeyDownCapture={(event) => {
        // 글을 쓰는 자리(이름 편집 · 입력창)의 Esc 는 그 자리 것이다. 포털로 뜬 메뉴·확인창의 Esc 는 React 트리를 타고
        // 여기 오지만 DOM 으로는 패널 밖이라 거른다 — 메뉴를 닫는 Esc 가 화면까지 바꾸면 안 된다.
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
          ? // 레일에 들어가면 테두리·radius·그림자와 여닫는 움직임은 레일이 갖는다
            "h-full w-full"
          : cn(
              // 부양 카드는 e2 2연타다. 단일 티어 0_4px_16px 는 흰 마케팅 면 전용이다
              "fixed top-2 right-2 bottom-2 z-30 w-[min(448px,calc(100vw-1rem))] rounded-panel border border-[var(--el-hairline)] shadow-e2",
              // 좁은 화면에서는 떠 있는 카드가 아니라 화면 전체를 덮는 시트다 — 여백 8px 과 둥근 모서리가 읽는 폭만 깎는다
              "max-md:inset-0 max-md:w-full max-md:rounded-none max-md:border-0 max-md:shadow-none",
              CHAT_MOTION,
              "starting:translate-x-4 starting:opacity-0 max-md:starting:translate-x-0 max-md:starting:translate-y-4",
              hidden
                ? "invisible translate-x-4 opacity-0 max-md:translate-x-0 max-md:translate-y-4"
                : "visible translate-x-0 translate-y-0 opacity-100"
            )
      )}
    >
      {/* 머리글은 화면마다 하나다. 높이를 고정해 대화↔기록을 오가도 아래가 안 움직이고, 왼쪽 첫 버튼(기록 ↔ 뒤로)이
          같은 자리라 손이 안 움직인다. */}
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
            {/* 대화 전환은 `isSwitchBlocked` 로 잠근다. `isBusy` 로 잠그면 답이 흐르는 동안 다른 대화를 못 연다. */}
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
              {/* 아직 서버에 없는 빈 새 대화에는 바꿀 이름도 지울 것도 없다. 기록 줄과 같은 ⋯ 메뉴다. */}
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
                      // 「이름 바꾸기」로 닫히면 방금 연 입력에 포커스를 둔다
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
        {/* 레일에서는 닫기 대신 레일의 접기 버튼이 이 자리에 겹쳐 선다(`NoteAgentRail`) — 자리만 비워 둔다. */}
        {railSlot ? (
          <span
            aria-hidden
            className="size-[34px] shrink-0 pointer-coarse:size-11"
          />
        ) : (
          <ChatIconButton size="header" label={t("close")} onClick={onClose}>
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
            // 바닥 16px 을 흐려 컴포저 앞에서 글자가 칼로 자른 듯 끊기지 않게 한다. 바닥 여백(24px) 안이라 다 내리면 안 가린다
            // 가로로는 넘치지 않는다 — 끊을 자리가 없는 긴 URL·영문이 패널을 옆으로 밀면 안 된다. 코드 블록·표는 제 안에서
            // 가로로 스크롤한다
            viewportClassName="overflow-x-hidden [mask-image:linear-gradient(to_bottom,black_calc(100%-16px),transparent)]"
            overlay={
              <ScrollToBottomButton
                label="맨 아래로"
                placement="end"
                visible={!atBottom}
                onClick={scrollToBottom}
              />
            }
          >
            <div className="flex min-h-full flex-col justify-end px-5 pt-5 pb-6">
              {isThreadLoading ? (
                // 대화의 모양 그대로 — 오른쪽 내 말풍선 하나와 왼쪽 답 몇 줄(`ChatThread` 의 `gap-5` · 말풍선 `rounded-panel`).
                // 막대 세 줄만 세우면 도착할 때 말풍선이 옆에서 끼어들어 자리가 바뀐 것처럼 보였다 (APP-1212).
                <div
                  aria-label="대화 불러오는 중"
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
                // 빈 상태로 그리면 이미 있는 대화를 없는 것처럼 보인다
                <div role="alert" className="space-y-2">
                  <p className="text-sm text-[var(--el-ink)]">
                    대화를 불러오지 못했어요.
                  </p>
                  <p className="text-xs leading-relaxed text-[var(--el-muted)]">
                    {turn.isChatsUnavailable
                      ? "기존 대화가 있는지 확인하지 못해 새 대화를 시작하지 않아요."
                      : "이어서 보내면 화면과 실제 대화가 어긋나서 전송을 막아 두었어요."}
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
                  cancelledTurnId={turn.cancelledTurnId}
                  emptyState={
                    <ChatStarter
                      workspaceId={workspaceId}
                      context={contextNote}
                      // 답을 만드는 중 · 승인을 기다리는 중 · 대화를 못 읽은 때는 보낼 수 없다
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
                    {`'${overlap.note.title}'는 '${overlap.project?.title ?? "그 프로젝트"}' 안에 있어요. 회의록 칩만 남길까요?`}
                  </p>
                ) : null}
                {turn.stream.phase === "awaiting_approval" ? (
                  <p className="mt-2 text-xs text-[var(--el-muted)]">
                    승인을 기다리는 동안에는 보낼 수 없어요.
                  </p>
                ) : null}
                {turn.isUnavailable && turn.showingLocalTurn ? (
                  <div
                    role="alert"
                    className="mt-2 flex items-center gap-2 text-xs text-[var(--el-muted)]"
                  >
                    <span>
                      {turn.isChatsUnavailable ? "대화 목록" : "대화 기록"}을
                      다시 읽지 못했어요. 답은 화면에 남아 있어요.
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

  // 포털이라 이 컴포넌트는 그대로 남는다. 자리가 레일로 옮겨가도 옮겨지는 것은 DOM 뿐이다.
  return railSlot ? createPortal(panel, railSlot) : panel;
}
