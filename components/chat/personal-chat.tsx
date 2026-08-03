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
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Plus, X } from "lucide-react";

import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatThread } from "@/components/chat/chat-thread";
import { Button } from "@/components/ui/button";
import { ScrollToBottomButton } from "@/components/heymoa/scroll-to-bottom-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGetActiveAgentChatQueryKey,
  getGetAgentChatMessagesQueryOptions,
  getSendAgentChatMessageUrl,
  useCreateAgentChat,
  useGetActiveAgentChat,
  useGetAgentChatMessages,
} from "@/lib/api/generated/agent-chat/agent-chat";
import { errorCodeOf } from "@/lib/api/error-message";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import { initialStreamState } from "@/lib/chat/stream-protocol";
import { useChatStream } from "@/lib/chat/use-chat-stream";
import { useStickToBottom } from "@/lib/chat/use-stick-to-bottom";
import { useToolApproval } from "@/lib/chat/use-tool-approval";
import { cn } from "@/lib/utils";

/** 노트 화면이 등록하는 스코프. `hidden`은 side 모드(Sheet)에서 패널을 감추기 위한 것이다. */
type NoteScope = { noteId: string; hidden: boolean };

type PersonalChatState = {
  isOpen: boolean;
  /** 열려 있고 감춰지지 않았을 때만 참. 셸이 본문 여백을 이걸로 정한다. */
  isVisible: boolean;
  /** 패널을 연다. 라우트가 감췄으면(`hidden`) 존중한다 — ENDED에서는 감추지 않는다. */
  open: () => void;
  close: () => void;
  setNoteScope: (scope: NoteScope | null) => void;
  /** 패널이 한 턴을 굴리는 동안 참. 그 사이 스코프 전환은 미뤄진다. */
  setTurnActive: (active: boolean) => void;
  /**
   * 지금 개인 챗봇이 한 턴을 굴리고 있는가. 답변이 흐르거나 도구 승인을 기다리는 동안
   * **패널을 화면에서 치우면 안 된다** — 중지도 승인도 그 안에만 있다.
   */
  isTurnActive: boolean;
  /**
   * 노트 전체 화면의 레일이 「내 에이전트」 자리를 내준다(design.pen `L4PpR`).
   * 등록되면 떠 있는 카드 대신 **그 자리에** 그린다 — 챗 UI 둘이 겹치지 않게.
   */
  setRailSlot: (element: HTMLElement | null) => void;
};

const PersonalChatContext = createContext<PersonalChatState | null>(null);

/**
 * 여닫는 움직임. **`visibility`를 전이 목록에 넣는 것이 핵심이다** — 끝 상태가 `invisible`이라야
 * 감춰진 패널이 포커스와 접근성 트리에서 빠지는데, `visibility`는 전이 중에는 `visible`로
 * 계산되고 끝에서만 뒤집힌다. 그래서 들어올 때는 즉시 보이고 나갈 때는 끝까지 보인다.
 *
 * `display:none`(=`hidden`)으로는 이 두 가지를 같이 할 수 없어서 예전에는 그냥 툭 사라졌다.
 * 언마운트는 여전히 금지다 — 흐르던 스트림이 끊기면 계약상 부분 응답은 저장되지 않는다.
 *
 * `starting:`은 **첫 마운트**용이다. 패널은 한 번 열기 전에는 아예 없어서, 이게 없으면
 * 첫 열기만 애니메이션 없이 나타난다.
 *
 * 전이 목록이 `translate`·`scale`인 것은 Tailwind v4가 `translate-x-4`를 `transform`이 아니라
 * 개별 `translate` 속성으로 내기 때문이다 — `transform`만 적으면 투명도만 움직이고 위치는
 * 즉시 튄다(실측으로 확인).
 */
const CHAT_MOTION =
  "transition-[opacity,translate,scale,visibility] duration-200 ease-out motion-reduce:transition-none";

export function usePersonalChat() {
  const context = useContext(PersonalChatContext);
  if (!context) {
    throw new Error("usePersonalChat must be used inside PersonalChatProvider");
  }
  return context;
}

/**
 * 노트 화면이 자기 스코프를 등록한다. full이면 개인 챗봇이 노트 스코프가 되고,
 * side면 감춘다 — **감출 뿐 언마운트하지 않는다.** 흐르던 스트림을 끊으면 계약상
 * 부분 응답은 저장되지 않으므로 답변이 통째로 사라진다.
 */
export function usePersonalChatScope(scope: NoteScope | null) {
  const { setNoteScope } = usePersonalChat();
  const noteId = scope?.noteId ?? null;
  const hidden = scope?.hidden ?? false;

  // 해제는 **노트를 떠날 때만** 한다. `hidden`까지 이 effect의 의존성에 넣으면 full→side
  // 전환에서 cleanup이 먼저 돌아 스코프를 지우고, 감춰진 상태라 복구되지 않는다 —
  // 패널 key가 워크스페이스로 돌아가 언마운트되고 흐르던 스트림이 끊긴다.
  useEffect(() => {
    if (!noteId) return;
    return () => setNoteScope(null);
  }, [noteId, setNoteScope]);

  useEffect(() => {
    setNoteScope(noteId ? { noteId, hidden } : null);
  }, [hidden, noteId, setNoteScope]);
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
  /**
   * 한 번이라도 열었는가. 열기 전에는 패널을 마운트하지 않고(조회를 걸지 않는다),
   * 한 번 열면 **닫아도 마운트를 유지한다** — 언마운트하면 흐르던 스트림이 끊기고
   * 계약상 부분 응답은 저장되지 않아 답변이 통째로 사라진다. 닫기도 감추기다.
   */
  const [hasOpened, setHasOpened] = useState(false);
  const [hidden, setHidden] = useState(false);
  /**
   * 패널이 붙어 있는 노트. **감춰진 동안에는 바꾸지 않는다** — 워크스페이스 답변이 흐르는 중에
   * 노트를 side로 열면 스코프가 바뀌고, 그러면 패널 key가 바뀌어 언마운트되며 스트림이 끊긴다.
   * 계약상 부분 응답은 저장되지 않으므로 답변이 통째로 사라진다. 감추기는 감추기일 뿐이다.
   */
  const [scopeNoteId, setScopeNoteId] = useState<string | null>(null);

  /** 턴이 도는 동안 밀어 둔 스코프. `undefined`면 밀어 둔 것이 없다. */
  const deferredScopeRef = useRef<string | null | undefined>(undefined);
  const turnActiveRef = useRef(false);
  /**
   * 노트 전체 화면의 레일이 내준 자리. 있으면 떠 있는 카드 대신 여기로 포털한다.
   * **포털이라 `PersonalChatPanel` 자신은 이 트리에 그대로 남는다** — 스트림을 쥐고 있는
   * 훅이 이 컴포넌트에 있어서, 자리가 바뀌어도 흐르던 답변이 끊기지 않는다.
   */
  const [railSlot, setRailSlotState] = useState<HTMLElement | null>(null);
  const setRailSlot = useCallback((element: HTMLElement | null) => {
    setRailSlotState(element);
    // 레일에서 처음 열었어도 **연 것은 연 것이다.** 이걸 안 세우면 레일을 떠나는 순간
    // (축소·닫기·뒤로가기) `hasOpened`가 거짓이라 패널이 언마운트되고, 흐르던 답변이
    // 계약상 저장되지 않은 채 사라진다.
    if (element) setHasOpened(true);
  }, []);

  const setNoteScope = useCallback((scope: NoteScope | null) => {
    const nextNote = scope?.noteId ?? null;
    setHidden(scope?.hidden ?? false);
    // 감춰진 동안에는 스코프를 바꾸지 않는다.
    if (scope?.hidden) return;
    // 턴이 도는 중에 스코프가 바뀌면 패널 key가 바뀌어 언마운트되고 스트림이 끊긴다.
    // 노트를 닫고 나가는 평범한 이동이 답변을 통째로 날리므로, 턴이 끝날 때까지 미룬다.
    if (turnActiveRef.current) {
      deferredScopeRef.current = nextNote;
      return;
    }
    setScopeNoteId(nextNote);
  }, []);

  // ref는 스코프 전환을 미루는 동기 판정용이고, state는 **화면이 구독하는 값**이다 —
  // 좁은 화면의 노트 레일이 이걸 보고 답변이 흐르는 동안 자기를 접지 않는다.
  const [isTurnActive, setIsTurnActive] = useState(false);

  const setTurnActive = useCallback((active: boolean) => {
    turnActiveRef.current = active;
    setIsTurnActive(active);
    if (active || deferredScopeRef.current === undefined) return;
    setScopeNoteId(deferredScopeRef.current);
    deferredScopeRef.current = undefined;
  }, []);

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
      setTurnActive,
      isTurnActive,
      setRailSlot,
    }),
    [
      hidden,
      isOpen,
      isTurnActive,
      railed,
      setNoteScope,
      setRailSlot,
      setTurnActive,
    ]
  );

  return (
    <PersonalChatContext.Provider value={value}>
      {children}
      {/*
        FAB는 언마운트하지 않는다 — 패널과 자리를 주고받는 한 쌍이라 사라질 때도 같은 길이로
        물러나야 한다. 조건부 렌더면 패널이 들어오는 동안 버튼만 즉시 증발한다.
        접근성 트리에서는 실제로 빼야 하므로 `aria-hidden`·`inert`를 함께 건다.
      */}
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
          // 스코프가 바뀌면 세션·스트림을 갈아 끼운다. 스코프별로 활성 세션이 따로이므로
          // 상태를 이어 붙이면 노트 답변이 워크스페이스 대화에 섞인다.
          key={scopeNoteId ?? `workspace:${workspaceId}`}
          hidden={railed ? false : hidden || !isOpen}
          railSlot={railSlot}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          noteId={scopeNoteId}
          onTurnActiveChange={setTurnActive}
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
  noteId,
  onTurnActiveChange,
  onClose,
}: {
  hidden: boolean;
  /** 있으면 이 자리로 포털한다. 노트 전체 화면의 「내 에이전트」 레일이다. */
  railSlot?: HTMLElement | null;
  workspaceId: string;
  workspaceName?: string;
  noteId: string | null;
  onTurnActiveChange: (active: boolean) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const stream = useChatStream();
  const [createdChatId, setCreatedChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(
    null
  );
  const [lastSent, setLastSent] = useState<string | null>(null);
  /** 세션 생성 → 스트림 → 히스토리 반영까지 한 트랜잭션 전체가 진행 중인지. */
  const [isSending, setIsSending] = useState(false);
  /** 이 턴을 시작할 때의 히스토리 길이. 뒤에 붙은 것만 이 턴으로 본다. */
  const [turnBaseline, setTurnBaseline] = useState(0);

  // 활성 세션 조회 params와 세션 생성 body가 같은 모양이다 (scope + 대상 id).
  const scopeParams = useMemo(
    () =>
      noteId
        ? ({ scope: "note", noteId } as const)
        : ({ scope: "workspace", workspaceId } as const),
    [noteId, workspaceId]
  );

  const activeQuery = useGetActiveAgentChat(scopeParams);
  const activeResponse = activeQuery.data;
  const activeOk =
    activeResponse?.status === 200 && activeResponse.data.success;
  const active = activeOk ? activeResponse.data.data : null;

  /**
   * **`200 + data: null`(활성 세션 없음)과 조회 실패는 다르다.** 둘을 같이 null로 접으면
   * 조회가 실패했을 때도 빈 상태를 보이고, 이미 있는 활성 세션 옆에 새 세션을 하나 더 만든다.
   */
  const isActiveUnavailable =
    activeQuery.isError || (activeResponse !== undefined && !activeOk);

  // 방금 만든 세션이 활성 조회보다 먼저 알려지므로 그쪽을 우선한다.
  const sessionId = createdChatId ?? active?.chatId ?? null;

  // 턴이 도는 동안에는 켜지 않는다. 첫 전송은 세션을 만들며 이 쿼리를 켜는데, 그러면
  // (a) `isLoading`이 흐르는 스레드를 스켈레톤으로 덮고 (b) server가 USER 메시지를
  // 스트림 전에 저장하므로 그 응답이 `pendingUserMessage`와 겹쳐 두 번 보인다.
  // 턴이 끝난 뒤의 반영은 `send()`가 직접 `fetchQuery`로 한다.
  const messagesQuery = useGetAgentChatMessages(sessionId ?? "", {
    query: { enabled: Boolean(sessionId) && !isSending },
  });
  const messagesResponse = messagesQuery.data;
  const messagesOk =
    messagesResponse?.status === 200 && messagesResponse.data.success;
  const messages = messagesOk
    ? (messagesResponse.data.data.messages ?? [])
    : [];

  /**
   * 세션이 아예 없다(404). 이건 막다른 길이 아니라 **빈 대화**다 — 새로 만들면 된다.
   * 다른 실패와 섞어 잠그면 유일한 복구 경로까지 막힌다.
   */
  const isSessionGone =
    Boolean(sessionId) &&
    errorCodeOf(messagesQuery.error) === "AGENT_CHAT_NOT_FOUND";

  /**
   * 활성 세션은 있는데 히스토리를 못 읽은 경우. 빈 배열로 접으면 **있는 대화가 없는 대화로**
   * 보이고, 그 위에 새 메시지를 보내면 화면과 서버가 어긋난다.
   */
  const isHistoryUnavailable =
    Boolean(sessionId) &&
    !isSessionGone &&
    (messagesQuery.isError || (messagesResponse !== undefined && !messagesOk));

  /** 주 데이터를 못 읽은 상태. 전송도, 새 대화도 막는다. */
  const isUnavailable = isActiveUnavailable || isHistoryUnavailable;

  /**
   * 히스토리가 방금 끝난 턴을 이미 담고 있는가. 즉시 반영이 실패해 로컬 사본을 남겨 둔 뒤
   * 히스토리가 스스로 성공하면 같은 턴이 두 벌 그려진다 — 그때는 로컬 사본을 가린다.
   *
   * 대화 전체에서 같은 문장을 찾으면 **예전 답변**에 걸린다(같은 질문을 다시 하면 흔하다).
   * 턴을 시작할 때의 길이를 기준선으로 두고 그 뒤에 붙은 것만 본다. 정상 종료된 턴에만
   * 적용해서 실패·정지 안내까지 가려 버리지 않는다.
   */
  const isTurnReconciled =
    messagesOk &&
    stream.state.phase === "idle" &&
    stream.state.content !== null &&
    messages
      .slice(turnBaseline)
      .some(
        (message) =>
          message.role === "ASSISTANT" &&
          message.content === stream.state.content
      );

  // `isPending`을 쓰면 안 된다 — enabled:false인 쿼리도 pending이라 활성 세션이 없을 때
  // 빈 상태 대신 스켈레톤이 영원히 남는다. `isLoading`은 실제로 받아오는 중일 때만 참이다.
  const isLoading = activeQuery.isLoading || messagesQuery.isLoading;

  const noteQuery = useGetNote(noteId ?? "", {
    query: { enabled: Boolean(noteId) },
  });
  const noteTitle =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data.title
      : null;

  const createChat = useCreateAgentChat();
  const approval = useToolApproval({
    chatId: sessionId,
    pending: stream.state.pendingApproval,
    streamPhase: stream.state.phase,
  });

  /**
   * 전송·새 대화를 다 막는 상태. 넷 다 "지금 보내면 엉뚱한 대화에 닿는다"는 같은 이유다.
   *
   * - `isSending` — 앞 전송이 끝나지 않았다
   * - `createChat.isPending` — 새 대화가 만들어지는 중이라 `sessionId`가 곧 바뀐다
   * - `isLoading` — 활성 세션 조회가 아직 안 끝났다. 여기서 보내면 **있는 대화를 못 보고**
   *   새로 만들어 기존 대화를 비활성으로 내린다
   * - `isUnavailable` — 조회가 실패했다
   */
  const isBusy =
    isSending || createChat.isPending || isLoading || isUnavailable;

  const ensureSession = useCallback(async () => {
    // 없어진 세션(404)은 없는 것으로 친다 — 그래야 새로 만들어 이어갈 수 있다.
    if (sessionId && !isSessionGone) return sessionId;
    // 조회가 실패한 상태에서 만들면 이미 있는 활성 세션 위에 하나를 더 얹는다.
    if (isActiveUnavailable) return null;
    const created = await createChat.mutateAsync({ data: scopeParams });
    if (created.status !== 201 || !created.data.success) return null;
    const chatId = created.data.data.chatId;
    setCreatedChatId(chatId);
    // 활성 조회 캐시는 아직 null이다. 갱신하지 않으면 스코프를 옮겼다 돌아왔을 때
    // 방금 만든 세션을 잃고 빈 대화를 보이며, 다음 전송이 세션을 하나 더 만든다.
    void queryClient.invalidateQueries({
      queryKey: getGetActiveAgentChatQueryKey(scopeParams),
    });
    return chatId;
  }, [
    createChat,
    isActiveUnavailable,
    isSessionGone,
    queryClient,
    scopeParams,
    sessionId,
  ]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || isBusy) return;
      // 세션 생성부터 히스토리 반영까지가 한 트랜잭션이다. 스트리밍 구간만 잠그면
      // 생성 중 두 번째 전송이 세션을 하나 더 만들고, 반영 중 두 번째 전송은
      // 아래 `stream.reset()`에 먹혀 조용히 사라진다.
      setIsSending(true);
      // 턴이 도는 동안 스코프 전환을 미루게 한다 — 노트를 닫고 나가는 것만으로
      // 패널이 언마운트되면 흐르던 답변이 통째로 사라진다.
      onTurnActiveChange(true);
      try {
        const chatId = await ensureSession().catch(() => null);
        // 실패 문구는 전역 MutationCache가 토스트한다. 입력은 지우지 않는다 —
        // 세션을 못 만든 채 문장까지 사라지면 다시 보낼 방법이 없다.
        if (!chatId) return;

        setDraft("");
        setTurnBaseline(messages.length);
        setPendingUserMessage(message);
        setLastSent(message);
        const final = await stream.send(getSendAgentChatMessageUrl(chatId), {
          message,
        });
        if (final?.phase !== "idle") return;

        // 정상 종료일 때만 히스토리로 넘긴다. server가 tee한 기록을 다시 읽은 **뒤에**
        // 스트림을 비워야 말풍선이 잠깐 사라지지 않는다.
        //
        // `invalidateQueries`는 갱신이 실패해도 resolve한다 — 그걸 믿고 지우면 방금 끝난
        // 턴이 화면에서 사라진다. 다시 읽은 결과가 실제로 성공했을 때만 넘긴다.
        //
        // `messagesQuery.refetch()`를 쓰면 안 된다 — 첫 전송에서는 이 클로저의 훅이 아직
        // `sessionId === null`로 렌더된 것이라 `/v1/agent-chats//messages`를 부른다.
        // 방금 만든 `chatId`의 쿼리를 직접 가져온다. `staleTime: 0`이 없으면 전역 기본값
        // 60초에 걸려 네트워크를 타지 않고 방금 턴이 빠진 캐시를 그대로 돌려준다.
        //
        // 먼저 진행 중인 조회를 취소한다 — 세션이 막 만들어지면 아직 이 턴이 없는 GET이
        // 떠 있을 수 있고, TanStack은 `staleTime: 0`이어도 그 요청에 합쳐 버린다.
        // 그 빈 응답을 성공으로 읽으면 방금 끝난 턴을 지운다.
        const messagesKey =
          getGetAgentChatMessagesQueryOptions(chatId).queryKey;
        await queryClient.cancelQueries({ queryKey: messagesKey });
        const refreshed = await queryClient
          .fetchQuery({
            ...getGetAgentChatMessagesQueryOptions(chatId),
            staleTime: 0,
          })
          .catch(() => null);
        if (refreshed?.status !== 200 || !refreshed.data.success) return;
        setPendingUserMessage(null);
        stream.reset();
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
      queryClient,
      stream,
    ]
  );

  const startNewChat = useCallback(async () => {
    if (isBusy) return;
    // 실패 문구는 전역 MutationCache가 토스트한다. 여기서 삼키지 않으면
    // 브라우저에 unhandled rejection이 남는다.
    const created = await createChat
      .mutateAsync({ data: scopeParams })
      .catch(() => null);
    if (!created || created.status !== 201 || !created.data.success) return;
    stream.reset();
    setPendingUserMessage(null);
    setLastSent(null);
    setCreatedChatId(created.data.data.chatId);
    await queryClient.invalidateQueries({
      queryKey: getGetActiveAgentChatQueryKey(scopeParams),
    });
  }, [createChat, isBusy, queryClient, scopeParams, stream]);

  const isStreaming =
    stream.state.phase === "streaming" ||
    stream.state.phase === "awaiting_approval";

  const { viewportRef, atBottom, scrollToBottom } = useStickToBottom(
    `${messages.length}:${pendingUserMessage ?? ""}:${stream.state.text}:${stream.state.records.length}`
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
          ? // 레일에 들어가면 자기 껍데기를 내려놓는다 — 테두리·radius·그림자는 레일이 갖고,
            // 여기는 그 안을 채우기만 한다. 여닫는 움직임도 레일 탭이 대신한다.
            "h-full w-full"
          : cn(
              // 448은 v4 프레임 값이지만 좁은 화면에서는 뷰포트를 넘어 왼쪽이 잘린다.
              // 부양 카드는 e2 2연타다. 단일 티어 0_4px_16px는 흰 마케팅 면 전용이라
              // 제품 캔버스에서는 그림자가 보이지 않는다. (ELEVATION SPEC)
              "fixed top-2 right-2 bottom-2 z-30 w-[min(448px,calc(100vw-1rem))] rounded-panel border border-[var(--el-hairline)] shadow-e2",
              CHAT_MOTION,
              "starting:translate-x-4 starting:opacity-0",
              hidden
                ? "invisible translate-x-4 opacity-0"
                : "visible translate-x-0 opacity-100"
            )
      )}
    >
      <header className="flex items-center gap-2 border-b border-[var(--el-hairline)] px-6 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-wide text-[var(--el-muted)] uppercase">
            {noteId ? "노트" : "워크스페이스"}
          </p>
          {/* 스코프는 어디서 열었는지로 정해진다 — 여기서 바꾸는 어포던스를 두지 않는다. */}
          <p className="truncate text-sm font-medium text-[var(--el-ink)]">
            {noteId
              ? (noteTitle ?? "이 노트")
              : (workspaceName ?? "워크스페이스")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          // 조회가 실패한 상태에서 새 대화를 만들면, 못 본 활성 세션을 비활성으로 내린다.
          disabled={isBusy}
          onClick={() => void startNewChat()}
        >
          <Plus className="size-3.5" />새 대화
        </Button>
        {/* 레일에서는 닫기가 없다 — 탭이 자리를 가르므로 닫을 곳이 없고, 전체 화면의
            에이전트 레일에는 닫기를 두지 않는다는 규칙과도 같다. */}
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

      <ScrollArea
        className="min-h-0 flex-1"
        viewportRef={viewportRef}
        overlay={
          atBottom ? null : (
            <ScrollToBottomButton label="맨 아래로" onClick={scrollToBottom} />
          )
        }
      >
        <div className="flex min-h-full flex-col justify-end p-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : isUnavailable ? (
            // 주 데이터를 못 읽었다 — 빈 상태로 그리면 이미 있는 대화를 없는 것처럼 보인다.
            <div role="alert" className="space-y-2">
              <p className="text-sm text-[var(--el-ink)]">
                대화를 불러오지 못했습니다.
              </p>
              <p className="text-xs text-[var(--el-muted)]">
                {isActiveUnavailable
                  ? "기존 대화가 있는지 확인하지 못해 새 대화를 시작하지 않습니다."
                  : "이어서 보내면 화면과 실제 대화가 어긋나므로 전송을 막아 둡니다."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-[30px]"
                onClick={() =>
                  void (isActiveUnavailable
                    ? activeQuery.refetch()
                    : messagesQuery.refetch())
                }
              >
                다시 시도
              </Button>
            </div>
          ) : (
            <ChatThread
              messages={messages}
              // 즉시 반영이 실패해 로컬 턴을 남겨 뒀는데, 나중에 히스토리가 스스로
              // 성공하면 같은 턴이 두 벌 보인다. 히스토리가 이 답변을 담고 있으면
              // 로컬 사본을 그린다 — 지우는 게 아니라 **가린다**(상태 변경 없음).
              stream={isTurnReconciled ? initialStreamState : stream.state}
              pendingUserMessage={isTurnReconciled ? null : pendingUserMessage}
              // 유휴 타이머가 stalled로 표시한 순간에는 앞 전송이 아직 `finally`에
              // 닿지 않아 잠금이 살아 있다. 그때 reset하면 안내만 지우고 재전송은
              // 무시돼 고아 메시지가 남는다.
              isRetryDisabled={isBusy || !lastSent}
              onRetry={() => {
                if (isBusy || !lastSent) return;
                stream.reset();
                void send(lastSent);
              }}
              onApprove={approval.approve}
              approvalCard={approval.card}
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
                        disabled={isBusy}
                        onClick={() => void send(question)}
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
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={() => void send(draft)}
        onStop={stream.stop}
        isBusy={isBusy}
        isStreaming={isStreaming}
        placeholder={
          sessionId
            ? "무엇이든 물어보세요"
            : "첫 질문을 보내면 대화가 시작됩니다"
        }
        footer={
          stream.state.phase === "awaiting_approval" ? (
            <p className="mt-2 text-xs text-[var(--el-muted)]">
              승인을 기다리는 동안에는 입력할 수 없습니다.
            </p>
          ) : null
        }
      />
    </aside>
  );

  // 포털이라 **이 컴포넌트는 그대로 남는다.** 스트림을 쥐고 있는 훅이 여기 있어서, 자리가
  // 떠 있는 카드에서 레일로 옮겨가도 흐르던 답변이 끊기지 않는다(옮겨지는 것은 DOM뿐이다).
  return railSlot ? createPortal(panel, railSlot) : panel;
}
