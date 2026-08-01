"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, MessageCircle, Plus } from "lucide-react";

import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatThread } from "@/components/chat/chat-thread";
import { RailScopeBar, RailTabs } from "@/components/notes/rail-chrome";
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
type NoteScope = {
  noteId: string;
  hidden: boolean;
  /** 이 회의가 레일에 공유 챗봇 탭을 갖는가 — 없으면 「이 회의」 탭을 그리지 않는다. */
  hasNoteRail?: boolean;
};

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
};

const PersonalChatContext = createContext<PersonalChatState | null>(null);

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
  const hasNoteRail = scope?.hasNoteRail ?? false;

  // 해제는 **노트를 떠날 때만** 한다. `hidden`까지 이 effect의 의존성에 넣으면 full→side
  // 전환에서 cleanup이 먼저 돌아 스코프를 지우고, 감춰진 상태라 복구되지 않는다 —
  // 패널 key가 워크스페이스로 돌아가 언마운트되고 흐르던 스트림이 끊긴다.
  useEffect(() => {
    if (!noteId) return;
    return () => setNoteScope(null);
  }, [noteId, setNoteScope]);

  useEffect(() => {
    setNoteScope(noteId ? { noteId, hidden, hasNoteRail } : null);
  }, [hasNoteRail, hidden, noteId, setNoteScope]);
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
  // `?panel=assistant` 로 바로 열 수 있다 — 디자인 화면들이 그 주소를 쓰고, 레일이
  // 버튼으로만 열리면 「이 대화 보고 있어」를 공유할 수 없다.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const deepLinked = searchParams.get("panel") === "assistant";
  const [isOpen, setIsOpen] = useState(deepLinked);
  /**
   * 한 번이라도 열었는가. 열기 전에는 패널을 마운트하지 않고(조회를 걸지 않는다),
   * 한 번 열면 **닫아도 마운트를 유지한다** — 언마운트하면 흐르던 스트림이 끊기고
   * 계약상 부분 응답은 저장되지 않아 답변이 통째로 사라진다. 닫기도 감추기다.
   */
  const [hasOpened, setHasOpened] = useState(deepLinked);
  const [hidden, setHidden] = useState(false);
  const [hasNoteRail, setHasNoteRail] = useState(false);
  /**
   * 패널이 붙어 있는 노트. **감춰진 동안에는 바꾸지 않는다** — 워크스페이스 답변이 흐르는 중에
   * 노트를 side로 열면 스코프가 바뀌고, 그러면 패널 key가 바뀌어 언마운트되며 스트림이 끊긴다.
   * 계약상 부분 응답은 저장되지 않으므로 답변이 통째로 사라진다. 감추기는 감추기일 뿐이다.
   */
  const [scopeNoteId, setScopeNoteId] = useState<string | null>(null);

  /** 턴이 도는 동안 밀어 둔 스코프. `undefined`면 밀어 둔 것이 없다. */
  const deferredScopeRef = useRef<string | null | undefined>(undefined);
  const turnActiveRef = useRef(false);

  const setNoteScope = useCallback((scope: NoteScope | null) => {
    const nextNote = scope?.noteId ?? null;
    setHidden(scope?.hidden ?? false);
    setHasNoteRail(scope?.hasNoteRail ?? false);
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

  /** 열고 닫을 때 주소를 맞춘다. replace 라 뒤로가기가 패널 토글로 채워지지 않는다. */
  const setPanelParam = useCallback(
    (open: boolean) => {
      const next = new URLSearchParams(searchParams);
      if (open) next.set("panel", "assistant");
      else next.delete("panel");
      const query = next.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    },
    [pathname, router, searchParams]
  );

  const setTurnActive = useCallback((active: boolean) => {
    turnActiveRef.current = active;
    if (active || deferredScopeRef.current === undefined) return;
    setScopeNoteId(deferredScopeRef.current);
    deferredScopeRef.current = undefined;
  }, []);

  const value = useMemo<PersonalChatState>(
    () => ({
      // URL 이 진실이다. 라우트를 옮기면 다른 push/replace 가 panel 을 떨구는데,
      // state 만 믿으면 패널은 열린 채로 주소에는 없어 새로고침에 닫힌다.
      isOpen: isOpen || deepLinked,
      isVisible: (isOpen || deepLinked) && !hidden,
      open: () => {
        setHasOpened(true);
        setIsOpen(true);
        setPanelParam(true);
      },
      close: () => {
        setIsOpen(false);
        setPanelParam(false);
      },
      setNoteScope,
      setTurnActive,
    }),
    [deepLinked, hidden, isOpen, setNoteScope, setPanelParam, setTurnActive]
  );

  return (
    <PersonalChatContext.Provider value={value}>
      {children}
      {!hidden && !isOpen ? (
        <Button
          size="icon"
          aria-label="개인 챗봇 열기"
          onClick={value.open}
          className="fixed right-6 bottom-6 z-40 size-12 rounded-full shadow-e2"
        >
          <MessageCircle className="size-5" />
        </Button>
      ) : null}
      {hasOpened || deepLinked ? (
        <PersonalChatPanel
          // 스코프가 바뀌면 세션·스트림을 갈아 끼운다. 스코프별로 활성 세션이 따로이므로
          // 상태를 이어 붙이면 노트 답변이 워크스페이스 대화에 섞인다.
          key={scopeNoteId ?? `workspace:${workspaceId}`}
          hidden={hidden || !isOpen}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          noteId={scopeNoteId}
          // 「이 회의」로 건너가는 것은 이 레일을 닫는 것이다 — 그러면 공유 챗봇이 같은
          // 자리에 다시 선다. 두 패널 다 마운트된 채로 남으므로 스트림은 안 끊긴다.
          onSelectNoteChat={hasNoteRail ? value.close : undefined}
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
  onSelectNoteChat,
  workspaceId,
  workspaceName,
  noteId,
  onTurnActiveChange,
  onClose,
}: {
  hidden: boolean;
  onSelectNoteChat?: () => void;
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

  return (
    <aside
      data-testid="personal-chat-panel"
      aria-label="개인 챗봇"
      className={cn(
        // 448은 v4 프레임 값이지만 좁은 화면에서는 뷰포트를 넘어 왼쪽이 잘린다.
        // 부양 카드는 e2 2연타다. 단일 티어 0_4px_16px는 흰 마케팅 면 전용이라
        // 제품 캔버스에서는 그림자가 보이지 않는다. (ELEVATION SPEC)
        // 레일은 캔버스에서 10 띄운 480 패널이다 — 본문 패널과 같은 여백·radius·그림자라야
        // 둘이 한 판 위에 나란히 놓인 것으로 읽힌다(design.pen).
        "fixed top-2.5 right-2.5 bottom-2.5 z-30 flex w-[min(480px,calc(100vw-1.25rem))] flex-col rounded-panel border border-[var(--el-hairline)] bg-card shadow-e2",
        hidden && "hidden"
      )}
    >
      {/* 레일 머리는 공유 챗봇과 공유한다 — 회의 안에서는 「이 회의」로 건너간다. */}
      <RailTabs
        active="agent"
        hasNoteTab={Boolean(onSelectNoteChat)}
        onSelect={(tab) => (tab === "note" ? onSelectNoteChat?.() : undefined)}
        onClose={onClose}
      />
      {/* 스코프는 어디서 열었는지로 정해진다 — 여기서 바꾸는 어포던스를 두지 않는다. */}
      <RailScopeBar
        icon={Lock}
        trailing={
          <Button
            variant="ghost"
            size="sm"
            // 조회가 실패한 상태에서 새 대화를 만들면, 못 본 활성 세션을 비활성으로 내린다.
            disabled={isBusy}
            onClick={() => void startNewChat()}
          >
            <Plus className="size-3.5" />새 대화
          </Button>
        }
      >
        나만 보는 대화 ·{" "}
        {noteId ? (noteTitle ?? "이 회의") : (workspaceName ?? "워크스페이스")}{" "}
        범위
      </RailScopeBar>

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
}
