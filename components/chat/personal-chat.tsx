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
import {
  getGetAgentChatMessagesQueryOptions,
  getGetAgentChatsQueryKey,
  getResolveToolApprovalUrl,
  getSendAgentChatMessageUrl,
  useCancelAgentChatTurn,
  useCreateAgentChat,
  useGetAgentChatMessages,
  useGetAgentChats,
} from "@/lib/api/generated/agent-chat/agent-chat";
import type { AgentChatMessagesResponseData } from "@/lib/api/generated/models";
import { errorCodeOf } from "@/lib/api/error-message";
import { answerText, type ApprovalDecision } from "@/lib/chat/blocks";
import { runningLabel } from "@/lib/chat/chat-list";
import { unwrapScopeMarkers } from "@/lib/chat/scope-marker";
import { useScopeCatalog } from "@/lib/chat/use-scope-catalog";
import {
  failedTurnState,
  initialStreamState,
  resumedState,
  toolArgs,
} from "@/lib/chat/stream-protocol";
import { useChatStream } from "@/lib/chat/use-chat-stream";
import { useStickToBottom } from "@/lib/chat/use-stick-to-bottom";
import { useToolApproval } from "@/lib/chat/use-tool-approval";
import { cn } from "@/lib/utils";

/**
 * 노트 화면이 등록하는 스코프. `hidden`은 side 모드(Sheet)에서 패널을 감추기 위한 것이다.
 *
 * **제목도 함께 받는다.** 노트 화면이 이미 들고 있는 값이라, 여기서 다시 조회하면 그
 * 왕복 동안 칩이 안 붙는다 — 화면에는 제목이 떠 있는데 칩만 늦게 나타난다.
 */
type NoteScope = { noteId: string; title: string | null; hidden: boolean };

/** 컴포저에 붙는 범위 칩 하나. 배열이 원본이고 텍스트는 표시일 뿐이다. */
export type ScopeChip = { kind: "note" | "project"; id: string; title: string };

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

/**
 * 스레드와 기록이 **같은 자리에서 겹쳐 교대하는** 움직임. 가로 이동이 없다 — 나가는 쪽은
 * 흐려지며 사라지고 들어오는 쪽은 초점이 맞으며 선다.
 *
 * `visibility`를 전이 목록에 넣는 이유는 위 `CHAT_MOTION`과 같다 — 나가는 쪽이 끝까지 보이고
 * 끝에서만 접근성 트리에서 빠진다. **`hidden`(=`display:none`)을 쓰면 안 된다**: 스레드가
 * 레이아웃에서 빠지는 순간 `scrollHeight`가 0이 되어 `useStickToBottom`이 붙들고 있던 자리를
 * 잃고, 돌아왔을 때 읽던 곳이 아니라 엉뚱한 데로 튄다.
 *
 * `scale`이 전이 목록인 것은 Tailwind v4가 `scale-*`을 `transform`이 아니라 개별 `scale`
 * 속성으로 내기 때문이다.
 *
 * **`prefers-reduced-motion`이면 CSS가 전이를 끈다** — 블러도 페이드도 없이 즉시 교대한다.
 */
const CHAT_VIEW_MOTION =
  "transition-[filter,opacity,scale,visibility] duration-200 ease-out motion-reduce:transition-none";

/**
 * 나가는 쪽의 끝 상태. **잰 값이 아니다** — 브라우저에서 보고 고른 값이다.
 * 블러 5px은 글자가 읽히지 않을 만큼은 흐리되 무엇이 있었는지는 남는 정도이고, 축소 0.985는
 * "뒤로 물러난다"가 겨우 느껴지는 선이다. 더 키우면 교대가 화면 전환처럼 무거워진다.
 *
 * `pointer-events-none`은 겹쳐 있는 동안 나가는 뷰가 클릭·휠을 가로채지 않게 한다.
 * `inert`가 이미 막지만, 두 뷰가 다 떠 있는 200ms 동안에는 명시해 두는 편이 읽기 쉽다.
 */
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
 * 노트 화면이 자기 스코프를 등록한다. full이면 개인 챗봇이 노트 스코프가 되고,
 * side면 감춘다 — **감출 뿐 언마운트하지 않는다.** 흐르던 스트림을 끊으면 계약상
 * 부분 응답은 저장되지 않으므로 답변이 통째로 사라진다.
 */
export function usePersonalChatScope(scope: NoteScope | null) {
  const { setNoteScope } = usePersonalChat();
  const noteId = scope?.noteId ?? null;
  const title = scope?.title ?? null;
  const hidden = scope?.hidden ?? false;

  // 해제는 **노트를 떠날 때만** 한다. `hidden`까지 이 effect의 의존성에 넣으면 full→side
  // 전환에서 cleanup이 먼저 돌아 스코프를 지운다.
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
  const [scopeNote, setScopeNote] = useState<{
    noteId: string;
    title: string | null;
  } | null>(null);

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
    setHidden(scope?.hidden ?? false);
    // **미루지 않는다.** 대화가 안 갈리므로 답변이 흐르는 중에 바뀌어도 잃을 것이 없다.
    // 같은 값이면 새 객체를 안 세운다 — 노트 화면이 매 렌더 부르므로 그대로 두면
    // 패널이 계속 다시 그려진다.
    setScopeNote((current) => {
      const next = scope ? { noteId: scope.noteId, title: scope.title } : null;
      if (current?.noteId === next?.noteId && current?.title === next?.title) {
        return current;
      }
      return next;
    });
  }, []);

  // ref는 스코프 전환을 미루는 동기 판정용이고, state는 **화면이 구독하는 값**이다 —
  // 좁은 화면의 노트 레일이 이걸 보고 답변이 흐르는 동안 자기를 접지 않는다.
  const [isTurnActive, setIsTurnActive] = useState(false);

  const setTurnActive = useCallback((active: boolean) => {
    setIsTurnActive(active);
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
          // **워크스페이스로만 키잉한다.** 예전에는 노트가 키에 들어가 회의록을 드나들
          // 때마다 세션이 갈렸다. 범위가 메시지에 붙으면서 그 이유가 없어졌다.
          // **대화 id 는 안 넣는다** — 첫 전송이 대화를 만들며 `sessionId` 를 바꾸므로,
          // 넣으면 그 순간 패널이 언마운트되어 방금 연 스트림이 끊긴다. 대화를 갈아
          // 끼울 때 비울 것은 `clearForChatSwitch()` 가 손으로 비운다.
          key={workspaceId}
          hidden={railed ? false : hidden || !isOpen}
          railSlot={railSlot}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          suggestedNote={scopeNote}
          onTurnActiveChange={setTurnActive}
          onClose={value.close}
        />
      ) : null}
    </PersonalChatContext.Provider>
  );
}

/**
 * 목록 폴링 간격. **근거가 있는 값이 아니다** — 상수로 두고 실측한 뒤에 고친다.
 * 이 값이 정하는 것은 **남의 턴**을 늦어도 언제까지 알아채나뿐이다. 열려 있는 대화는
 * SSE 가 즉시 말하고, 어긋나면 `runningLabel` 이 `turnId` 로 맞춘다.
 */
const CHAT_LIST_POLL_MS = 5_000;

const EXAMPLE_QUESTIONS = [
  "지난 회의에서 정한 것만 정리해줘",
  "남은 액션 아이템이 뭐야?",
  "논의된 이슈를 Linear 이슈로 만들어줘",
];

/**
 * 다시 읽은 히스토리가 **방금 보낸 질문을 이미 담고 있나.** 「POST가 서버에 닿았나」를
 * 화면이 뒤늦게 알아내는 유일한 수단이다.
 *
 * **기준선 자리 하나만 본다.** 서버는 이 턴의 행을 그 자리에 USER부터 붙이므로 거기가 곧
 * 방금 보낸 질문이고, 대화 전체에서 같은 문장을 찾으면 **예전 답변에 걸린다** — 같은 질문을
 * 다시 하는 것은 흔하다. `frozenMessages` 가 구분선을 얼릴 때 쓰는 것과 같은 자리다.
 */
function echoesSent(
  // **구조 타입을 손으로 짓지 않는다.** 예전에는 `{ messages: {...}[] }` 로 적어 뒀는데,
  // 계약에서 `messages` 가 optional 로 바뀌자 여기만 조용히 갈렸다. 생성 타입을 그대로
  // 받으면 다음에 또 갈릴 때 컴파일러가 여기서 잡는다.
  history: AgentChatMessagesResponseData | null,
  baseline: number,
  message: string
) {
  const asked = history?.messages?.[baseline];
  return asked?.role === "USER" && asked.content === message;
}

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
  /**
   * 회의록 화면이 미리 붙여 주는 칩. **강제가 아니다** — 사용자가 지우면 다시 안 붙는다.
   * 대화를 가르지도 않는다: 회의록을 드나들어도 같은 대화가 이어진다.
   */
  /** 노트 화면이 넘긴 회의록. 제목까지 들어 있어 **조회 없이 바로 칩이 붙는다.** */
  suggestedNote: { noteId: string; title: string | null } | null;
  onTurnActiveChange: (active: boolean) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const stream = useChatStream();
  const isStreaming =
    stream.state.phase === "streaming" ||
    stream.state.phase === "awaiting_approval";
  const [createdChatId, setCreatedChatId] = useState<string | null>(null);
  /** 사용자가 목록에서 고른 대화. 안 골랐으면 목록 첫 줄이 열린다. */
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  /**
   * 헤더 아래 상자가 지금 무엇을 보이고 있나. **둘 다 마운트된 채** 옆으로 교대한다 —
   * 스레드를 언마운트하면 흐르던 답이 통째로 사라지고(계약상 부분 응답 미저장), 스크롤
   * 위치도 잃는다.
   */
  const [view, setView] = useState<"thread" | "history">("thread");
  /**
   * ★ **아직 서버에 없는 새 대화를 쓰는 중.** ＋ 는 서버를 안 부른다 — 아무 말도 안 하고
   * 나가면 그 대화는 **존재한 적이 없어야** 하고, 그래야 기록에 빈 「새 대화」 줄이 안 쌓인다.
   * 대화는 첫 전송에서 `ensureSession()` 이 만든다.
   */
  const [isDraftChat, setIsDraftChat] = useState(false);
  /** 방금 보낸 질문이 쓴 범위. 히스토리가 받아 줄 때까지 화면 높이를 맞춰 둔다. */
  const [pendingScope, setPendingScope] = useState<ScopeChip[]>([]);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(
    null
  );
  /**
   * ★ 그 질문을 **보낸 시각**. 서버가 저장한 뒤에 오는 `createdAt` 을 기다리면, 보내는
   * 동안에는 구분선이 없다가 답이 끝나 히스토리로 넘어가는 순간 없던 줄이 끼어들어 화면이
   * 밀린다 — [W-12] 가 막던 그것이다. 보내는 순간 한 번 붙들고, 히스토리가 받아 줄 때까지
   * 그 값으로 구분선을 세운다.
   *
   * **`pendingUserMessage` 와 함께 비우지 않는다.** 비우면 `isTurnReconciled` 로 가리는
   * 한 프레임 동안 구분선만 먼저 사라진다.
   */
  const [pendingUserAt, setPendingUserAt] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  /**
   * ★ 마지막 턴이 남긴 범위 밖 제안. **스트림이 아니라 여기 산다** — 제안은
   * `message_end` 에만 실리고 히스토리에는 담을 자리가 없어서(계약), 스트림 상태에
   * 두면 답이 히스토리로 넘어가는 순간 `reset()` 과 함께 사라진다. 실제로 그래서
   * 이 버튼은 **눌릴 수 있었던 적이 없었다.**
   */
  /** 세션 생성 → 스트림 → 히스토리 반영까지 한 트랜잭션 전체가 진행 중인지. */
  const [isSending, setIsSending] = useState(false);
  /** 이 턴을 시작할 때의 히스토리 길이. 뒤에 붙은 것만 이 턴으로 본다. */
  const [turnBaseline, setTurnBaseline] = useState(0);

  /**
   * 목록도 생성도 워크스페이스가 **경로**다.
   *
   * **노트가 안 들어간다.** 회의록은 대화가 아니라 **메시지**에 붙는다 — 그래서 노트에
   * 들어가도 대화가 안 갈린다.
   */
  const chatsQuery = useGetAgentChats(workspaceId, {
    query: { refetchInterval: CHAT_LIST_POLL_MS },
  });
  const chatsResponse = chatsQuery.data;
  const chatsOk = chatsResponse?.status === 200 && chatsResponse.data.success;
  // `?? []`를 그냥 두면 매 렌더 새 배열이라 아래 훅들이 한 번도 안 걸린다.
  const chats = useMemo(
    () => (chatsOk ? chatsResponse.data.data.chats : []),
    [chatsOk, chatsResponse]
  );

  /**
   * **빈 목록과 조회 실패는 다르다.** 둘을 같이 「대화 없음」으로 접으면 조회가 실패했을
   * 때도 빈 상태를 보이고, 이미 있는 대화 옆에 새 대화를 하나 더 만든다.
   */
  const isChatsUnavailable =
    chatsQuery.isError || (chatsResponse !== undefined && !chatsOk);

  /**
   * 보고 있는 대화. **클라이언트가 안다** — 서버에 활성 대화라는 개념이 없어졌다.
   * 방금 만든 것이 목록보다 먼저 알려지므로 그쪽을 우선하고, 아무것도 안 골랐으면
   * **목록 첫 번째**(= `updatedAt` 이 가장 큰 것 = 마지막으로 쓴 대화)다.
   * URL 은 안 쓴다 — W-21 이 미결이다.
   *
   * ★ **`isDraftChat` 이 fallback 을 끊는다.** ＋ 가 서버를 안 부르므로 「새 대화를 쓰는
   * 중」에는 가리킬 `chatId` 가 아예 없다. 그때 `createdChatId`·`selectedChatId` 를 비우기만
   * 하면 `chats[0]` 으로 떨어져 **방금 쓰던 대화가 그대로 열린다** — ＋ 를 눌렀는데 아무것도
   * 안 바뀐 것처럼 보인다.
   *
   * 이 상태는 첫 전송이 `ensureSession()` 으로 대화를 만들면 저절로 풀린다 —
   * `createdChatId` 가 앞에 있어서 그 순간부터 이 갈래를 안 지난다.
   */
  const sessionId =
    createdChatId ??
    selectedChatId ??
    (isDraftChat ? null : (chats[0]?.chatId ?? null));

  // 턴이 도는 동안에는 켜지 않는다. 첫 전송은 세션을 만들며 이 쿼리를 켜는데, 그러면
  // (a) `isLoading`이 흐르는 스레드를 스켈레톤으로 덮고 (b) server가 USER 메시지를
  // 스트림 전에 저장하므로 그 응답이 `pendingUserMessage`와 겹쳐 두 번 보인다.
  // 턴이 끝난 뒤의 반영은 `send()`가 직접 `fetchQuery`로 한다.
  //
  // **`isSending`만으로는 부족하다.** 승인 대기에서 1차가 정상 종료하면 `send()`가
  // 돌아와 `isSending`이 풀리는데, 그 사이 히스토리가 켜지면 저장된 USER 행이
  // `pendingUserMessage`와 겹쳐 **말풍선이 두 벌**이 된다. 스트림이 서 있는 동안은
  // 승인 대기도 「도는 중」이다.
  const messagesQuery = useGetAgentChatMessages(sessionId ?? "", {
    query: { enabled: Boolean(sessionId) && !isSending && !isStreaming },
  });
  const messagesResponse = messagesQuery.data;
  const messagesOk =
    messagesResponse?.status === 200 && messagesResponse.data.success;
  const history = messagesOk ? messagesResponse.data.data : null;
  // `?? []`를 그냥 두면 매 렌더 새 배열이라 아래 `useMemo`가 한 번도 안 걸린다.
  const messages = useMemo(() => history?.messages ?? [], [history]);
  /**
   * 재진입을 가르는 값 셋. **`activeTurn`이 갈래를 정한다** — 있으면 이어받고, 없으면
   * `lastTurn`이 실패로 끝났는지만 본다.
   *
   * `cursor`는 그대로 `?after=`에 들어간다. **`0`이 정상값이다** — 「버퍼에 아무것도
   * 없다」는 뜻이고 `GET /events`가 곧바로 닫힌다.
   */
  const activeTurn = history?.activeTurn ?? null;
  const lastTurn = history?.lastTurn ?? null;
  const cursor = history?.cursor ?? 0;

  /**
   * 세션이 아예 없다(404). 이건 막다른 길이 아니라 **빈 대화**다 — 새로 만들면 된다.
   * 다른 실패와 섞어 잠그면 유일한 복구 경로까지 막힌다.
   */
  const isSessionGone =
    Boolean(sessionId) &&
    errorCodeOf(messagesQuery.error) === "AGENT_CHAT_NOT_FOUND";

  /**
   * 보는 대화는 있는데 히스토리를 못 읽은 경우. 빈 배열로 접으면 **있는 대화가 없는 대화로**
   * 보이고, 그 위에 새 메시지를 보내면 화면과 서버가 어긋난다.
   */
  const isHistoryUnavailable =
    Boolean(sessionId) &&
    !isSessionGone &&
    (messagesQuery.isError || (messagesResponse !== undefined && !messagesOk));

  /** 주 데이터를 못 읽은 상태. 전송도, 새 대화도 막는다. */
  const isUnavailable = isChatsUnavailable || isHistoryUnavailable;

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
    stream.state.phase === "done" &&
    stream.state.content !== null &&
    messages
      .slice(turnBaseline)
      .some(
        (message) =>
          message.role === "ASSISTANT" &&
          message.content === stream.state.content
      );

  // `isPending`을 쓰면 안 된다 — enabled:false인 쿼리도 pending이라 대화가 없을 때
  // 빈 상태 대신 스켈레톤이 영원히 남는다. `isLoading`은 실제로 받아오는 중일 때만 참이다.
  const isLoading = chatsQuery.isLoading || messagesQuery.isLoading;

  /** 이 턴에 붙은 범위. **대화가 아니라 메시지가 갖는다.** */
  const [chips, setChips] = useState<ScopeChip[]>([]);
  /**
   * 사용자가 손으로 지운 회의록. **다시 안 붙인다** — 안 기억하면 회의록을 나갔다 오는 것만으로
   * 방금 지운 칩이 되살아난다. 힌트가 힌트이려면 거절이 남아야 한다.
   */
  const dismissedRef = useRef<Set<string>>(new Set());

  // 회의록 화면이 알려 준 것을 미리 붙인다. 제목이 와야 붙는다 — id만 있는 칩은 누른 사람이
  // 무엇을 붙였는지 모른다.
  /** 이미 박아 넣은 프리필. 두 번 넣지 않는다 — 편집기는 자기 DOM 을 스스로 든다. */
  const prefilledRef = useRef<Set<string>>(new Set());

  const prefillSuggested = useCallback(() => {
    const noteId = suggestedNote?.noteId;
    const title = suggestedNote?.title;
    // 제목이 와야 붙는다 — id 만 있는 칩은 누른 사람이 무엇을 붙였는지 모른다.
    if (!noteId || !title) return;
    if (dismissedRef.current.has(noteId)) return;
    if (prefilledRef.current.has(noteId)) return;
    prefilledRef.current.add(noteId);
    editorRef.current?.prepend({ kind: "note", id: noteId, title });
  }, [suggestedNote]);

  useEffect(() => prefillSuggested(), [prefillSuggested]);

  /** 편집기 손잡이. 문장과 칩이 한 DOM 에 있어 상태가 아니라 여기로 만진다. */
  const editorRef = useRef<MentionHandle | null>(null);

  const createChat = useCreateAgentChat();

  /**
   * **전송을** 막는 상태. 여섯 다 "지금 보내면 엉뚱한 대화에 닿는다"는 같은 이유다.
   *
   * 대화를 갈아 끼우는 것은 여기 안 걸린다 — 아래 `isSwitchBlocked` 가 따로 정한다.
   *
   * - `isSending` — 앞 전송이 끝나지 않았다
   * - `createChat.isPending` — 새 대화가 만들어지는 중이라 `sessionId`가 곧 바뀐다
   * - `isLoading` — 목록 조회가 아직 안 끝났다. 여기서 보내면 **있는 대화를 못 보고**
   *   새 대화를 하나 더 만든다
   * - `isUnavailable` — 조회가 실패했다
   * - `isStreaming` — 이어받은 턴이 흐르는 중이다. **`isSending`이 이걸 못 본다** —
   *   그건 이 탭의 이번 전송만 안다
   * - **남이 시작한 턴** — 새로고침 전이거나 다른 탭이다. 안 잠그면 겹쳐 보낸 두 번째
   *   메시지가 409를 받는다. 이 탭이 이미 그 턴을 그리고 있으면(이어받기·실패 배너)
   *   `turnId`가 같으니 다시 잠그지 않는다
   */
  const isBusy =
    isSending ||
    createChat.isPending ||
    isLoading ||
    isUnavailable ||
    isStreaming ||
    Boolean(activeTurn && activeTurn.turnId !== stream.state.turnId);

  /**
   * ★ 대화를 갈아 끼울 수 없는 상태. **`isBusy` 보다 좁다** — `isStreaming` 도 「남이
   * 시작한 턴」도 여기 없다.
   *
   * 답이 흐르는 중에도 다른 대화를 열 수 있어야 한다. 그것이 「새 대화가 앞 것을 안
   * 죽인다」의 화면 쪽 뜻이고, `isBusy` 를 그대로 쓰면 **대화가 여럿 사는 것을 화면이
   * 막는다** — A가 도는 동안 B를 아예 열 수 없다.
   *
   * 남는 셋은 전부 「지금 고르면 엉뚱한 대화에 닿는다」다: 목록을 아직 못 읽었거나,
   * 못 읽었거나, 대화가 만들어지는 중이라 `sessionId` 가 곧 바뀐다.
   *
   * **`createChat.isPending` 은 이제 전송 경로에서만 켜진다** — ＋ 가 더는 대화를 안 만든다.
   * 그래도 남긴다: `ensureSession()` 이 도는 동안 대화를 갈아 끼우면, 끝난 뒤 그 함수가
   * `createdChatId` 를 세워 방금 고른 대화를 덮는다.
   */
  const isSwitchBlocked = isLoading || isUnavailable || createChat.isPending;

  const ensureSession = useCallback(async () => {
    // 없어진 세션(404)은 없는 것으로 친다 — 그래야 새로 만들어 이어갈 수 있다.
    if (sessionId && !isSessionGone) return sessionId;
    // 조회가 실패한 상태에서 만들면 이미 있는 대화 위에 하나를 더 얹는다.
    if (isChatsUnavailable) return null;
    const created = await createChat.mutateAsync({ workspaceId, data: {} });
    if (created.status !== 201 || !created.data.success) return null;
    const chatId = created.data.data.chatId;
    setCreatedChatId(chatId);
    // 빈 새 대화가 여기서 실체가 됐다.
    setIsDraftChat(false);
    // 목록 캐시에는 아직 이 대화가 없다. 갱신하지 않으면 목록에 안 뜨고, `createdChatId`가
    // 풀리는 순간(대화 전환) 방금 만든 대화를 잃는다.
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
   * 끝난 턴을 히스토리로 넘긴다. server가 tee한 기록을 다시 읽은 **뒤에** 스트림을 비워야
   * 말풍선이 잠깐 사라지지 않는다.
   *
   * `invalidateQueries`는 갱신이 실패해도 resolve한다 — 그걸 믿고 지우면 방금 끝난 턴이
   * 화면에서 사라진다. 다시 읽은 결과가 실제로 성공했을 때만 넘긴다.
   *
   * `messagesQuery.refetch()`를 쓰면 안 된다 — 첫 전송에서는 이 클로저의 훅이 아직
   * `sessionId === null`로 렌더된 것이라 `/v1/agent-chats//messages`를 부른다.
   * 방금 만든 `chatId`의 쿼리를 직접 가져온다. `staleTime: 0`이 없으면 전역 기본값
   * 60초에 걸려 네트워크를 타지 않고 방금 턴이 빠진 캐시를 그대로 돌려준다.
   *
   * 먼저 진행 중인 조회를 취소한다 — 세션이 막 만들어지면 아직 이 턴이 없는 GET이
   * 떠 있을 수 있고, TanStack은 `staleTime: 0`이어도 그 요청에 합쳐 버린다.
   * 그 빈 응답을 성공으로 읽으면 방금 끝난 턴을 지운다.
   *
   * **다시 읽은 히스토리를 돌려준다**(실패면 null). 호출부의 절반은 성공 여부만 보지만,
   * 실패 갈래는 「서버가 이 문장을 받아 갔나」를 그 자리에서 물어야 한다 — 컴포넌트의
   * `messages`는 이 클로저에서 한 렌더 낡아 있어서 못 쓴다.
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

  const { viewportRef, atBottom, scrollToBottom, scrollToSent } =
    useStickToBottom(
      `${messages.length}:${pendingUserMessage ?? ""}:${answerText(stream.state.blocks)}:${stream.state.blocks.length}`
    );

  /**
   * ★ 스크롤 뷰포트 높이. **마지막 질문을 맨 위로 올리는 데 쓴다** — 그 질문 아래에 한
   * 화면만큼 자리를 두면, 바닥으로 스크롤했을 때 질문이 위에 서고 답이 그 아래에서 흐른다.
   *
   * 재는 것은 여기다. 스레드가 자기 스크롤 컨테이너를 알아야 할 이유가 없다.
   * 값이 안 바뀌면 상태를 안 세운다 — `ResizeObserver` 가 같은 값을 여러 번 준다.
   *
   * **`send` 보다 위에 둔다.** 보내는 순간 컴포저가 접히면서 뷰포트가 커지는데, 그 자리를
   * 잡는 값이 이것이라 `send` 가 직접 다시 재야 한다(아래 주석).
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
    // jsdom에는 `ResizeObserver`가 없다. 없으면 첫 측정만 하고 만다 — `note-archive`가
    // 같은 자리에서 같은 방식으로 판다.
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
      // 확장 제안을 누른 것이다. **문장의 칩도 같이 바뀐다** — 무엇을 눌렀는지가 화면에
      // 남아야 사용자가 지금 어느 범위를 보고 있는지 안다.
      const scope = override ?? chips;
      // 세션 생성부터 히스토리 반영까지가 한 트랜잭션이다. 스트리밍 구간만 잠그면
      // 생성 중 두 번째 전송이 세션을 하나 더 만들고, 반영 중 두 번째 전송은
      // 아래 `stream.reset()`에 먹혀 조용히 사라진다.
      setIsSending(true);
      // 새 질문이다 — 앞 턴의 제안은 이 질문과 무관하다.
      // 턴이 도는 동안 스코프 전환을 미루게 한다 — 노트를 닫고 나가는 것만으로
      // 패널이 언마운트되면 흐르던 답변이 통째로 사라진다.
      onTurnActiveChange(true);
      try {
        const chatId = await ensureSession().catch(() => null);
        // 실패 문구는 전역 MutationCache가 토스트한다. 입력은 지우지 않는다 —
        // 세션을 못 만든 채 문장까지 사라지면 다시 보낼 방법이 없다.
        if (!chatId) return;

        editorRef.current?.clear();
        /**
         * ★ **여기서 다시 잰다. 이 한 줄이 「질문이 살짝 내려갔다가 뒤늦게 튀어 오르는」
         * 것을 막는다.**
         *
         * 바로 위 `clear()` 가 컴포저를 한 줄로 접는다 — 여러 줄을 쓰고 보냈거나 칩이
         * 걸려 있었으면 그만큼(실측 131px) 스크롤 뷰포트가 **커진다.** 그런데 그 높이를
         * 나르는 것은 `ResizeObserver` 라 값이 **한 렌더 늦게** 온다. 그래서 질문 아래
         * 자리(`pinSlackPx`)가 낡은 높이로 잡히고, 바닥까지 내려도 자리가 그만큼 모자라
         * 질문이 뷰포트 위에 못 붙는다.
         *
         * 늦게 온 값은 그 자리를 늘리지만 **아무도 다시 안 옮긴다** — 부드러운 이동의
         * 700ms 창(`use-stick-to-bottom`)이 그 사이의 따라가기를 건너뛰기 때문이다.
         * 그래서 창이 닫힌 뒤 토큰 하나가 올 때 한 프레임에 131px 이 튄다.
         *
         * `clear()` 는 DOM 을 그 자리에서 고치므로(`innerHTML = ""`) 여기서 읽는
         * `clientHeight` 는 이미 접힌 높이다. 아래 `setPendingUserMessage` 와 같은 배치라
         * **자리와 질문이 같은 렌더에 함께 선다.**
         */
        measureViewport();
        setTurnBaseline(messages.length);
        // 방금 보낸 질문이 화면 위로 **미끄러져** 올라가야 어디로 갔는지 눈이 따라간다.
        // 위를 읽던 중이었어도 무조건 옮긴다 — 보내기는 사용자가 지금 한 행동이다.
        scrollToSent();
        setPendingUserMessage(message);
        setPendingUserAt(new Date().toISOString());
        setPendingScope(scope);
        setLastSent(message);
        // **배열이 원본이다.** 본문 텍스트가 아니라 칩이 범위를 정하므로, 사용자가 본문을
        // 어떻게 편집해도 계약이 안 깨진다. 중복은 보내기 직전에 접는다.
        const final = await stream.send(
          chatId,
          getSendAgentChatMessageUrl(chatId),
          {
            message,
            noteIds: [
              ...new Set(
                scope
                  .filter((chip) => chip.kind === "note")
                  .map((chip) => chip.id)
              ),
            ],
            projectIds: [
              ...new Set(
                scope
                  .filter((chip) => chip.kind === "project")
                  .map((chip) => chip.id)
              ),
            ],
          }
        );
        /**
         * **409는 실패가 아니라 이어받기 신호다.** 이미 도는 턴이 있다는 뜻이고, 무엇을
         * 어디서부터 이어야 하는지는 히스토리가 안다. 오류 배너 + 「다시 보내기」로 그리면
         * 그 버튼이 또 409를 받아 **무한 루프**가 된다 — 멀티탭과 새로고침 직후가 이 경로다.
         *
         * 409 본문에 `turnId`가 실려 오지만 안 읽는다. 왕복 하나를 아끼는 값일 뿐이고,
         * 이어받을 자리(`cursor`)는 어차피 히스토리에만 있다.
         */
        if (final?.error?.code === "AGENT_CHAT_TURN_IN_PROGRESS") {
          setPendingUserMessage(null);
          stream.reset();
          const refreshed = await reconcile(chatId);
          /**
           * ★ **서버가 이 문장을 이미 받았을 수 있다.** 응답을 못 받은 전송을 다시 보낸 것도
           * 여기로 오기 때문이다 — 열쇠가 있을 때는 그 갈래가 200 재생이라 여기 안 왔다.
           * 그때 컴포저로 되돌리면 같은 질문이 **화면에 한 벌 + 컴포저에 한 벌**이 된다.
           * 히스토리가 안 받아 간 문장만 되돌린다(겹쳐 보낸 질문).
           */
          if (echoesSent(refreshed, messages.length, message)) return;
          // 이 문장은 서버에 안 닿았다. 지우면 다시 칠 방법이 없으므로 컴포저로 되돌린다.
          //
          // ★ **마커를 풀어서 넣는다.** 아래에서 칩을 다시 박으므로, 안 풀면 같은 범위가
          // 칩 한 벌 + 마커 날글자 한 벌로 두 번 앉는다.
          editorRef.current?.append(unwrapScopeMarkers(message));
          scope.forEach((chip) => editorRef.current?.prepend(chip));
          setChips(scope);
          return;
        }
        /**
         * ★ **POST가 열리지도 못했다 — 서버에 턴이 생겼는지 화면이 모른다.**
         *
         * 이 창을 막던 것이 `clientTurnKey`였고, 그 자리를 **히스토리 재조회**가 대신한다.
         * 다시 읽어서 살아 있는 턴이 있으면 위 재진입 효과가 `GET /events`로 이어받고,
         * 그 사이 끝났으면 답이 그대로 그려진다 — 둘 다 「다시 보내기」가 턴을 하나 더
         * 여는 것을 막는다. `activeTurn`이 서는 순간 `isBusy`가 그 버튼을 스스로 잠근다.
         *
         * **`turnId`를 이미 봤으면 여기 안 온다.** 그 턴은 분명히 서버에 있고 실패·중지
         * 배너가 이미 그것을 그리고 있다. 모르는 것은 못 연 POST 하나뿐이다.
         */
        if (final?.phase !== "done") {
          if (final?.phase === "failed" && final.turnId === null) {
            const refreshed = await reconcile(chatId);
            // **받아 갔을 때만 로컬 사본을 접는다.** 안 받아 갔는데(POST가 아예 안 닿았다)
            // 접으면 히스토리에도 없는 질문이 화면에서 조용히 사라진다.
            if (echoesSent(refreshed, messages.length, message)) {
              setPendingUserMessage(null);
              stream.reset();
            }
          }
          return;
        }

        // **히스토리로 넘기기 전에 붙든다.** 스트림이 비워지면 제안도 같이 사라진다.
        // 정상 종료일 때만 히스토리로 넘긴다.
        if (!(await reconcile(chatId))) return;
        setPendingUserMessage(null);
        stream.reset();
      } finally {
        setIsSending(false);
        onTurnActiveChange(false);
      }
    },
    [
      chips,
      ensureSession,
      isBusy,
      measureViewport,
      messages.length,
      onTurnActiveChange,
      reconcile,
      scrollToSent,
      stream,
    ]
  );

  /**
   * 승인을 보낸다. **응답이 2차 스트림이다** — 도구 결과도 답변 본문도 이 응답으로 온다.
   * 그래서 꼬리가 `send()`와 같다: 정상 종료면 히스토리로 넘기고 로컬 사본을 접는다.
   *
   * 실패 사유를 돌려준다 — 카드가 그걸로 「다시 눌러도 소용없나」를 가른다.
   */
  const resolveApproval = useCallback(
    async (approvalId: string, decision: ApprovalDecision) => {
      if (!sessionId) return null;
      setIsSending(true);
      // 2차가 도는 동안에도 패널을 치우면 안 된다 — 답의 나머지가 통째로 사라진다.
      onTurnActiveChange(true);
      try {
        // **`?after=`를 실어 보낸다.** 없으면 서버가 이 재개가 뗀 블록의 시작부터
        // 재생해 **그 턴의 1차 절반을 통째로 다시 보낸다** — 단조 커서가 전부 버리므로
        // 화면은 멀쩡하지만 그 낭비가 그대로 와이어를 탄다. 한 렌더 낡은 값이라도
        // 실제 커서보다 작을 뿐이라 프레임을 잃지 않는다.
        const after = stream.state.seq;
        const final = await stream.resolveApproval(
          sessionId,
          getResolveToolApprovalUrl(
            sessionId,
            approvalId,
            after === null ? undefined : { after }
          ),
          { decision }
        );
        if (final?.phase !== "done") return final?.error ?? null;
        if (!(await reconcile(sessionId))) return null;
        setPendingUserMessage(null);
        stream.reset();
        return null;
      } finally {
        setIsSending(false);
        onTurnActiveChange(false);
      }
    },
    [onTurnActiveChange, reconcile, sessionId, stream]
  );

  const approval = useToolApproval({
    pending: stream.state.pendingApproval,
    streamPhase: stream.state.phase,
    resolve: resolveApproval,
  });

  /**
   * ★ **돌아오면 이어받는다.** 갈래는 넷이고 `activeTurn`이 가른다.
   *
   * | `activeTurn` | `lastTurn` | 무엇을 하나 |
   * |---|---|---|
   * | 있다 | (같은 턴인 것이 **정상**이다) | `cursor`부터 `GET /events`로 잇는다 |
   * | 없다 | `FAILED` | 실패 배너만 세운다. 이을 스트림이 없다 |
   * | 없다 | 그 밖 | 히스토리만 그린다 |
   * | 있다·`cursor === 0` | | 그래도 잇는다 — 버퍼가 빈 것이지 오류가 아니다 |
   *
   * **승인 대기는 스트림을 안 연다.** `GET /events`는 도는 턴이 없으면 밀린 것만 주고
   * 곧바로 닫으므로(`hasLiveTurn = IN_PROGRESS`) 여는 순간 EOF다. 상태만 세우고, 다음
   * 프레임은 승인 API가 여는 2차 스트림으로 받는다.
   */
  const handledTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sessionId || !history || isSending) return;
    const turnId = activeTurn?.turnId ?? lastTurn?.turnId;
    if (!turnId) return;
    // 같은 턴에 두 번 붙지 않는다. 이 탭이 시작한 턴도 여기 걸린다 —
    // `stream.state.turnId`가 이미 그 값이라 중지 직후의 재조회가 되살리지 못한다.
    const key = `${sessionId}:${turnId}`;
    if (handledTurnRef.current === key || stream.state.turnId === turnId)
      return;
    handledTurnRef.current = key;

    if (!activeTurn) {
      // 도는 턴이 없을 때만 실패를 그린다 — 도는 턴이 곧 마지막 턴인 것이 정상이라,
      // 안 가리면 흐르는 답 위에 실패 배너가 뜬다.
      if (lastTurn?.status === "FAILED") {
        stream.seed(failedTurnState(lastTurn.failureCode, lastTurn.retryable));
      }
      return;
    }

    const resumed = resumedState({
      cursor,
      turnId: activeTurn.turnId,
      pendingApproval: activeTurn.pendingApproval
        ? {
            approvalId: activeTurn.pendingApproval.approvalId,
            tool: activeTurn.pendingApproval.tool,
            summary: activeTurn.pendingApproval.summary,
            // 라이브에서는 `tool_call_start`가 나르지만 돌아온 화면은 그 프레임을 못 봤다 —
            // 없으면 카드가 「무엇을 승인하나」를 못 말한다.
            //
            // **여기 오는 것은 JSON 문자열이다.** server 가 `jsonb` 를 Kotlin `String`
            // 으로 들고 있다가 그대로 내보낸다 — 라이브의 객체와 모양이 다르다.
            args: toolArgs(activeTurn.pendingApproval.args),
          }
        : null,
    });

    // 승인 카드가 서 있다 — 열 스트림이 없다. 상태만 세운다.
    if (activeTurn.pendingApproval) {
      stream.seed(resumed);
      return;
    }

    void stream.resume(sessionId, resumed).then(async (final) => {
      // 이어받은 턴이 정상으로 끝났다 — 히스토리로 넘겨야 `activeTurn`이 비고 전송이 풀린다.
      if (final?.phase !== "done") return;
      if (await reconcile(sessionId)) stream.reset();
    });
  }, [
    activeTurn,
    cursor,
    history,
    isSending,
    lastTurn,
    reconcile,
    sessionId,
    stream,
  ]);

  /**
   * ★ **재생으로 못 채운 자리를 굳은 기록으로 메운다.**
   *
   * 부르는 자리가 둘인데 뜻은 하나다 — 「스트림이 준 것만으로는 이 대화를 못 그린다」.
   *
   * | 신호 | 누가 말했나 |
   * |---|---|
   * | `needsResync` (`stream_resync`) | **서버가 말했다.** 로그 바닥 아래에서 붙어서 그 구간을 재생으로 못 준다 |
   * | `stalled` | **아무도 안 말한다.** 재연결을 여섯 번 하고 포기했다 |
   *
   * 둘 다 `GET /messages`가 유일한 사실이 된다. **안 읽으면 본문에 구멍이 난 채로
   * 조용히 흘러간다** — 오류도 로그도 없이. 이 설계가 없애려던 실패가 그것이다.
   *
   * **`messagesQuery`로는 못 한다.** 흐르는 동안 `enabled`가 꺼져 있고, 켜져도 전역
   * `staleTime` 60초에 걸려 방금 굳은 답이 안 온다. `reconcile()`은 `fetchQuery`라
   * `enabled`를 안 보고 `staleTime: 0`으로 실제 왕복을 돈다 — 결과는 같은 캐시 키에
   * 들어가므로 꺼져 있는 쿼리도 그 값으로 다시 그린다.
   *
   * `stalled`에서는 `isStreaming`이 풀려 **흐르는 턴을 가리던 필터도 함께 열린다** —
   * 그래서 그 사이 서버에서 끝난 답이 그 자리에 그대로 선다.
   *
   * 한 턴에 한 번씩만 당긴다. 안 막으면 `needsResync`가 세워진 채로 남아 있어서
   * 이 효과가 다시 도는 렌더마다 왕복이 하나씩 난다.
   */
  const resyncedTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sessionId) return;
    // 재연결을 다 쓰고 포기했으면 히스토리를 다시 읽는다 — 그 사이 서버에서 턴이
    // 끝나 있을 수 있고, **끊긴 전송을 받는 것이 히스토리 재조회**다.
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
    void reconcile(sessionId);
  }, [
    reconcile,
    sessionId,
    stream.state.error?.code,
    stream.state.needsResync,
    stream.state.phase,
    stream.state.turnId,
  ]);

  /**
   * 중지. **두 가지를 같이 한다** — 이 탭의 구독을 끊고(즉시 멈춘 것처럼 보인다),
   * 서버의 턴을 취소한다. 끊기만 하면 답이 계속 쌓이고 다음 전송이 409를 받는다.
   *
   * 204는 **접수가 아니라 확정**이고 멱등이다(이미 끝난 턴에도 204). 그래도 화면이 멈추는
   * 신호로 쓰지 않는다 — 그건 `turn_cancelled` 프레임이고 `stop()`이 이미 먼저 막았다.
   */
  const cancelTurn = useCancelAgentChatTurn();
  const stopTurn = useCallback(() => {
    const turnId = stream.state.turnId;
    stream.stop();
    if (!sessionId || !turnId) return;
    cancelTurn.mutate(
      { chatId: sessionId, turnId },
      {
        // 취소된 턴의 기록과 `activeTurn: null`을 다시 읽는다. 안 읽으면 잠금이 안 풀린다.
        onSuccess: () => void reconcile(sessionId),
      }
    );
  }, [cancelTurn, reconcile, sessionId, stream]);

  /**
   * ★ 대화를 갈아 끼울 때 비우는 것들. **스트림을 먼저 끊는다** — 안 끊으면 앞 대화의
   * 토큰이 새 스레드에 그려지고, `isBusy` 의 `isStreaming` 이 **새 대화의 전송까지**
   * 잠근다. 패널은 하나뿐이라 대화가 갈려도 언마운트가 없어서 상태가 그대로 넘어온다.
   *
   * 끊어도 잃는 것이 없다. 서버의 턴은 계속 돌고 이벤트는 버퍼에 쌓이므로, 그 대화로
   * 돌아오면 `activeTurn` 과 `cursor` 로 이어받는다.
   */
  const clearForChatSwitch = useCallback(() => {
    stream.reset();
    setPendingUserMessage(null);
    // ★ 굳혀 둔 질문 시각도 함께 푼다 — 안 풀면 옛 `turnBaseline` 자리의 엉뚱한 행에
    // 앞 대화의 시각이 얹힌다.
    setPendingUserAt(null);
    setLastSent(null);
    // **문장도 범위도 함께 비운다.** 범위는 턴이 드는 값이라 대화가 갈리면 이어질
    // 이유가 없다. 남겨 두면 다음 질문이 앞 대화의 범위로 조용히 나간다.
    editorRef.current?.clear();
    setChips([]);
    // 지운 기억도 함께 푼다 — 다른 대화는 처음부터다.
    dismissedRef.current.clear();
    prefilledRef.current.clear();
    // **다시 붙인다.** 회의록 안에 서 있으면 그 회의록이 다시 힌트다. 효과에 맡기면
    // `suggestedNote` 가 안 바뀌어 다시 안 돈다.
    prefillSuggested();
    // ★ **이어받기 기억도 푼다.** 이 값이 남으면 A → B → A 로 돌아왔을 때 A의 도는
    // 턴이 「이미 붙었던 턴」으로 걸려 다시 안 붙는다 — 스트림은 방금 끊었는데.
    handledTurnRef.current = null;
  }, [prefillSuggested, stream]);

  /**
   * 목록에서 다른 대화를 골랐다.
   *
   * **`createdChatId` 를 같이 비운다.** 계약 공식이 그것을 먼저 보므로, 안 비우면
   * 새 대화를 만든 뒤에는 목록에서 무엇을 골라도 화면이 안 바뀐다.
   */
  const switchChat = useCallback(
    (chatId: string) => {
      // **고르면 곧바로 스레드로 돌아온다.** 같은 대화를 다시 골랐어도 마찬가지다 —
      // 누른 사람은 「이 대화를 보겠다」고 말한 것이고, 목록에 남으면 아무 일도 안 한 것처럼 보인다.
      setView("thread");
      if (isSwitchBlocked || chatId === sessionId) return;
      clearForChatSwitch();
      setCreatedChatId(null);
      // 빈 새 대화를 쓰던 중이었으면 그 상태가 여기서 풀린다 — 이제 가리킬 대화가 있다.
      setIsDraftChat(false);
      setSelectedChatId(chatId);
    },
    [clearForChatSwitch, isSwitchBlocked, sessionId]
  );

  /**
   * ★ **＋ 는 서버를 안 부른다.** 화면만 빈 새 대화로 바꾸고, 대화는 **첫 전송에서**
   * `ensureSession()` 이 만든다 — 그 구조는 원래부터 `send()` 가 쓰던 것이다.
   *
   * 누르는 즉시 만들면 아무 말도 안 하고 나간 빈 대화가 기록에 줄로 쌓인다. **＋ 를
   * 눌렀는데 아무 말도 안 했으면 그 대화는 존재한 적이 없다.**
   *
   * 이미 빈 새 대화면 아무 일도 안 일어난다 — 상태가 그대로다.
   */
  const startNewChat = useCallback(() => {
    setView("thread");
    if (isSwitchBlocked || isDraftChat) return;
    clearForChatSwitch();
    setSelectedChatId(null);
    setCreatedChatId(null);
    setIsDraftChat(true);
  }, [clearForChatSwitch, isDraftChat, isSwitchBlocked]);


  const router = useRouter();
  const openNote = useCallback(
    (noteId: string) => {
      router.push(`/w/${workspaceId}/notes/${noteId}?view=side&tab=details`);
    },
    [router, workspaceId]
  );

  /**
   * 칩 옆 백스페이스. **한 번은 선택, 두 번이 삭제**다 — 한 번에 지우면 본문을 고치려던
   * 백스페이스가 방금 붙인 범위를 말없이 뗀다.
   */
  /**
   * 편집기가 든 칩이 바뀌었다.
   *
   * **삭제는 백스페이스로 브라우저가 한다** — 칩이 `contentEditable="false"` 라 원자로
   * 지워집니다. 그래서 「지웠다」는 이벤트가 따로 없고, 사라진 것을 여기서 알아냅니다.
   * 프리필로 붙였던 회의록이 없어졌으면 **거절로 기억**합니다 — 안 그러면 회의록을
   * 나갔다 오는 것만으로 방금 지운 칩이 되살아납니다.
   */
  const handleChipsChange = useCallback((next: ScopeChip[]) => {
    const present = new Set(next.map((chip) => `${chip.kind}:${chip.id}`));
    prefilledRef.current.forEach((noteId) => {
      if (!present.has(`note:${noteId}`)) dismissedRef.current.add(noteId);
    });
    setChips(next);
  }, []);

  // 필요할 때만 목록을 받는다. 프로젝트 수만큼 조회가 나가는 팬아웃이라 채팅을 열기만
  // 해도 도는 것은 낭비다 — `@`를 치거나 프로젝트 칩이 붙었을 때(겹침 판정)만 깨운다.
  // `@` 를 치기 시작했거나 프로젝트 칩이 붙었을 때(겹침 판정)만 목록을 받는다.
  // 프로젝트 수만큼 조회가 나가는 팬아웃이라 채팅을 열기만 해도 도는 것은 낭비다.
  const [mentioning, setMentioning] = useState(false);
  const needsCatalog =
    mentioning || chips.some((chip) => chip.kind === "project");
  const catalog = useScopeCatalog(workspaceId, needsCatalog);
  const takenScope = useMemo(
    () => new Set(chips.map((chip) => `${chip.kind}:${chip.id}`)),
    [chips]
  );

  /**
   * 겹침 안내. **막지 않는다** — 경계가 단단해진 뒤에는 일부러 넓게 잡는 것이 합리적이고,
   * 판정에 쓰는 `projectId`는 이미 목록이 들고 있어 추가 조회가 0이다.
   */
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

  /**
   * ★ **도구 카드가 두 벌 그려지는 자리를 여기서 접는다.**
   *
   * 진행 중 턴의 `TOOL` 행은 히스토리(server가 흐르는 동안 tee한다)와 스트림 백로그
   * **양쪽**에서 온다. `groupHistory`와 `StreamBlocks`는 서로를 모르므로 둘 다 그린다.
   * 접는 열쇠는 `messages[].turnId`다.
   *
   * **`USER` 행은 안 접는다** — 스트림에 안 실리므로 접으면 이어받기 화면에서 질문이
   * 사라진다. 흐르는 동안에만 접는 것도 같은 이유다: 턴이 끝나면 그리는 쪽이 히스토리
   * 하나뿐이라, 계속 접으면 방금 끝난 답이 사라진다.
   */
  const visibleMessages = useMemo(() => {
    const turnId = stream.state.turnId;
    if (!isStreaming || !turnId) return messages;
    return messages.filter(
      (message) => message.role === "USER" || message.turnId !== turnId
    );
  }, [isStreaming, messages, stream.state.turnId]);

  /**
   * ★★ **방금 보낸 질문의 시각을 보낼 때 쓴 값으로 굳힌다.**
   *
   * 구분선은 보내는 동안에는 클라이언트 시계(`pendingUserAt`)로, 히스토리로 넘어간 뒤에는
   * 서버가 적은 `createdAt` 으로 판정된다 — **값의 출처가 다르다.** 두 시계가 자정을 사이에
   * 두고 어긋나면 보낼 때 세운 구분선이 히스토리가 오는 순간 사라진다. [W-12] 가 막던
   * 움직임이고 방향만 반대다.
   *
   * 그래서 판정을 **한 번만 내리고 얼린다.** 서버는 이 턴의 행을 `turnBaseline` 뒤에 USER
   * 부터 붙이므로 그 자리가 곧 방금 보낸 질문이다. 대화를 갈아 끼우면 `pendingUserAt` 이
   * 풀리므로 옛 기준선으로 엉뚱한 행을 건드리지 않는다.
   *
   * **턴 전체를 같은 만큼 옮긴다.** 질문만 옮기면 그 뒤의 답이 서버 시각 그대로라, 자정을
   * 낀 경우에 질문과 답 사이에 **없던 구분선이 하나 더 생긴다**(실제로 밟았다). 한 턴은
   * 한 시계 위에 있어야 한다.
   *
   * **바꾸는 것은 화면에 적히는 시각뿐이다** — 계약 데이터는 캐시에 그대로 있고, 여기서
   * 만드는 사본만 다르다.
   */
  const frozenMessages = useMemo(() => {
    const asked = visibleMessages[turnBaseline];
    if (!pendingUserAt || asked?.role !== "USER") return visibleMessages;
    const shift = Date.parse(pendingUserAt) - Date.parse(asked.createdAt);
    if (!shift) return visibleMessages;
    return visibleMessages.map((message, index) =>
      index < turnBaseline
        ? message
        : {
            ...message,
            createdAt: new Date(
              Date.parse(message.createdAt) + shift
            ).toISOString(),
          }
    );
  }, [pendingUserAt, turnBaseline, visibleMessages]);

  /**
   * 목록에 그릴 줄. **배지는 목록과 SSE 를 맞춘 값이다** — 지금 보는 대화는 두 출처에
   * 있고 목록이 한 주기만큼 늦는다 (`runningLabel`).
   */
  const chatRows = useMemo(
    () =>
      chats.map((chat) => ({
        chatId: chat.chatId,
        title: chat.title,
        // **정렬 기준을 그대로 싣는다.** 목록은 `updatedAt` 내림차순이고 줄에 적는 시각도
        // 그 값이라야 「1분 전인데 왜 세 번째 줄」이 안 생긴다.
        updatedAt: chat.updatedAt,
        label: runningLabel(chat, {
          chatId: sessionId,
          turnId: stream.state.turnId,
          phase: stream.state.phase,
        }),
      })),
    [chats, sessionId, stream.state.phase, stream.state.turnId]
  );

  /**
   * ★ **뷰가 갈리면 포커스를 손으로 옮긴다.** 드롭다운 메뉴였을 때는 라이브러리가 해 주던
   * 일이고, 상자 둘이 교대하는 지금은 아무도 안 해 준다 — 안 옮기면 키보드 사용자의 포커스가
   * `invisible` 이 된 상자 안에 남는다.
   *
   * 돌아올 때 「기록」 버튼으로 되돌리는 것은 disclosure 관용구다. 연 자리로 돌려준다.
   * 첫 렌더에서는 안 옮긴다 — 패널을 열자마자 포커스를 빼앗을 이유가 없다.
   */
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

  /**
   * 마지막 질문 아래에 남길 자리.
   *
   * ★ **뺄 것은 아래 여백 하나뿐이다**(`p-6` 의 24px). 위아래를 다 빼면 상자가 그만큼
   * 낮아져서, 바닥까지 내려도 상자 위에 24px 이 남고 **앞 메시지의 끝줄이 거기 보인다.**
   * 아래만 빼면 상자 위가 뷰포트 위와 맞고, 숨 쉴 자리는 상자 자신의 위 여백이 만든다
   * (`chat-thread` 의 `pt-6`).
   *
   * **이 대화에서 아직 아무것도 안 보냈으면 안 준다**(`pendingUserAt` 이 null). 옛 대화를
   * 열자마자 아래에 빈 자리가 생기면 읽을 것이 위로 밀린다.
   */
  const pinSlackPx =
    pendingUserAt && viewportHeight ? Math.max(0, viewportHeight - 24) : null;

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
      <header className="flex items-center gap-1 border-b border-[var(--el-hairline)] py-4 pr-3 pl-6">
        <div className="min-w-0 flex-1">
          {/* **첫 줄은 지금 보고 있는 대화의 제목이다.** 대화가 여럿 사는 화면에서 「내
              에이전트」는 어느 대화인지를 한 글자도 말하지 않았다. 방금 만든 대화는 아직
              목록에 없어서 기본 제목으로 선다. */}
          <p className="truncate text-sm font-medium text-[var(--el-ink)]">
            {chatRows.find((chat) => chat.chatId === sessionId)?.title ??
              "새 대화"}
          </p>
          {/* design.pen: 범위는 칩이 말한다. 칩이 없으면 워크스페이스 전체라고 적는다 —
           **범위를 모르는 채 넓어지지 않게** 하는 것이 이 한 줄의 일이다. */}
          <p className="truncate text-[11px] text-[var(--el-muted)]">
            {chips.length
              ? "나만 보는 대화입니다"
              : `나만 보는 대화 · ${workspaceName ?? "워크스페이스"} 전체`}
          </p>
        </div>
        {/* **글자 없이 아이콘만이다.** 셋이 나란히 서는 자리라 라벨을 달면 좁은 폭에서
            제목을 밀어낸다. 이름은 `aria-label`이 진다.

            잠그는 값은 `isSwitchBlocked`이지 `isBusy`가 아니다 — 답변이 흐르는 중에도
            대화를 갈아 끼울 수 있어야 한다. 앞 대화를 안 죽이는 것이 I08 이고, `isBusy`로
            잠그면 대화가 여럿 사는 것을 화면이 막는다. */}
        <Button
          data-testid="chat-list-new"
          variant="ghost"
          size="icon"
          aria-label="새 대화"
          disabled={isSwitchBlocked}
          onClick={startNewChat}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          ref={historyButtonRef}
          variant="ghost"
          size="icon"
          aria-label="기록"
          disabled={isSwitchBlocked}
          onClick={() => setView("history")}
        >
          <History className="size-4" />
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

      {/* 스레드와 기록이 나눠 쓰는 상자. **뜨는 레이어가 아니다** — 옆으로 교대할 뿐이라
          패널 밖으로 나가지 않고, 좁은 폭에서 잘리지도 않는다. */}
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
                    {isChatsUnavailable
                      ? "기존 대화가 있는지 확인하지 못해 새 대화를 시작하지 않습니다."
                      : "이어서 보내면 화면과 실제 대화가 어긋나므로 전송을 막아 둡니다."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-[30px]"
                    onClick={() =>
                      void (isChatsUnavailable
                        ? chatsQuery.refetch()
                        : messagesQuery.refetch())
                    }
                  >
                    다시 시도
                  </Button>
                </div>
              ) : (
                <ChatThread
                  messages={frozenMessages}
                  // 즉시 반영이 실패해 로컬 턴을 남겨 뒀는데, 나중에 히스토리가 스스로
                  // 성공하면 같은 턴이 두 벌 보인다. 히스토리가 이 답변을 담고 있으면
                  // 로컬 사본을 그린다 — 지우는 게 아니라 **가린다**(상태 변경 없음).
                  stream={isTurnReconciled ? initialStreamState : stream.state}
                  pendingUserMessage={
                    isTurnReconciled ? null : pendingUserMessage
                  }
                  pendingUserAt={pendingUserAt}
                  pinSlackPx={pinSlackPx}
                  // 아직 히스토리에서 안 돌아온 낙관적 사본이다. **서버가 돌려줄 모양으로**
                  // 맞춘다 — 칩 타입은 소문자이고 히스토리는 대문자라, 여기서 안 올리면
                  // 방금 보낸 말풍선만 다른 규칙으로 그려진다.
                  pendingUserScope={pendingScope.map((chip) => ({
                    kind: chip.kind.toUpperCase() as "NOTE" | "PROJECT",
                    id: chip.id,
                    title: chip.title,
                    unavailable: false,
                  }))}
                  // 유휴 타이머가 stalled로 표시한 순간에는 앞 전송이 아직 `finally`에
                  // 닿지 않아 잠금이 살아 있다. 그때 reset하면 안내만 지우고 재전송은
                  // 무시돼 고아 메시지가 남는다.
                  isRetryDisabled={isBusy || !lastSent}
                  onRetry={() => {
                    if (isBusy || !lastSent) return;
                    /**
                     * **늘 새 턴이다.** 앞 턴이 아직 살아 있으면 서버가 409로 막고, 그 갈래가
                     * 히스토리를 다시 읽어 이어받기로 넘긴다 — 여기서 가릴 것이 없다.
                     */
                    stream.reset();
                    void send(lastSent);
                  }}
                  onApprove={approval.approve}
                  approvalCard={approval.card}
                  onOpenNote={openNote}
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
                            // **바로 안 보낸다.** 붙여 둔 칩이 그대로 딸려 나가는 것이
                            // 뜻밖이라, 문장만 컴포저에 넣고 보낼지는 사용자가 정한다.
                            // 칩을 빼고 싶으면 그 자리에서 지우면 된다.
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

          {/* **칩이 문장 안에 산다.** 무엇을 범위로 보내는지가 쓰는 자리에서 그대로 보인다. */}
          <ChatComposer
            inputRef={editorRef}
            onSubmit={(draft) => void send(draft.text, draft.chips)}
            onStop={stopTurn}
            isBusy={isBusy}
            isStreaming={isStreaming}
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
                {stream.state.phase === "awaiting_approval" ? (
                  <p className="mt-2 text-xs text-[var(--el-muted)]">
                    승인을 기다리는 동안에는 입력할 수 없습니다.
                  </p>
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
            chats={chatRows}
            currentChatId={sessionId}
            onSelect={switchChat}
            onBack={() => setView("thread")}
            backRef={backButtonRef}
          />
        </div>
      </div>
    </aside>
  );

  // 포털이라 **이 컴포넌트는 그대로 남는다.** 스트림을 쥐고 있는 훅이 여기 있어서, 자리가
  // 떠 있는 카드에서 레일로 옮겨가도 흐르던 답변이 끊기지 않는다(옮겨지는 것은 DOM뿐이다).
  return railSlot ? createPortal(panel, railSlot) : panel;
}
