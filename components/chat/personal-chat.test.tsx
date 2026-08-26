import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PersonalChatProvider,
  usePersonalChatScope,
} from "@/components/chat/personal-chat";

// 근거 칩·도구 칩을 누르면 그 회의록으로 간다 — 이 테스트는 라우터 밖에서 돈다.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const WORKSPACE_ID = "01K0000000001";
const NOTE_ID = "01K0000000002";
const CHAT_ID = "01K0000000003";
const NEW_CHAT_ID = "01K0000000004";
const OTHER_CHAT_ID = "01K0000000005";

/**
 * 목록 한 줄. **정렬은 서버가 한다** — 여기서는 배열 순서가 곧 `updatedAt` 내림차순이고,
 * 첫 줄이 「마지막으로 쓴 대화」다.
 */
const RUNNING_TURN = {
  turnId: "0K9GVJT2C4Q3B",
  status: "IN_PROGRESS",
} as const;

function chatRow(
  chatId: string,
  runningTurn: { turnId: string; status: string } | null = null,
  /**
   * 마지막으로 쓴 시각. **정렬 기준이자 줄에 적히는 값**이라 목록 줄에는 늘 있어야 한다 —
   * 비워 두면 `Invalid Date`가 화면에 뜬다. 기본값은 「지금」이라 검사가 시계에 안 매인다.
   */
  updatedAt: string = new Date().toISOString()
) {
  return { chatId, title: `대화 ${chatId}`, runningTurn, updatedAt };
}

type ActiveTurn = {
  turnId: string;
  status: string;
  pendingApproval: {
    approvalId: string;
    tool: string;
    summary: string | null;
  } | null;
} | null;

const state = vi.hoisted(() => ({
  /** 대화 목록이 주는 것. 첫 줄이 마지막으로 쓴 대화다. */
  chats: [] as { chatId: string; title: string; runningTurn: unknown }[],
  messages: [] as unknown[],
  /** `GET /messages`가 히스토리 옆에 싣는 이어받기 상태. */
  cursor: 0,
  activeTurn: null as ActiveTurn,
  /** 대화별 도는 턴. 없는 대화는 `activeTurn` 을 쓴다. */
  activeTurnByChat: {} as Record<string, ActiveTurn>,
  lastTurn: null as {
    turnId: string;
    status: string;
    failureCode: string | null;
    retryable: boolean | null;
  } | null,
  /** 이어받기가 `GET /events`로 받는 프레임. `id:` 줄이 곧 seq다. */
  resumeFrames: [] as { event: string; data: string; id?: string }[],
  resumeUrls: [] as string[],
  createMock: vi.fn(),
  cancelMock: vi.fn(),
  approveMock: vi.fn(),
  refetchMock: vi.fn(),
  refetchedChatIds: [] as string[],
  chatsFail: false,
  refreshFails: false,
  historyFails: false,
  historyMissing: false,
  chatsLoading: false,
  createPending: false,
  chatsParams: [] as unknown[],
  messagesArgs: [] as unknown[],
  streamCalls: [] as { url: string; body: unknown }[],
  aborted: false,
  holdStream: false,
  /** 스트림을 아예 못 연다. 실패 배너와 「다시 보내기」가 뜨는 유일한 경로다. */
  streamFails: false,
  /** 그때 던지는 오류 봉투. 409는 실패가 아니라 이어받기라 갈래가 다르다. */
  streamFailure: null as unknown,
  /** 스트림이 `turn_started`를 낸다 — 서버에 턴이 실제로 생겼다는 유일한 신호다. */
  streamTurnId: null as string | null,
  /** 시작한 뒤 `turn_cancelled`로 굳는다. 「중지」가 만드는 그 결말이다. */
  cancelsAfterStart: false,
  /** 이어받기 스트림을 열어 둔다 — 중지 버튼이 떠 있어야 누를 수 있다. */
  holdResume: false,
  approvalStream: false,
  approvalError: null as unknown,
  releaseStream: null as (() => void) | null,
  /**
   * 재조회 **직전에** 목을 바꾸는 손잡이. 「보내는 사이에 서버 쪽이 달라졌다」를 재현하는
   * 유일한 수단이다 — 미리 세우면 `isBusy` 가 전송 자체를 막아 그 자리에 못 간다.
   */
  onRefetch: null as (() => void) | null,
}));

/**
 * `GET /messages` 응답의 `data`. 히스토리와 이어받기 상태가 한 봉투에 온다.
 *
 * **대화마다 다를 수 있다** — 대화를 갈아 끼우는 검사는 「A는 돌고 B는 안 돈다」가
 * 필요한데, 하나로 두면 어느 대화를 열어도 같은 턴이 보여 그 자리가 안 재진다.
 */
const historyData = vi.hoisted(() => (chatId: string) => ({
  messages: state.messages,
  cursor: state.cursor,
  activeTurn: state.activeTurnByChat[chatId] ?? state.activeTurn,
  lastTurn: state.lastTurn,
}));

vi.mock("@/lib/api/generated/agent-chat/agent-chat", async () => {
  // **캐시에 실제로 붙기 위해서다.** `reconcile()` 은 `fetchQuery` 라 훅의 `enabled` 를
  // 안 보고 캐시에만 써 넣는다 — 목이 캐시를 안 구독하면 그 왕복이 화면에 영영 안 닿고,
  // 「재조회가 화면에 반영되나」를 묻는 검사가 제품이 아니라 목을 재게 된다.
  const { useQuery } = await import("@tanstack/react-query");
  return {
    getGetAgentChatsQueryKey: (workspaceId: string) => [
      "/v1/workspaces",
      workspaceId,
      "agent-chats",
    ],
    getGetAgentChatMessagesQueryKey: (chatId: string) => ["messages", chatId],
    // 첫 전송은 방금 만든 chatId로 직접 가져온다 — 훅의 refetch는 아직 빈 id에 묶여 있다.
    getGetAgentChatMessagesQueryOptions: (chatId: string) => ({
      queryKey: ["messages", chatId],
      queryFn: () => {
        state.refetchedChatIds.push(chatId);
        state.onRefetch?.();
        if (state.refreshFails) throw new Error("REFRESH_FAILED");
        return {
          status: 200,
          data: { success: true, data: historyData(chatId) },
        };
      },
    }),
    getSendAgentChatMessageUrl: (chatId: string) =>
      `/v1/agent-chats/${chatId}/messages`,
    // 2차도 `?after=`를 받는다. 없으면 서버가 그 턴의 1차 절반을 통째로 다시 보낸다.
    getResolveToolApprovalUrl: (
      chatId: string,
      approvalId: string,
      params?: { after?: string }
    ) =>
      params?.after === undefined
        ? `/v1/agent-chats/${chatId}/approvals/${approvalId}/resolve`
        : `/v1/agent-chats/${chatId}/approvals/${approvalId}/resolve?after=${params.after}`,
    // 재연결 URL의 단일 출처가 생성물이다. `after`가 없으면 처음부터 받는다 —
    // `0`은 생략이 아니라 「버퍼가 비었다」다.
    getGetAgentChatEventsUrl: (chatId: string, params?: { after?: string }) =>
      params?.after === undefined
        ? `/v1/agent-chats/${chatId}/events`
        : `/v1/agent-chats/${chatId}/events?after=${params.after}`,
    useGetAgentChats: (workspaceId: string) => {
      state.chatsParams.push(workspaceId);
      return {
        isPending: false,
        isLoading: state.chatsLoading,
        // 폴링이라 배경 재조회가 늘 돌고 있다. 잠금이 이 값을 보면 주기마다 잠긴다.
        isFetching: true,
        refetch: vi.fn(),
        data: state.chatsLoading
          ? undefined
          : state.chatsFail
            ? { status: 500, data: { success: false, data: null } }
            : {
                status: 200,
                data: { success: true, data: { chats: state.chats } },
              },
      };
    },
    useGetAgentChatMessages: (chatId: string, options: unknown) => {
      state.messagesArgs.push({ chatId, options });
      // 값은 아래 `state` 가 정한다. 이 구독이 하는 일은 **캐시가 바뀌면 다시 그리는 것**
      // 하나뿐이라 `enabled: false` 로 둔다 — 자기 queryFn 을 돌리면 안 된다.
      useQuery({ queryKey: ["messages", chatId], enabled: false });
      // enabled:false여도 TanStack은 pending으로 둔다 — 화면이 isPending을 믿으면
      // 대화가 없을 때 스켈레톤에 갇힌다.
      const enabled = Boolean(chatId);
      const data =
        enabled && !state.historyFails && !state.historyMissing
          ? { status: 200, data: { success: true, data: historyData(chatId) } }
          : undefined;
      return {
        isPending: !enabled,
        isLoading: false,
        isError: enabled && (state.historyFails || state.historyMissing),
        error: state.historyMissing
          ? {
              success: false,
              data: null,
              error: {
                code: "AGENT_CHAT_NOT_FOUND",
                message: "없는 대화입니다.",
              },
            }
          : null,
        refetch: state.refetchMock.mockResolvedValue(
          state.refreshFails ? { data: { status: 500 } } : { data }
        ),
        data,
      };
    },
    useCreateAgentChat: () => ({
      mutateAsync: state.createMock,
      isPending: state.createPending,
    }),
    // 204는 접수가 아니라 확정이고 멱등이다. 화면이 멈추는 신호로는 안 쓴다.
    useCancelAgentChatTurn: () => ({
      mutate: (variables: unknown, options?: { onSuccess?: () => void }) => {
        state.cancelMock(variables);
        options?.onSuccess?.();
      },
      isPending: false,
    }),
  };
});

vi.mock("@/lib/api/sse", () => ({
  // 이어받기가 이 문으로 들어온다. 빈 채로 두면 곧바로 EOF이고, 그건 실패가 아니라
  // 재연결 신호다 — `cursor: 0`(버퍼가 비었다) 경로가 정확히 그 모양이다.
  getEventStream: async function* (url: string) {
    state.resumeUrls.push(url);
    for (const frame of state.resumeFrames) yield frame;
    if (state.holdResume) await new Promise<void>(() => {});
  },
  postEventStream: async function* (
    url: string,
    body: unknown,
    options?: { signal?: AbortSignal }
  ) {
    state.streamCalls.push({ url, body });
    // **모든 프레임이 `id:` 줄을 갖는다.** 계약이 그렇고, 안 실으면 화면 커서가 한 번도
    // 안 움직여 `?after=` 를 쓰는 자리를 목으로 하나도 못 밟는다. 2차는 새 블록이다.
    let seq = url.includes("/approvals/") ? 1_000 : 0;
    const framed = (event: string, payload: unknown) => ({
      event,
      data: JSON.stringify(payload),
      id: String((seq += 1)),
    });
    options?.signal?.addEventListener("abort", () => {
      state.aborted = true;
    });
    // **승인 응답이 2차 스트림이다.** 같은 문으로 들어오고 URL로만 갈린다.
    if (url.includes("/approvals/")) {
      state.approveMock({ url, body });
      if (state.approvalError) throw state.approvalError;
      // 확정은 이 스트림의 첫 프레임이 한다 — 그때까지 붙잡아 둔다.
      await new Promise<void>((resolve) => {
        state.releaseStream = resolve;
      });
      yield framed("tool_approval_resolved", {
        approvalId: "0K9GVJT2C4Q7F",
        decision: "APPROVED",
      });
      yield framed("tool_call_result", {
        toolCallId: "call_02",
        status: "success",
      });
      yield framed("message_end", {
        messageId: "m1",
        content: "만들었습니다.",
      });
      return;
    }
    if (state.streamFails) {
      throw (
        state.streamFailure ?? {
          success: false,
          data: null,
          error: { code: "LLM_PROVIDER_ERROR", message: "응답 생성 실패" },
        }
      );
    }
    if (state.streamTurnId) {
      yield framed("turn_started", { turnId: state.streamTurnId, startSeq: 0 });
    }
    if (state.cancelsAfterStart) {
      yield framed("turn_cancelled", { turnId: state.streamTurnId });
      return;
    }
    yield framed("message_start", { chatId: CHAT_ID, messageId: "m1" });
    yield framed("token", { delta: "정리했" });
    if (state.approvalStream) {
      yield framed("tool_approval_request", {
        approvalId: "0K9GVJT2C4Q7F",
        toolCallId: "call_02",
        tool: "linear.create_issue",
        summary: "Linear 이슈 생성",
      });
      // **1차는 여기서 끝난다.** 이어질 프레임은 승인 API의 2차 스트림이 낸다.
      return;
    }
    if (state.holdStream) {
      await new Promise<void>((resolve) => {
        state.releaseStream = resolve;
      });
    }
    yield framed("message_end", {
      messageId: "m1",
      content: "정리했습니다.",
    });
  },
}));

function NoteScope({
  hidden,
  noteId = NOTE_ID,
}: {
  hidden: boolean;
  noteId?: string;
}) {
  usePersonalChatScope({ noteId, title: "주간 제품 회의", hidden });
  return null;
}

function renderChat(child?: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const view = render(
    <QueryClientProvider client={client}>
      <PersonalChatProvider workspaceId={WORKSPACE_ID} workspaceName="헤이모아">
        {child}
      </PersonalChatProvider>
    </QueryClientProvider>
  );
  return { ...view, invalidate, client };
}

function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: "개인 챗봇 열기" }));
}

/** 헤더의 ⟲. 누르면 기록 목록이 스레드 자리로 밀려 들어온다. */
function historyButton() {
  return screen.getByRole("button", { name: "기록" });
}

function clickNewChat() {
  // 기본 제목이 「새 대화」라 목록 행과 ＋ 버튼의 접근명이 겹친다 — 누르는 자리를 testid 로 가른다.
  fireEvent.click(screen.getByTestId("chat-list-new"));
}

/** 기록을 열고 그 대화를 고른다. 고르면 곧바로 스레드로 돌아온다. */
function pickChat(chatId: string) {
  fireEvent.click(historyButton());
  fireEvent.click(screen.getByRole("button", { name: new RegExp(chatId) }));
}

/**
 * 편집기에 문장을 넣는다. **`contenteditable` 이라 `value` 가 없다** — 칩이 문장 안에
 * 사는 구조라서 문자열 하나로는 담기지 않는다.
 */
function write(text: string) {
  const input = screen.getByRole("textbox", { name: "메시지" });
  input.textContent = text;
  const range = document.createRange();
  range.selectNodeContents(input);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  fireEvent.input(input);
  return input;
}

/** 편집기 안에 박힌 칩. 칩이 문장 안에 살아서 별도 목록이 없다. */
function chipsInInput() {
  return [
    ...screen
      .getByRole("textbox", { name: "메시지" })
      .querySelectorAll("[data-scope-chip]"),
  ].map((el) => el.textContent?.trim());
}

/** 칩을 백스페이스로 지운다 — 브라우저가 하는 일을 흉내 낸다. */
function removeChipFromInput(title: string) {
  const input = screen.getByRole("textbox", { name: "메시지" });
  const chip = [...input.querySelectorAll("[data-scope-chip]")].find((el) =>
    el.textContent?.includes(title)
  );
  chip?.remove();
  fireEvent.input(input);
}

async function sendMessage(text: string) {
  write(text);
  fireEvent.click(screen.getByRole("button", { name: "보내기" }));
}

describe("PersonalChatProvider", () => {
  beforeEach(() => {
    state.chats = [];
    state.messages = [];
    state.chatsParams = [];
    state.messagesArgs = [];
    state.streamCalls = [];
    state.aborted = false;
    state.holdStream = false;
    state.streamFails = false;
    state.streamFailure = null;
    state.streamTurnId = null;
    state.cancelsAfterStart = false;
    state.holdResume = false;
    state.approvalStream = false;
    state.approvalError = null;
    state.releaseStream = null;
    state.onRefetch = null;
    state.chatsFail = false;
    state.refreshFails = false;
    state.historyFails = false;
    state.historyMissing = false;
    state.chatsLoading = false;
    state.createPending = false;
    state.refetchMock.mockReset();
    state.refetchedChatIds = [];
    state.cursor = 0;
    state.activeTurn = null;
    state.activeTurnByChat = {};
    state.lastTurn = null;
    state.resumeFrames = [];
    state.resumeUrls = [];
    state.cancelMock.mockReset();
    state.createMock.mockReset().mockResolvedValue({
      status: 201,
      data: { success: true, data: { chatId: NEW_CHAT_ID } },
    });
    state.approveMock.mockReset();
  });

  afterEach(cleanup);

  it("대화가 하나도 없으면 빈 상태를 보인다", () => {
    renderChat();
    openPanel();
    expect(screen.getByText("아직 시작된 대화가 없습니다.")).toBeTruthy();
    expect(state.messagesArgs.at(-1)).toMatchObject({
      chatId: "",
      options: { query: { enabled: false } },
    });
  });

  it("목록 첫 줄의 chatId로 히스토리를 읽는다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.messages = [
      {
        createdAt: "2026-07-24T00:00:00Z",
        role: "ASSISTANT",
        content: "지난 회의 요약입니다.",
        toolEvent: null,
      },
    ];
    renderChat();
    openPanel();
    await waitFor(() =>
      expect(state.messagesArgs.at(-1)).toMatchObject({ chatId: CHAT_ID })
    );
    expect(screen.getByText("지난 회의 요약입니다.")).toBeTruthy();
  });

  it("대화가 없으면 첫 전송이 대화를 만들고 그 id로 스트림을 연다", async () => {
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.createMock).toHaveBeenCalledTimes(1));
    expect(state.createMock).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      data: {},
    });
    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    expect(state.streamCalls[0]).toEqual({
      url: `/v1/agent-chats/${NEW_CHAT_ID}/messages`,
      // **범위가 요청 본문에 실린다.** 붙인 것이 없으면 빈 배열이고, 그것이 곧
      // "워크스페이스 전체가 범위"라는 뜻이다.
      body: {
        message: "정리해줘",
        noteIds: [],
        projectIds: [],
      },
    });

    // 히스토리도 **방금 만든** chatId로 다시 읽어야 한다. 훅의 refetch를 쓰면 아직
    // 빈 id에 묶여 있어 `/v1/agent-chats//messages`를 부른다.
    await waitFor(() => expect(state.refetchedChatIds).toEqual([NEW_CHAT_ID]));
  });

  it("목록에 대화가 있으면 새로 만들지 않는다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    expect(state.createMock).not.toHaveBeenCalled();
    expect(state.streamCalls[0].url).toBe(
      `/v1/agent-chats/${CHAT_ID}/messages`
    );
  });

  it("정상 종료 뒤 히스토리를 다시 읽고 스트림을 비운다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
    // 스트림이 비워지면 진행 중 텍스트가 사라진다.
    await waitFor(() => expect(screen.queryByText("정리했습니다.")).toBeNull());
  });

  it("히스토리 갱신이 실패하면 방금 끝난 턴을 지우지 않는다", async () => {
    // invalidateQueries·refetch는 갱신이 실패해도 resolve한다. 그걸 믿고 지우면
    // 캐시에 없는 방금 턴이 화면에서 사라진다.
    state.chats = [chatRow(CHAT_ID)];
    state.refreshFails = true;
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
    expect(screen.getByText("정리했습니다.")).toBeTruthy();
    expect(screen.getByText("정리해줘")).toBeTruthy();
  });

  it("목록 조회가 실패하면 빈 상태 대신 오류를 보이고 대화를 만들지 않는다", async () => {
    state.chatsFail = true;
    renderChat();
    openPanel();

    expect(screen.getByRole("alert").textContent).toContain(
      "대화를 불러오지 못했습니다."
    );
    expect(screen.queryByText("아직 시작된 대화가 없습니다.")).toBeNull();
    expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
      "disabled",
      true
    );
    expect(state.createMock).not.toHaveBeenCalled();
  });

  it("전송이 끝나기 전 두 번째 전송을 받지 않는다", async () => {
    // 스트리밍 구간만 잠그면 세션 생성 중 두 번째 전송이 세션을 하나 더 만든다.
    renderChat();
    openPanel();
    await sendMessage("정리해줘");
    await sendMessage("한 번 더");

    await waitFor(() => expect(state.streamCalls.length).toBeGreaterThan(0));
    expect(state.createMock).toHaveBeenCalledTimes(1);
    expect(state.streamCalls).toHaveLength(1);
  });

  it("★ ＋ 는 서버를 안 부르고 화면만 빈 새 대화로 바꾼다", async () => {
    // 누르는 즉시 만들면 아무 말도 안 하고 나간 빈 대화가 기록에 줄로 쌓인다.
    // **＋ 를 눌렀는데 아무 말도 안 했으면 그 대화는 존재한 적이 없다.**
    state.chats = [chatRow(CHAT_ID)];
    state.messages = [
      {
        createdAt: "2026-07-24T00:00:00Z",
        role: "ASSISTANT",
        content: "이전 대화입니다.",
        toolEvent: null,
      },
    ];
    renderChat();
    openPanel();
    await waitFor(() =>
      expect(screen.getByText("이전 대화입니다.")).toBeTruthy()
    );

    clickNewChat();

    expect(state.createMock).not.toHaveBeenCalled();
    expect(screen.queryByText("이전 대화입니다.")).toBeNull();
    expect(screen.getByText("아직 시작된 대화가 없습니다.")).toBeTruthy();
  });

  it("★ ＋ 를 누른 뒤에 목록 첫 줄이 대신 열리지 않는다", async () => {
    // `sessionId` 의 fallback 이 `chats[0]` 이라, 고른 것만 비우면 방금 쓰던 대화가
    // 그대로 열린다 — ＋ 를 눌렀는데 아무것도 안 바뀐 것처럼 보인다.
    state.chats = [chatRow(CHAT_ID)];
    renderChat();
    openPanel();
    await waitFor(() =>
      expect(state.messagesArgs.at(-1)).toMatchObject({ chatId: CHAT_ID })
    );

    clickNewChat();

    // 히스토리 조회가 아무 대화도 안 가리킨다 — 열린 대화가 없다는 뜻이다.
    const last = state.messagesArgs.at(-1) as {
      chatId: string;
      options: { query: { enabled: boolean } };
    };
    expect(last.chatId).toBe("");
    expect(last.options.query.enabled).toBe(false);
  });

  it("★ ＋ 를 두 번 눌러도 아무 일이 없다", () => {
    state.chats = [chatRow(CHAT_ID)];
    renderChat();
    openPanel();
    clickNewChat();
    write("쓰던 문장");
    clickNewChat();

    // 두 번째 ＋ 는 이미 빈 새 대화라 아무것도 안 건드린다 — 쓰던 문장이 살아 있다.
    expect(state.createMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("textbox", { name: "메시지" }).textContent
    ).toContain("쓰던 문장");
  });

  it("★ ＋ 뒤 첫 전송이 대화를 하나만 만든다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    renderChat();
    openPanel();
    clickNewChat();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.createMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    expect(state.streamCalls[0].url).toBe(
      `/v1/agent-chats/${NEW_CHAT_ID}/messages`
    );
  });

  it("새 대화가 범위도 함께 비운다", async () => {
    // 범위는 턴이 드는 값이라 대화가 갈리면 이어질 이유가 없다. 남겨 두면 새 대화의
    // 첫 질문이 앞 대화의 범위로 조용히 나간다.
    const { rerender, client } = renderChat();
    openPanel();
    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider workspaceId={WORKSPACE_ID}>
          <NoteScope hidden={false} />
        </PersonalChatProvider>
      </QueryClientProvider>
    );
    await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));
    write("이건 지워져야 한다");

    clickNewChat();

    // 쓰던 문장은 사라진다.
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "메시지" }).textContent
      ).not.toContain("이건 지워져야 한다")
    );
    // **회의록 칩은 돌아온다** — 그 회의록 안에 서 있으면 새 대화에서도 그것이 힌트다.
    expect(chipsInInput()).toEqual(["주간 제품 회의"]);
  });

  it("워크스페이스에서 연 새 대화에는 붙을 칩이 없다", async () => {
    renderChat();
    openPanel();
    clickNewChat();
    expect(chipsInInput()).toEqual([]);
  });

  it("회의록에 들어가면 그 회의록이 칩으로 미리 붙는다", async () => {
    // **강제가 아니다.** 칩일 뿐이라 대화는 갈리지 않고, 사용자가 지울 수 있다.
    const { rerender, client } = renderChat();
    openPanel();
    expect(screen.queryByTestId("scope-chips")).toBeNull();

    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider
          workspaceId={WORKSPACE_ID}
          workspaceName="헤이모아"
        >
          <NoteScope hidden={false} />
        </PersonalChatProvider>
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByText("주간 제품 회의")).toBeTruthy()
    );
    // 회의록이 붙어도 조회 params 는 워크스페이스 하나뿐이다 — 대화가 안 갈린다.
    expect(state.chatsParams.at(-1)).toBe(WORKSPACE_ID);
  });

  it("지운 칩은 회의록을 나갔다 와도 다시 안 붙는다", async () => {
    // 안 기억하면 방금 지운 칩이 되살아난다. 힌트가 힌트이려면 거절이 남아야 한다.
    // 삭제는 브라우저가 원자로 한다 — 「지웠다」 이벤트가 없어서 사라진 것을 알아낸다.
    const { rerender, client } = renderChat(<NoteScope hidden={false} />);
    openPanel();
    await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));

    removeChipFromInput("주간 제품 회의");
    await waitFor(() => expect(chipsInInput()).toEqual([]));

    // 회의록을 나갔다 온다.
    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider workspaceId={WORKSPACE_ID}>
          <div />
        </PersonalChatProvider>
      </QueryClientProvider>
    );
    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider workspaceId={WORKSPACE_ID}>
          <NoteScope hidden={false} />
        </PersonalChatProvider>
      </QueryClientProvider>
    );
    expect(chipsInInput()).toEqual([]);
  });

  it("닫아도 패널을 언마운트하지 않는다", async () => {
    // 언마운트하면 useChatStream이 abort하고, 계약상 부분 응답은 저장되지 않아
    // 흐르던 답변이 통째로 사라진다. 닫기도 감추기다.
    renderChat();
    openPanel();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    await waitFor(() =>
      expect(screen.getByTestId("personal-chat-panel")).toHaveAttribute(
        "data-hidden"
      )
    );
    expect(state.aborted).toBe(false);
  });

  it("첫 전송이 대화를 만들면 목록 캐시를 갱신한다", async () => {
    const { invalidate } = renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["/v1/workspaces", WORKSPACE_ID, "agent-chats"],
      })
    );
  });

  it("히스토리를 못 읽으면 빈 대화로 보이지 않고 전송을 막는다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.historyFails = true;
    renderChat();
    openPanel();

    expect(screen.getByRole("alert").textContent).toContain(
      "대화를 불러오지 못했습니다."
    );
    expect(screen.queryByText("아직 시작된 대화가 없습니다.")).toBeNull();
    expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("워크스페이스 스코프로 열려 있을 때 노트를 side로 열어도 패널이 갈리지 않는다", async () => {
    // 스코프가 바뀌면 패널 key가 바뀌어 언마운트되고, 흐르던 스트림이 끊긴다.
    // 계약상 부분 응답은 저장되지 않으므로 답변이 통째로 사라진다.
    state.chats = [chatRow(CHAT_ID)];
    const { rerender, client } = renderChat();
    openPanel();
    await waitFor(() => expect(state.chatsParams.at(-1)).toBe(WORKSPACE_ID));

    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider
          workspaceId={WORKSPACE_ID}
          workspaceName="헤이모아"
        >
          <NoteScope hidden />
        </PersonalChatProvider>
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("personal-chat-panel")).toHaveAttribute(
        "data-hidden"
      )
    );
    // 감춰졌을 뿐 대화는 그대로다. 애초에 노트가 대화를 가르지 않는다.
    expect(state.chatsParams.at(-1)).toBe(WORKSPACE_ID);
  });

  it("side 모드에서는 버튼이 사라지고 패널이 감춰지지만 스트림은 유지된다", async () => {
    const { rerender, client } = renderChat(<NoteScope hidden={false} />);
    openPanel();
    expect(screen.getByTestId("personal-chat-panel")).not.toHaveAttribute(
      "data-hidden"
    );

    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider
          workspaceId={WORKSPACE_ID}
          workspaceName="헤이모아"
        >
          <NoteScope hidden />
        </PersonalChatProvider>
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("personal-chat-panel")).toHaveAttribute(
        "data-hidden"
      )
    );
    // 감출 뿐 언마운트하지 않는다 — 끊으면 부분 응답이 저장되지 않아 답변이 통째로 사라진다.
    expect(state.chatsParams.at(-1)).toBe(WORKSPACE_ID);
    expect(screen.queryByRole("button", { name: "개인 챗봇 열기" })).toBeNull();
    expect(state.aborted).toBe(false);
  });

  it("워크스페이스에서 연 개인 챗봇은 노트 회의 중으로 새지 않는다", async () => {
    // open()은 감춤을 존중한다. 안 그러면 워크스페이스에서 한 번 열면 노트 회의 중에도
    // 공유 트레이 위에 개인 패널이 계속 뜬다.
    const { rerender, client } = renderChat();
    openPanel();
    expect(screen.getByTestId("personal-chat-panel")).not.toHaveAttribute(
      "data-hidden"
    );

    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider
          workspaceId={WORKSPACE_ID}
          workspaceName="헤이모아"
        >
          <NoteScope hidden />
        </PersonalChatProvider>
      </QueryClientProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("personal-chat-panel")).toHaveAttribute(
        "data-hidden"
      )
    );
  });

  it("목록 조회가 끝나기 전에는 보내지 않는다", () => {
    // 여기서 보내면 이미 있는 대화를 못 보고 새 대화를 하나 더 만든다.
    state.chatsLoading = true;
    renderChat();
    openPanel();

    expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("새 대화가 만들어지는 중에는 보내지 않는다", () => {
    // 여기서 보내면 곧 바뀔 옛 sessionId로 나가고, 이어지는 reset이 그 스트림을 끊는다.
    state.createPending = true;
    renderChat();
    openPanel();

    expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("세션 생성이 실패하면 입력을 지우지 않는다", async () => {
    state.createMock.mockReset().mockRejectedValue(new Error("BOOM"));
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.createMock).toHaveBeenCalled());
    expect(screen.getByRole("textbox", { name: "메시지" }).textContent).toBe(
      "정리해줘"
    );
  });

  it("★★ [W-12] 시계가 어긋나도 보내며 세운 구분선이 사라지지 않는다", async () => {
    // 구분선은 보내는 동안 클라이언트 시계로, 히스토리로 넘어간 뒤에는 서버가 적은
    // `createdAt` 으로 판정된다 — **값의 출처가 다르다.** 두 시계가 자정을 사이에 두고
    // 어긋나면 보낼 때 세운 줄이 히스토리가 오는 순간 사라진다. 방향만 반대인 W-12 다.
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    // 히스토리는 어제 저녁. 지금(클라이언트)은 오늘이라 보내는 순간 구분선이 하나 는다.
    const yesterday = new Date(midnight.getTime() - 4 * 3_600_000);
    state.chats = [chatRow(CHAT_ID)];
    state.messages = [
      {
        createdAt: yesterday.toISOString(),
        role: "USER",
        content: "지난 회의 정리해줘",
        toolEvent: null,
      },
      {
        createdAt: new Date(yesterday.getTime() + 8_000).toISOString(),
        role: "ASSISTANT",
        content: "세 가지가 남아 있었습니다.",
        toolEvent: null,
      },
    ];
    renderChat();
    openPanel();

    const dividers = () =>
      document.querySelectorAll('[data-testid="thread-divider"]').length;
    await waitFor(() => expect(dividers()).toBe(1));

    // 스트림을 붙들어 「보내는 중」을 세운다. 지금은 오늘이라 구분선이 하나 는다.
    state.holdStream = true;
    await sendMessage("정리해줘");
    await waitFor(() => expect(state.releaseStream).not.toBeNull());
    await waitFor(() => expect(dividers()).toBe(2));

    // **서버는 이 질문을 어제로 적는다** — 클라이언트 시계가 앞선 상황이다.
    state.messages = [
      ...state.messages,
      {
        createdAt: new Date(yesterday.getTime() + 60_000).toISOString(),
        role: "USER",
        content: "정리해줘",
        toolEvent: null,
      },
      {
        createdAt: new Date(yesterday.getTime() + 68_000).toISOString(),
        role: "ASSISTANT",
        content: "정리했습니다.",
        toolEvent: null,
      },
    ];
    state.releaseStream?.();
    await waitFor(() => expect(screen.getByText("정리했습니다.")).toBeTruthy());

    // 판정이 얼려져 있어 줄이 그대로 둘이다. 안 얼리면 여기서 하나로 줄며 화면이 밀린다.
    await waitFor(() => expect(dividers()).toBe(2));
  });

  it("히스토리가 나중에 그 턴을 담아 오면 로컬 사본을 겹쳐 그리지 않는다", async () => {
    // 즉시 반영이 실패해 로컬 턴을 남겨 뒀는데, 히스토리가 스스로 성공하면 같은 턴이
    // 두 벌 그려진다.
    state.chats = [chatRow(CHAT_ID)];
    state.refreshFails = true;
    const { rerender, client } = renderChat();
    openPanel();
    await sendMessage("정리해줘");
    await waitFor(() => expect(screen.getByText("정리했습니다.")).toBeTruthy());

    // 히스토리가 뒤늦게 그 턴을 담아 온다.
    state.messages = [
      {
        createdAt: "2026-07-24T00:00:00Z",
        role: "USER",
        content: "정리해줘",
        toolEvent: null,
      },
      {
        createdAt: "2026-07-24T00:00:01Z",
        role: "ASSISTANT",
        content: "정리했습니다.",
        toolEvent: null,
      },
    ];
    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider
          workspaceId={WORKSPACE_ID}
          workspaceName="헤이모아"
        >
          {null}
        </PersonalChatProvider>
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getAllByText("정리했습니다.")).toHaveLength(1)
    );
    expect(screen.getAllByText("정리해줘")).toHaveLength(1);
  });

  it("같은 문장의 예전 답변에 걸려 이번 턴을 가리지 않는다", async () => {
    // 대화 전체에서 문장을 찾으면 예전 답변에 걸린다 — 같은 질문을 다시 하면 흔하다.
    state.chats = [chatRow(CHAT_ID)];
    state.messages = [
      {
        createdAt: "2026-07-24T00:00:00Z",
        role: "ASSISTANT",
        content: "정리했습니다.",
        toolEvent: null,
      },
    ];
    state.refreshFails = true;
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    // 히스토리의 예전 답변 1건 + 이번 턴의 답변 1건.
    await waitFor(() =>
      expect(screen.getAllByText("정리했습니다.")).toHaveLength(2)
    );
    expect(screen.getByText("정리해줘")).toBeTruthy();
  });

  it("승인은 2차 스트림이 확정할 때까지 다시 눌리지 않는다", async () => {
    // 보낸 것일 뿐이다. 그 사이 다시 누르면 중복 결정이 나가고 404가 뜬다.
    state.chats = [chatRow(CHAT_ID)];
    state.approvalStream = true;
    renderChat();
    openPanel();
    await sendMessage("이슈 만들어줘");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "승인" })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "승인" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "승인" })).toHaveProperty(
        "disabled",
        true
      )
    );
    expect(screen.getByRole("button", { name: "거절" })).toHaveProperty(
      "disabled",
      true
    );
    expect(state.approveMock).toHaveBeenCalledTimes(1);
    // ★ **커서를 실어 보낸다.** 없으면 서버가 이 재개가 뗀 블록의 시작부터 재생해
    // 그 턴의 1차 절반이 통째로 다시 온다.
    expect(state.approveMock.mock.calls[0][0].url).toContain("?after=");

    state.releaseStream?.();
  });

  it("★ 2차가 끝나면 히스토리를 다시 읽고 로컬 사본을 접는다", async () => {
    // 승인 응답이 **이 턴의 나머지**라 꼬리가 `send()`와 같아야 한다. 다시 안 읽으면
    // `activeTurn`이 안 비어 전송이 잠긴 채 남고, 로컬 사본을 안 접으면 server가 tee한
    // 답과 겹쳐 두 벌이 된다.
    state.chats = [chatRow(CHAT_ID)];
    state.approvalStream = true;
    renderChat();
    openPanel();
    await sendMessage("이슈 만들어줘");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "승인" })).toBeTruthy()
    );
    // 1차는 승인 요청에서 끝났을 뿐이라 아직 아무것도 다시 읽지 않았다.
    expect(state.refetchedChatIds).toEqual([]);

    // server가 흐르는 동안 tee한 기록. 2차가 끝나면 화면이 이쪽으로 갈아탄다.
    state.messages = [
      {
        createdAt: "2026-07-24T00:00:00Z",
        role: "USER",
        content: "이슈 만들어줘",
        toolEvent: null,
      },
      {
        createdAt: "2026-07-24T00:00:02Z",
        role: "ASSISTANT",
        content: "만들었습니다.",
        toolEvent: null,
      },
    ];
    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    await waitFor(() => expect(state.releaseStream).not.toBeNull());
    state.releaseStream?.();

    await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
    await waitFor(() =>
      expect(screen.getAllByText("만들었습니다.")).toHaveLength(1)
    );
    expect(screen.getAllByText("이슈 만들어줘")).toHaveLength(1);
    // 확정됐으니 카드도 사라진다.
    expect(screen.queryByRole("button", { name: "승인" })).toBeNull();
  });

  it("승인이 재시도 가능한 오류로 실패하면 잠금을 푼다", async () => {
    // 풀지 않으면 버튼이 영영 잠긴 채 남는다 — 만료가 없어져 저절로 풀리지 않는다.
    state.chats = [chatRow(CHAT_ID)];
    state.approvalStream = true;
    state.approvalError = {
      success: false,
      data: null,
      error: { code: "INTERNAL_SERVER_ERROR", message: "일시적 오류" },
    };
    renderChat();
    openPanel();
    await sendMessage("이슈 만들어줘");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "승인" })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "승인" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "승인" })).toHaveProperty(
        "disabled",
        false
      )
    );
    // ★ 여기까지 흐른 반쪽 답이 살아 있다. 실패로 덮으면 답이 사라지고
    // 「중지」밖에 안 남는다.
    expect(screen.getByText("정리했")).toBeTruthy();
  });

  it("지나간 승인은 카드를 무효화한다 — 버튼이 사라지고 사유가 남는다", async () => {
    // 카드가 죽었다 — 다시 눌러도 같은 404다. 잠긴 버튼이 아니라 무효화 카드로 드러낸다.
    state.chats = [chatRow(CHAT_ID)];
    state.approvalStream = true;
    state.approvalError = {
      success: false,
      data: null,
      error: { code: "APPROVAL_NOT_FOUND", message: "이미 처리됐습니다." },
    };
    renderChat();
    openPanel();
    await sendMessage("이슈 만들어줘");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "승인" })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "승인" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "승인" })).toBeNull()
    );
    expect(screen.getByText(/이미 처리됐거나 지나간 승인/)).toBeTruthy();

    state.releaseStream?.();
  });

  it("턴이 도는 동안에는 히스토리 조회를 켜지 않는다", async () => {
    // 켜면 로딩 스켈레톤이 흐르는 스레드를 덮고, server가 스트림 전에 저장한
    // USER 메시지가 pendingUserMessage와 겹쳐 두 번 보인다.
    state.holdStream = true;
    renderChat();
    openPanel();
    write("정리해줘");
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() => expect(state.releaseStream).not.toBeNull());
    const duringTurn = state.messagesArgs.filter(
      (call) => (call as { chatId: string }).chatId === NEW_CHAT_ID
    );
    expect(duringTurn.length).toBeGreaterThan(0);
    expect(
      duringTurn.every(
        (call) =>
          (call as { options: { query: { enabled: boolean } } }).options.query
            .enabled === false
      )
    ).toBe(true);

    state.releaseStream?.();
  });

  it("★ 승인 대기에서도 히스토리 조회를 켜지 않는다", async () => {
    // 1차가 승인 요청으로 **정상 종료**하면 `send()`가 돌아와 `isSending`이 풀린다.
    // 거기서 히스토리가 켜지면 저장된 USER 행이 `pendingUserMessage`와 겹쳐
    // 말풍선이 두 벌 그려진다. 승인 대기도 「도는 중」이다.
    state.chats = [chatRow(CHAT_ID)];
    state.approvalStream = true;
    renderChat();
    openPanel();
    await sendMessage("이슈 만들어줘");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "승인" })).toBeTruthy()
    );
    expect(
      (
        state.messagesArgs.at(-1) as {
          options: { query: { enabled: boolean } };
        }
      ).options.query.enabled
    ).toBe(false);
  });

  it("없어진 세션(404)은 막다른 길이 아니라 빈 대화다", () => {
    // 다른 실패와 섞어 잠그면 유일한 복구 경로(새 대화)까지 막힌다.
    state.chats = [chatRow(CHAT_ID)];
    state.historyMissing = true;
    renderChat();
    openPanel();

    expect(screen.getByText("아직 시작된 대화가 없습니다.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
      "disabled",
      false
    );
    expect(historyButton()).toHaveProperty("disabled", false);
  });

  it("턴이 도는 동안에는 노트를 떠나도 스코프가 바뀌지 않는다", async () => {
    // 스코프가 바뀌면 패널 key가 바뀌어 언마운트되고 흐르던 답변이 사라진다.
    state.chats = [chatRow(CHAT_ID)];
    const { rerender, client } = renderChat(<NoteScope hidden={false} />);
    openPanel();
    await waitFor(() => expect(state.chatsParams.at(-1)).toBe(WORKSPACE_ID));

    // 턴을 시작해 두고 노트를 떠난다.
    write("정리해줘");
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider
          workspaceId={WORKSPACE_ID}
          workspaceName="헤이모아"
        >
          {null}
        </PersonalChatProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    expect(state.aborted).toBe(false);
  });

  it("조회가 실패하면 기록도 새 대화도 막는다", () => {
    // 못 본 대화 위에 새 대화를 얹거나, 못 읽은 목록에서 고르는 것을 막는다.
    state.chatsFail = true;
    renderChat();
    openPanel();

    expect(historyButton()).toHaveProperty("disabled", true);
    expect(screen.getByTestId("chat-list-new")).toHaveProperty(
      "disabled",
      true
    );
  });

  it("「다시 보내기」가 같은 문장을 다시 보낸다", async () => {
    // 히스토리가 그 질문을 안 받아 갔을 때만 이 버튼이 선다(POST 가 아예 안 닿았다).
    // 늘 새 턴이다 — 앞 턴이 살아 있으면 서버가 409로 막고 그 갈래가 이어받기로 넘긴다.
    state.chats = [chatRow(CHAT_ID)];
    state.streamFails = true;
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    fireEvent.click(await screen.findByRole("button", { name: "다시 보내기" }));

    await waitFor(() => expect(state.streamCalls).toHaveLength(2));
    expect(state.streamCalls[1].body).toEqual(state.streamCalls[0].body);
  });

  /**
   * ★ 재진입 네 갈래. `activeTurn`이 가르고, 없으면 `lastTurn`만 본다.
   */
  describe("돌아오면 이어받는다", () => {
    function frame(event: string, payload: unknown, seq?: number) {
      return {
        event,
        data: JSON.stringify(payload),
        ...(seq === undefined ? {} : { id: String(seq) }),
      };
    }

    /** 히스토리 한 줄. `turnId` 가 「흐르는 턴의 행은 접는다」를 가르는 열쇠다. */
    function historyRow(role: string, content: string, turnId: string) {
      return {
        createdAt: "2026-07-24T00:00:00Z",
        turnId,
        role,
        content,
        scope: [],
        toolEvent: null,
      };
    }

    it("★ activeTurn이 있으면 cursor부터 GET /events로 잇고 누적 전문을 그린다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = 131;
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "IN_PROGRESS",
        pendingApproval: null,
      };
      state.resumeFrames = [
        // **본문은 재생이 그린다.** `partialText` 가 걷혀서 화면이 여는 자리에 본문이
        // 없다 — 커서 뒤부터 오는 이 프레임들이 유일한 출처다.
        frame("token", { delta: "안녕하" }, 132),
        frame("token", { delta: "세요" }, 133),
      ];
      renderChat();
      openPanel();

      // 커서가 그대로 `?after=`에 들어간다. 안 들어가면 버퍼가 통째로 재생된다.
      await waitFor(() =>
        expect(state.resumeUrls).toContain(
          `/v1/agent-chats/${CHAT_ID}/events?after=131`
        )
      );
      // 재생이 그린 본문. 화면이 이 프레임들을 안 접으면 답이 통째로 빈다.
      expect(await screen.findByText("안녕하세요")).toBeTruthy();
      // POST는 한 번도 안 나간다 — 이어받기는 새 턴이 아니다.
      expect(state.streamCalls).toHaveLength(0);
    });

    /**
     * ★★ **서버가 「못 준다」고 말한 자리를 히스토리가 메운다.**
     *
     * `stream_resync` 는 로그 바닥 아래에서 붙었다는 뜻이라, 그 구간은 재생으로 안 온다.
     * **안 읽으면 그 구간이 화면에서 조용히 사라진다** — 오류도 로그도 없이.
     *
     * 되찾는 행을 **앞 턴**의 것으로 두는 것이 요점이다. 흐르는 턴의 행은 스트림 블록과
     * 겹쳐 그려지지 않게 화면이 접고 있어서, 그 행으로 재면 재조회가 실제로 화면에 닿았는지
     * 판정이 안 선다. 로그가 앞에서 버리는 것도 **먼저 굳은 턴의 프레임**이라 이쪽이 실제
     * 모양이다.
     */
    it("★ stream_resync 를 받으면 히스토리를 다시 읽고 그 결과가 화면에 선다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = 131;
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "IN_PROGRESS",
        pendingApproval: null,
      };
      state.messages = [historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B")];
      // 재조회가 실제로 왕복을 돌았을 때만 이 행이 생긴다.
      state.onRefetch = () => {
        state.messages = [
          historyRow("ASSISTANT", "잃어버린 앞 턴의 답", "0K9GVJT2C4Q3A"),
          historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B"),
        ];
      };
      // 흐르는 중에 온다. 스트림을 열어 둬야 `streaming` 그대로다.
      state.holdResume = true;
      state.resumeFrames = [
        frame("stream_resync", {}, 900),
        // 마크다운이 낱말마다 `<span>`으로 쪼개서 공백 없는 한 낱말로 둔다.
        frame("token", { delta: "뒷부분" }, 901),
      ];
      renderChat();
      openPanel();

      // 히스토리 쿼리는 흐르는 동안 `enabled: false`라 이 왕복은 `reconcile()`만 낼 수 있다.
      await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
      expect(await screen.findByText("잃어버린 앞 턴의 답")).toBeTruthy();
      // 커서는 바닥까지 올라가고 그 뒤 프레임은 그대로 붙는다 — resync 는 종료가 아니다.
      expect(await screen.findByText("뒷부분")).toBeTruthy();
    });

    /**
     * ★★ **재연결을 포기한 자리도 같은 재조회가 필요하다.**
     *
     * `stalled` 는 「아무도 더 안 말해 준다」는 뜻이다. 그 사이 서버에서 답이 끝나 있어도
     * 화면은 반쪽 스트림에 멈춰 있고, `messagesQuery` 는 전역 `staleTime` 60초에 걸려
     * 방금 굳은 답을 안 가져온다. `reconcile()` 만 그 왕복을 돈다.
     */
    it("★ 재연결을 포기하면 히스토리를 다시 읽어 그 사이 끝난 답을 세운다", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        state.chats = [chatRow(CHAT_ID)];
        state.cursor = 131;
        state.activeTurn = {
          turnId: "0K9GVJT2C4Q3B",
          status: "IN_PROGRESS",
          pendingApproval: null,
        };
        state.messages = [historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B")];
        // 재조회 시점에는 서버 쪽에서 이미 답이 굳어 있다.
        state.onRefetch = () => {
          state.messages = [
            historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B"),
            historyRow("ASSISTANT", "서버가 굳힌 답", "0K9GVJT2C4Q3B"),
          ];
          state.activeTurn = null;
          state.lastTurn = {
            turnId: "0K9GVJT2C4Q3B",
            status: "COMPLETED",
            failureCode: null,
            retryable: null,
          };
        };
        // 프레임을 하나도 안 주고 곧바로 EOF. 그것이 재연결 신호다.
        state.resumeFrames = [];
        renderChat();
        openPanel();

        await waitFor(() => expect(state.resumeUrls.length).toBeGreaterThan(0));
        // 백오프 여섯 번(합 45초)을 지나면 포기한다.
        await vi.advanceTimersByTimeAsync(60_000);

        await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
        expect(await screen.findByText("서버가 굳힌 답")).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });

    it("★ cursor가 0이어도 잇는다 — 버퍼가 빈 것이지 오류가 아니다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = 0;
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "IN_PROGRESS",
        pendingApproval: null,
      };
      // 프레임 0개 = 곧바로 EOF. 실패로 읽으면 안 된다.
      renderChat();
      openPanel();

      await waitFor(() =>
        expect(state.resumeUrls).toContain(
          `/v1/agent-chats/${CHAT_ID}/events?after=0`
        )
      );
      expect(screen.queryByText("응답을 받지 못했습니다.")).toBeNull();
    });

    it("★ 승인 대기 중 돌아오면 카드가 다시 뜨고 스트림을 안 연다", async () => {
      // `GET /events`는 도는 턴이 없으면(`hasLiveTurn = IN_PROGRESS`) 밀린 것만 주고
      // 곧바로 닫는다 — 열면 그 EOF가 재연결 루프를 태운다. 상태만 세우는 것이 맞다.
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = 140;
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "WAITING_APPROVAL",
        pendingApproval: {
          approvalId: "0K9GVJT2C4Q7F",
          tool: "linear.create_issue",
          summary: "Linear 이슈 생성",
        },
      };
      renderChat();
      openPanel();

      expect(await screen.findByRole("button", { name: "승인" })).toBeTruthy();
      expect(state.resumeUrls).toHaveLength(0);
    });

    it("★ 남이 시작한 턴이 돌면 전송을 잠근다", async () => {
      // `isSending`은 이 탭의 이번 전송만 안다 — 열어 두면 두 번째 메시지가 409를 받는다.
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = 131;
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "IN_PROGRESS",
        pendingApproval: null,
      };
      state.holdResume = true;
      renderChat();
      openPanel();
      write("겹쳐서 보낼래");

      await waitFor(() => expect(state.resumeUrls).toHaveLength(1));
      // 보낼 문이 아예 없다 — 그 자리에 중지가 서 있다.
      expect(screen.queryByRole("button", { name: "보내기" })).toBeNull();
      expect(screen.getByRole("button", { name: "중지" })).toBeTruthy();
      // ★ **대화를 갈아 끼우는 것은 같이 안 잠긴다.** 전송만 막힌다 — 앞 대화를 안
      // 죽이는 것이 I08 이고, 서버의 턴은 계속 돌아 돌아오면 다시 이어받는다.
      expect(historyButton()).toHaveProperty("disabled", false);
      expect(state.streamCalls).toHaveLength(0);
    });

    it("★ lastTurn이 FAILED이고 도는 턴이 없으면 실패 배너를 세운다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.activeTurn = null;
      state.lastTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "FAILED",
        failureCode: "UPSTREAM_ERROR",
        retryable: true,
      };
      renderChat();
      openPanel();

      expect(
        await screen.findByText(
          "응답 생성에 실패했습니다. 잠시 후 다시 시도해 주세요."
        )
      ).toBeTruthy();
    });

    it("★ 도는 턴이 곧 마지막 턴이면 실패 배너를 안 세운다", async () => {
      // `lastTurn.turnId === activeTurn.turnId`가 정상이다. 안 가리면 흐르는 답 위에
      // 실패가 뜬다.
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = 131;
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "IN_PROGRESS",
        pendingApproval: null,
      };
      state.lastTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "IN_PROGRESS",
        failureCode: null,
        retryable: null,
      };
      renderChat();
      openPanel();

      await waitFor(() => expect(state.resumeUrls).toHaveLength(1));
      expect(screen.queryByText("응답을 받지 못했습니다.")).toBeNull();
    });

    it("★ 진행 중 턴의 도구 카드를 두 벌 그리지 않는다", async () => {
      // TOOL 행이 히스토리와 스트림 백로그 양쪽에서 온다. 접는 열쇠는 `turnId`다.
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = 131;
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "IN_PROGRESS",
        pendingApproval: null,
      };
      state.messages = [
        {
          createdAt: "2026-07-24T00:00:00Z",
          turnId: "0K9GVJT2C4Q3B",
          role: "USER",
          content: "이슈 만들어줘",
          scope: [],
          toolEvent: null,
        },
        {
          createdAt: "2026-07-24T00:00:01Z",
          turnId: "0K9GVJT2C4Q3B",
          role: "TOOL",
          content: "전사에서 관련 발화 검색",
          scope: [],
          toolEvent: {
            tool: "transcripts.search",
            decision: null,
            status: "success",
            url: null,
          },
        },
      ];
      state.resumeFrames = [
        frame(
          "tool_call_start",
          {
            toolCallId: "call_01",
            tool: "transcripts.search",
            summary: "전사에서 관련 발화 검색",
          },
          132
        ),
      ];
      renderChat();
      openPanel();

      await waitFor(() => expect(state.resumeUrls).toHaveLength(1));
      expect(
        await screen.findAllByText("전사에서 관련 발화 검색")
      ).toHaveLength(1);
      // 질문은 스트림에 안 실린다 — 접으면 이어받기 화면에서 사라진다.
      expect(screen.getByText("이슈 만들어줘")).toBeTruthy();
    });

    it("★ 409는 오류 배너가 아니라 이어받기다", async () => {
      // 배너 + 「다시 보내기」로 그리면 그 버튼이 또 409를 받아 무한 루프가 된다.
      state.chats = [chatRow(CHAT_ID)];
      state.streamFails = true;
      state.streamFailure = {
        success: false,
        data: null,
        error: {
          code: "AGENT_CHAT_TURN_IN_PROGRESS",
          message: "이미 진행 중인 턴이 있습니다.",
          details: [{ field: "turnId", message: "0K9GVJT2C4Q3B" }],
        },
      };
      const { rerender, client } = renderChat();
      openPanel();
      rerender(
        <QueryClientProvider client={client}>
          <PersonalChatProvider workspaceId={WORKSPACE_ID}>
            <NoteScope hidden={false} />
          </PersonalChatProvider>
        </QueryClientProvider>
      );
      await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));
      const input = screen.getByRole("textbox", { name: "메시지" });
      input.append(document.createTextNode("겹쳐서 보낼래"));
      fireEvent.input(input);
      fireEvent.click(screen.getByRole("button", { name: "보내기" }));

      await waitFor(() => expect(state.streamCalls).toHaveLength(1));
      // 히스토리를 다시 읽어 무엇을 이어야 하는지 알아낸다.
      await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
      expect(screen.queryByRole("button", { name: "다시 보내기" })).toBeNull();
      // 서버에 안 닿은 문장이라 컴포저로 돌려준다.
      const restored = screen.getByRole("textbox", { name: "메시지" });
      expect(restored.textContent).toContain("겹쳐서 보낼래");
      // ★ **칩을 다시 박으므로 마커는 풀어서 넣는다.** 안 풀면 같은 범위가 칩 한 벌 +
      // 마커 날글자 한 벌로 두 번 앉는다.
      expect(chipsInInput()).toEqual(["주간 제품 회의"]);
      expect(restored.textContent).not.toContain("noteId:");
    });

    it("★ 409가 온 문장이 히스토리에 이미 있으면 컴포저로 안 되돌린다", async () => {
      // 열쇠를 걷은 뒤 **응답을 못 받은 전송의 재시도도 409로 온다.** 그때 이 문장은 이미
      // 서버에 있고 히스토리가 곧 그린다 — 되돌리면 화면에 한 벌, 컴포저에 한 벌이 된다.
      state.chats = [chatRow(CHAT_ID)];
      state.streamFails = true;
      state.streamFailure = {
        success: false,
        data: null,
        error: {
          code: "AGENT_CHAT_TURN_IN_PROGRESS",
          message: "이미 진행 중인 턴이 있습니다.",
          details: [{ field: "turnId", message: "0K9GVJT2C4Q3B" }],
        },
      };
      state.onRefetch = () => {
        state.messages = [
          {
            createdAt: "2026-07-24T00:00:00Z",
            turnId: "0K9GVJT2C4Q3B",
            role: "USER",
            content: "정리해줘",
            scope: [],
            toolEvent: null,
          },
        ];
      };
      renderChat();
      openPanel();
      await sendMessage("정리해줘");

      await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
      expect(screen.getAllByText("정리해줘")).toHaveLength(1);
      expect(
        screen.getByRole("textbox", { name: "메시지" }).textContent
      ).not.toContain("정리해줘");
    });

    it("★ POST가 못 열렸는데 서버에 턴이 있으면 히스토리를 다시 읽어 이어받는다", async () => {
      // POST 가 네트워크로 실패하면 화면은 턴이 생겼는지 모른다. 그 창을 막던 것이
      // `clientTurnKey` 였고, 이제 **실패한 전송이 스스로 히스토리를 다시 읽는다** —
      // 안 읽으면 「다시 보내기」가 턴을 하나 더 열어 답이 두 벌 나온다.
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = 131;
      state.streamFails = true;
      state.resumeFrames = [
        // **본문은 재생이 그린다.** `partialText` 가 걷혀서 화면이 여는 자리에 본문이
        // 없다 — 커서 뒤부터 오는 이 프레임들이 유일한 출처다.
        frame("token", { delta: "안녕하" }, 132),
        frame("token", { delta: "세요" }, 133),
      ];
      // 보내는 사이에 서버 쪽이 달라졌다 — POST 응답은 못 받았지만 턴과 USER 행은 생겼다.
      state.onRefetch = () => {
        state.messages = [
          {
            createdAt: "2026-07-24T00:00:00Z",
            turnId: "0K9GVJT2C4Q3B",
            role: "USER",
            content: "정리해줘",
            scope: [],
            toolEvent: null,
          },
        ];
        state.activeTurn = {
          turnId: "0K9GVJT2C4Q3B",
          status: "IN_PROGRESS",
          pendingApproval: null,
        };
      };
      renderChat();
      openPanel();
      await sendMessage("정리해줘");

      await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
      // 커서부터 이어받는다. **POST 는 한 번뿐이다** — 답이 두 벌 나오는 길이 그것뿐이다.
      await waitFor(() =>
        expect(state.resumeUrls).toContain(
          `/v1/agent-chats/${CHAT_ID}/events?after=131`
        )
      );
      expect(state.streamCalls).toHaveLength(1);
      expect(await screen.findByText("안녕하세요")).toBeTruthy();
      // 실패 배너가 걷힌다 — 다시 보낼 이유가 없어졌다.
      expect(screen.queryByRole("button", { name: "다시 보내기" })).toBeNull();
      // 질문은 히스토리가 그린다. 로컬 사본을 안 접으면 같은 문장이 두 벌 그려진다.
      expect(screen.getAllByText("정리해줘")).toHaveLength(1);
    });

    it("★ 그 사이 턴이 끝나 있으면 답이 그대로 그려지고 다시 보낼 것이 없다", async () => {
      // 「살아 있는 턴 하나」만으로는 **그 사이 끝난 경우**를 못 막는다 — server 의
      // `같은 클라이언트 턴 키는 확정된 뒤에도 다시 못 들어간다` 가 지키던 자리다.
      // 열쇠를 걷은 지금은 히스토리 재조회가 그것을 덮는다: 답이 이미 있으니 다시 보낼
      // 이유가 없어진다. 안 덮으면 「다시 보내기」가 턴을 하나 더 돌려 토큰을 두 번 쓴다.
      state.chats = [chatRow(CHAT_ID)];
      state.streamFails = true;
      state.onRefetch = () => {
        state.messages = [
          {
            createdAt: "2026-07-24T00:00:00Z",
            turnId: "0K9GVJT2C4Q3B",
            role: "USER",
            content: "정리해줘",
            scope: [],
            toolEvent: null,
          },
          {
            createdAt: "2026-07-24T00:00:01Z",
            turnId: "0K9GVJT2C4Q3B",
            role: "ASSISTANT",
            content: "정리했습니다.",
            scope: [],
            toolEvent: null,
          },
        ];
        state.lastTurn = {
          turnId: "0K9GVJT2C4Q3B",
          status: "COMPLETED",
          failureCode: null,
          retryable: null,
        };
      };
      renderChat();
      openPanel();
      await sendMessage("정리해줘");

      await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
      expect(await screen.findByText("정리했습니다.")).toBeTruthy();
      // 이어받을 것이 없으므로 GET /events 도 안 연다. POST 는 그대로 한 번이다.
      expect(state.resumeUrls).toHaveLength(0);
      expect(state.streamCalls).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "다시 보내기" })).toBeNull();
      expect(screen.getAllByText("정리해줘")).toHaveLength(1);
    });

    it("히스토리가 그 질문을 안 받아 갔으면 실패 배너를 그대로 둔다", async () => {
      // POST 가 아예 안 닿은 경우다. 여기서 로컬 사본까지 접으면 히스토리에도 없는
      // 질문이 화면에서 조용히 사라진다.
      state.chats = [chatRow(CHAT_ID)];
      state.streamFails = true;
      renderChat();
      openPanel();
      await sendMessage("정리해줘");

      await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
      expect(
        await screen.findByRole("button", { name: "다시 보내기" })
      ).toBeTruthy();
      expect(screen.getAllByText("정리해줘")).toHaveLength(1);
    });

    it("★ 중지가 턴을 취소한다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = 131;
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "IN_PROGRESS",
        pendingApproval: null,
      };
      state.holdResume = true;
      renderChat();
      openPanel();

      await waitFor(() => expect(state.resumeUrls).toHaveLength(1));
      fireEvent.click(await screen.findByRole("button", { name: "중지" }));

      // `turnId`의 출처는 `turn_started`(또는 `activeTurn`) 하나다.
      expect(state.cancelMock).toHaveBeenCalledWith({
        chatId: CHAT_ID,
        turnId: "0K9GVJT2C4Q3B",
      });
    });
  });

  describe("대화가 여럿 산다", () => {
    /** A는 도는 중, B는 안 돈다. 목록 첫 줄이 A라 패널은 A로 열린다. */
    function twoChats() {
      state.chats = [chatRow(CHAT_ID, RUNNING_TURN), chatRow(OTHER_CHAT_ID)];
      state.activeTurnByChat = {
        [CHAT_ID]: {
          turnId: RUNNING_TURN.turnId,
          status: "IN_PROGRESS",
          pendingApproval: null,
        },
      };
      state.cursor = 131;
      state.holdResume = true;
    }

    it("★ A가 도는 동안 B로 옮기면 B의 전송이 안 잠긴다", async () => {
      // I08 의 전부다. 패널은 하나이고 대화가 갈려도 언마운트가 없어서, 스트림을 안
      // 끊으면 `isBusy`의 `isStreaming`이 **B의 컴포저까지** 잠근다.
      twoChats();
      renderChat();
      openPanel();

      await waitFor(() => expect(state.resumeUrls).toHaveLength(1));
      expect(screen.queryByRole("button", { name: "보내기" })).toBeNull();

      pickChat(OTHER_CHAT_ID);

      // 앞 대화의 반쪽 답도 함께 걷힌다 — 안 걷으면 B 스레드에 A의 답이 그려진다.
      await waitFor(() => expect(screen.queryByText("안녕하")).toBeNull());
      const send = screen.getByRole("button", { name: "보내기" });
      expect(send).toHaveProperty("disabled", false);

      await sendMessage("B에서 물어볼래");
      await waitFor(() => expect(state.streamCalls).toHaveLength(1));
      expect(state.streamCalls[0].url).toBe(
        `/v1/agent-chats/${OTHER_CHAT_ID}/messages`
      );
    });

    it("★ 목록이 남의 턴을 말해도 전송을 잠그지 않는다", () => {
      // 「어느 대화든 돌면 잠근다」가 한 줄이라도 들어오면 I08 이 무효가 된다.
      state.chats = [chatRow(CHAT_ID), chatRow(OTHER_CHAT_ID, RUNNING_TURN)];
      renderChat();
      openPanel();

      expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
        "disabled",
        false
      );
    });

    it("★ 폴링이 배경에서 도는 동안에도 전송이 열려 있다", () => {
      // `isLoading` 을 `isFetching` 으로 바꾸면 주기마다 컴포저가 잠긴다.
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();

      expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
        "disabled",
        false
      );
    });

    it("★ 새 대화에 쓴 뒤에도 옛 대화를 고를 수 있다", async () => {
      // 계약 공식이 `createdChatId` 를 먼저 보므로, 갈아탈 때 그것을 안 비우면
      // 목록에서 무엇을 골라도 화면이 안 바뀐다. `createdChatId` 는 ＋ 가 아니라
      // **첫 전송**이 세운다.
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      clickNewChat();
      await sendMessage("새 대화에서 물어볼래");

      await waitFor(() =>
        expect(state.messagesArgs.at(-1)).toMatchObject({ chatId: NEW_CHAT_ID })
      );

      state.chats = [chatRow(NEW_CHAT_ID), chatRow(CHAT_ID)];
      pickChat(CHAT_ID);

      await waitFor(() =>
        expect(state.messagesArgs.at(-1)).toMatchObject({ chatId: CHAT_ID })
      );
    });

    it("★ B에 들렀다 A로 돌아오면 A의 도는 턴에 다시 붙는다", async () => {
      // 「이 턴에는 이미 붙었다」는 기억이 대화를 갈아탈 때 안 풀리면, 돌아온 A가
      // 스트림도 없고 이어받지도 않는 채로 선다.
      twoChats();
      renderChat();
      openPanel();

      await waitFor(() => expect(state.resumeUrls).toHaveLength(1));
      pickChat(OTHER_CHAT_ID);
      pickChat(CHAT_ID);

      await waitFor(() => expect(state.resumeUrls).toHaveLength(2));
    });

    it("★ 배지는 목록이 말하고, 열린 대화는 SSE 가 이긴다", async () => {
      // 열린 대화(A)의 턴은 이 탭이 이어받아 그리는 중이라 목록과 같은 턴이다.
      // B의 배지는 목록이 유일한 소식이다.
      state.chats = [
        chatRow(CHAT_ID),
        chatRow(OTHER_CHAT_ID, {
          turnId: "0K9GVJT2C4Q9Z",
          status: "WAITING_APPROVAL",
        }),
      ];
      renderChat();
      openPanel();
      fireEvent.click(historyButton());

      const rows = screen
        .getAllByRole("button")
        .filter((row) => row.textContent?.startsWith("대화 "));
      // 줄 끝의 「방금」은 마지막으로 쓴 시각이다 — 배지는 그 앞에 선다.
      expect(rows[0].textContent).toBe(`대화 ${CHAT_ID}방금`);
      expect(rows[1].textContent).toBe(`대화 ${OTHER_CHAT_ID}승인 대기방금`);
    });
  });

  describe("기록이 패널 안에서 교대한다", () => {
    /** 두 뷰는 늘 마운트돼 있다 — 가려질 뿐이라 `inert` 로 어느 쪽이 사는지 가른다. */
    function views() {
      return {
        thread: screen.getByTestId("chat-thread-view"),
        history: screen.getByTestId("chat-history-view"),
      };
    }

    it("★ 기록은 뜨는 레이어가 아니라 스레드와 같은 상자를 나눠 쓴다", () => {
      // 둘 다 마운트된 채 겹쳐 교대한다. 스레드를 언마운트하면 흐르던 답이 통째로
      // 사라지고(계약상 부분 응답 미저장) 스크롤 위치도 잃는다.
      state.chats = [chatRow(CHAT_ID)];
      state.messages = [
        {
          createdAt: new Date().toISOString(),
          role: "ASSISTANT",
          content: "가려져도 남아 있어야 합니다.",
          toolEvent: null,
        },
      ];
      renderChat();
      openPanel();

      expect(views().history.hasAttribute("inert")).toBe(true);
      expect(views().thread.hasAttribute("inert")).toBe(false);
      // 가려져 있는 동안에도 목록은 DOM 에 있다 — 여닫는 것이 아니라 교대다.
      expect(views().history.textContent).toContain("뒤로가기");

      fireEvent.click(historyButton());

      expect(views().history.hasAttribute("inert")).toBe(false);
      expect(views().thread.hasAttribute("inert")).toBe(true);
      // ★ **스레드의 내용이 그대로 DOM 에 있다.** 컴포저만 보면 안 된다 — 그건 스크롤
      // 영역 밖이라 스레드를 통째로 언마운트해도 살아남는다(뮤테이션으로 확인).
      expect(views().thread.textContent).toContain(
        "가려져도 남아 있어야 합니다."
      );
      // 목록도 마찬가지로 남는다 — 교대일 뿐 여닫는 것이 아니다.
      expect(views().history.textContent).toContain("뒤로가기");
    });

    it("★ 뷰가 갈리면 포커스를 손으로 옮긴다", () => {
      // 드롭다운 라이브러리가 해 주던 일이다. 안 옮기면 키보드 포커스가 가려진 상자 안에 남는다.
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();

      fireEvent.click(historyButton());
      const back = screen.getByRole("button", { name: "뒤로가기" });
      expect(document.activeElement).toBe(back);

      fireEvent.click(back);
      expect(document.activeElement).toBe(historyButton());
    });

    it("대화를 고르면 곧바로 스레드로 돌아온다", () => {
      state.chats = [chatRow(CHAT_ID), chatRow(OTHER_CHAT_ID)];
      renderChat();
      openPanel();
      pickChat(OTHER_CHAT_ID);

      expect(views().history.hasAttribute("inert")).toBe(true);
    });

    it("＋ 도 마찬가지로 스레드로 돌아온다", () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      fireEvent.click(historyButton());
      clickNewChat();

      expect(views().history.hasAttribute("inert")).toBe(true);
    });

    it("★ 뒤로가는 줄은 아무 데나 눌러도 스레드로 돌아온다", () => {
      // 아이콘만 버튼이면 맞출 곳이 24px 뿐이다. 줄 전체가 누르는 곳이라야 한다.
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      fireEvent.click(historyButton());

      const back = screen.getByRole("button", { name: "뒤로가기" });
      // 글자 노드를 눌러도 같은 버튼이 받는다 — 아이콘 옆 여백까지 한 버튼이다.
      fireEvent.click(back.lastChild as Node);

      expect(views().history.hasAttribute("inert")).toBe(true);
    });

    it("★ 지금 보는 대화는 색이 아니라 접근성 속성으로도 말한다", () => {
      // 배경만으로 말하면 스크린리더가 못 읽고 색을 가리기 어려운 사람에게도 안 보인다.
      state.chats = [chatRow(CHAT_ID), chatRow(OTHER_CHAT_ID)];
      renderChat();
      openPanel();
      fireEvent.click(historyButton());

      const rows = screen
        .getAllByRole("button")
        .filter((row) => row.textContent?.startsWith("대화 "));
      expect(rows[0].getAttribute("aria-current")).toBe("true");
      expect(rows[1].hasAttribute("aria-current")).toBe(false);
    });

    it("★ 빈 새 대화를 쓰는 중이면 아무 줄도 선택돼 있지 않다", () => {
      // 그 대화는 아직 서버에 없다 — 목록에 줄이 없으니 붙을 자리도 없다.
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      clickNewChat();
      fireEvent.click(historyButton());

      const history = screen.getByTestId("chat-history-view");
      expect(history.querySelector("[aria-current]")).toBeNull();
    });

    it("★ 기록 목록이 날짜로 묶이고 줄마다 마지막으로 쓴 시각을 적는다", () => {
      const now = Date.now();
      state.chats = [
        chatRow(CHAT_ID, null, new Date(now - 60_000).toISOString()),
        chatRow(
          OTHER_CHAT_ID,
          null,
          new Date(now - 3 * 86_400_000).toISOString()
        ),
      ];
      renderChat();
      openPanel();
      fireEvent.click(historyButton());

      const history = screen.getByTestId("chat-history-view");
      expect(
        [...history.querySelectorAll('[data-testid="chat-group"]')].map(
          (each) => each.textContent
        )
      ).toEqual(["오늘", "최근"]);

      const rows = [...history.querySelectorAll("button")].filter((row) =>
        row.textContent?.startsWith("대화 ")
      );
      // **묶어도 순서가 안 뒤집힌다.** 묶는 값과 정렬 기준이 같은 `updatedAt` 이라
      // 순서대로 훑기만 하면 된다 — 다르면 「1분 전인데 왜 세 번째 줄」이 된다.
      expect(rows.map((row) => row.textContent?.slice(3, 16))).toEqual([
        CHAT_ID,
        OTHER_CHAT_ID,
      ]);
      // 시각은 줄 끝에 선다. 로케일은 플랫폼이 정하므로(검사 환경은 en-US) 여기서는
      // 「`updatedAt` 마다 다르다」만 본다 — 로케일별 문구는 `lib/chat/chat-list.test.ts` 가 잰다.
      expect(rows[0].lastElementChild?.textContent).not.toBe(
        rows[1].lastElementChild?.textContent
      );
    });

    it("헤더 첫 줄이 지금 보고 있는 대화의 제목이다", () => {
      state.chats = [chatRow(CHAT_ID), chatRow(OTHER_CHAT_ID)];
      renderChat();
      openPanel();

      // 목록 첫 줄이 열린다 — 헤더가 그 대화를 말한다.
      const header = screen
        .getByTestId("personal-chat-panel")
        .querySelector("header");
      expect(header?.textContent).toContain(`대화 ${CHAT_ID}`);
      // 부제는 그대로다 — 칩이 없으면 워크스페이스 전체라고 적는다 [W-20].
      expect(header?.textContent).toContain("나만 보는 대화 · 헤이모아 전체");
    });
  });
});
