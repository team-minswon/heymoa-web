import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PersonalChatProvider,
  usePersonalChat,
  usePersonalChatScope,
} from "@/components/chat/personal-chat";
import { messagesFor } from "@/i18n/messages";
import { onTrack } from "@/lib/analytics/track";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ui/toast", () => ({ toast: { error: toastError } }));

const renameMock = vi.hoisted(() => vi.fn());
const renamed = (chatId: string, title: string) =>
  expect.objectContaining({ chatId, data: { title } });

const WORKSPACE_ID = "01K0000000001";
const NOTE_ID = "01K0000000002";
const CHAT_ID = "01K0000000003";
const NEW_CHAT_ID = "01K0000000004";
const OTHER_CHAT_ID = "01K0000000005";
const TURN_ID = "0K9GVJT2C4Q3B";
const APPROVAL_ENTRY_ID = "3-0";

function eventsUrl(chatId: string, turnId: string, after?: string) {
  const url = `/v1/agent-chats/${chatId}/turns/${turnId}/events`;
  return after === undefined ? url : `${url}?after=${after}`;
}

const RUNNING_TURN = {
  turnId: "0K9GVJT2C4Q3B",
  status: "IN_PROGRESS",
} as const;

function chatRow(
  chatId: string,
  runningTurn: { turnId: string; status: string } | null = null,
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
  chats: [] as { chatId: string; title: string; runningTurn: unknown }[],
  messages: [] as unknown[],
  cursor: null as string | null,
  activeTurn: null as ActiveTurn,
  activeTurnByChat: {} as Record<string, ActiveTurn>,
  lastTurn: null as {
    turnId: string;
    status: string;
    failureCode: string | null;
    retryable: boolean | null;
  } | null,
  resumeFrames: [] as { event: string; data: string; id?: string }[],
  resumeUrls: [] as string[],
  resumeFailure: null as unknown,
  order: [] as string[],
  createMock: vi.fn(),
  cancelMock: vi.fn(),
  deleteMock: vi.fn(),
  approveMock: vi.fn(),
  mode: "resume" as "resume" | "send" | "approval",
  refetchMock: vi.fn(),
  chatsRefetchMock: vi.fn(),
  refetchedChatIds: [] as string[],
  chatsFail: false,
  refreshFails: false,
  historyFails: false,
  historyMissing: false,
  chatsLoading: false,
  createPending: false,
  chatsParams: [] as unknown[],
  chatsHasMore: false,
  chatsNextId: "01KNEXTCHATID0",
  olderChats: [] as ReturnType<typeof chatRow>[],
  olderCalls: [] as unknown[][],
  olderFails: false,
  messagesArgs: [] as unknown[],
  streamCalls: [] as { chatId: string; body: unknown }[],
  aborted: false,
  holdStream: false,
  streamFails: false,
  streamFailure: null as unknown,
  cancelsAfterStart: false,
  holdResume: false,
  approvalStream: false,
  approvalThenFails: false,
  holdAfterApprovalRequest: null as (() => void) | null | false,
  approvalError: null as unknown,
  releaseStream: null as (() => void) | null,
  onRefetch: null as (() => void) | null,
}));

const historyData = vi.hoisted(() => (chatId: string) => ({
  messages: state.messages,
  cursor: state.cursor,
  activeTurn: state.activeTurnByChat[chatId] ?? state.activeTurn,
  lastTurn: state.lastTurn,
}));

vi.mock("@/lib/api/generated/agent-chat/agent-chat", async () => {
  const { useQuery, ...query } = await import("@tanstack/react-query");
  return {
    getGetAgentChatsQueryKey: (workspaceId: string) => [
      "/v1/workspaces",
      workspaceId,
      "agent-chats",
    ],
    getGetAgentChatMessagesQueryKey: (chatId: string) => ["messages", chatId],
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
    getSubscribeAgentChatTurnEventsUrl: (
      chatId: string,
      turnId: string,
      params?: { after?: string }
    ) => eventsUrl(chatId, turnId, params?.after),
    useSendAgentChatMessage: () => ({
      mutateAsync: async ({
        chatId,
        data,
      }: {
        chatId: string;
        data: unknown;
      }) => {
        state.order.push("send");
        state.streamCalls.push({ chatId, body: data });
        if (state.streamFails) {
          throw (
            state.streamFailure ?? {
              success: false,
              data: null,
              error: { code: "LLM_PROVIDER_ERROR", message: "응답 생성 실패" },
            }
          );
        }
        state.mode = "send";
        return {
          status: 202,
          data: { success: true, data: { turnId: TURN_ID } },
        };
      },
      isPending: false,
    }),
    useResolveToolApproval: () => ({
      mutateAsync: async (variables: unknown) => {
        state.approveMock(variables);
        if (state.approvalError) throw state.approvalError;
        state.mode = "approval";
        return {
          status: 202,
          data: { success: true, data: { turnId: TURN_ID } },
        };
      },
      isPending: false,
    }),
    useGetAgentChats: (workspaceId: string) => {
      state.chatsParams.push(workspaceId);
      return {
        isPending: false,
        isLoading: state.chatsLoading,
        isFetching: true,
        refetch: state.chatsRefetchMock,
        data: state.chatsLoading
          ? undefined
          : state.chatsFail
            ? { status: 500, data: { success: false, data: null } }
            : {
                status: 200,
                data: {
                  success: true,
                  data: {
                    chats: state.chats,
                    hasMore: state.chatsHasMore,
                    nextUpdatedAt: state.chatsHasMore
                      ? "2026-07-01T00:00:00Z"
                      : null,
                    nextChatId: state.chatsHasMore ? state.chatsNextId : null,
                  },
                },
              },
      };
    },
    getAgentChats: async (...args: unknown[]) => {
      state.olderCalls.push(args);
      if (state.olderFails) throw new Error("network");
      return {
        status: 200,
        data: {
          success: true,
          data: {
            chats: state.olderChats,
            hasMore: false,
            nextUpdatedAt: null,
            nextChatId: null,
          },
        },
      };
    },
    useGetAgentChatMessages: (chatId: string, options: unknown) => {
      state.messagesArgs.push({ chatId, options });
      useQuery({ queryKey: ["messages", chatId], queryFn: query.skipToken });
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
    useDeleteAgentChat: () => ({
      mutateAsync: state.deleteMock,
      isPending: false,
    }),
    useRenameAgentChat: () => ({ mutateAsync: renameMock, isPending: false }),
    useCancelAgentChatTurn: () => ({
      mutate: (variables: unknown, options?: { onSuccess?: () => void }) => {
        state.cancelMock(variables);
        options?.onSuccess?.();
      },
      isPending: false,
    }),
  };
});

const noteList = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock("@/lib/workspace/use-note-list-pages", () => ({
  useNoteListPages: () => ({ data: noteList.data, isPlaceholderData: false }),
}));

vi.mock("@/lib/chat/use-scope-catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/chat/use-scope-catalog")>()),
  useScopeCatalog: () => ({
    projects: [{ kind: "project", id: "01K0000000009", title: "결제 개편" }],
    notes: [],
    isPending: false,
  }),
}));

vi.mock("@/lib/api/sse", () => ({
  getEventStream: async function* (
    url: string,
    options?: { signal?: AbortSignal }
  ) {
    state.order.push("open");
    state.resumeUrls.push(url);
    options?.signal?.addEventListener("abort", () => {
      state.aborted = true;
    });
    if (state.resumeFailure) throw state.resumeFailure;
    const untilAbort = () =>
      new Promise<void>((resolve) =>
        options?.signal?.addEventListener("abort", () => resolve())
      );
    if (state.mode === "resume") {
      for (const frame of state.resumeFrames) yield frame;
      if (state.holdResume) await untilAbort();
      return;
    }
    let seq = 0;
    const framed = (event: string, payload: unknown) => ({
      event,
      data: JSON.stringify(payload),
      id: `${(seq += 1)}-0`,
    });
    if (state.mode === "approval") {
      await new Promise<void>((resolve) => {
        state.releaseStream = resolve;
      });
      seq = 3;
      if (state.approvalThenFails) {
        yield framed("turn_failed", {
          code: "UPSTREAM_ERROR",
          retryable: true,
        });
        return;
      }
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
    if (state.cancelsAfterStart) {
      yield framed("turn_cancelled", { turnId: TURN_ID });
      return;
    }
    yield framed("message_start", { chatId: CHAT_ID, messageId: "m1" });
    yield framed("token", { delta: "정리했" });
    if (state.approvalStream && state.holdAfterApprovalRequest !== false) {
      yield framed("tool_call_start", {
        toolCallId: "call_02",
        tool: "linear.create_issue",
        summary: "Linear 이슈 생성",
      });
      yield framed("tool_approval_request", {
        approvalId: "0K9GVJT2C4Q7F",
        toolCallId: "call_02",
        tool: "linear.create_issue",
        summary: "Linear 이슈 생성",
      });
      await new Promise<void>((resolve) => {
        state.holdAfterApprovalRequest = resolve;
      });
      yield framed("turn_failed", { code: "UPSTREAM_ERROR", retryable: true });
      return;
    }
    if (state.approvalStream) {
      yield framed("tool_approval_request", {
        approvalId: "0K9GVJT2C4Q7F",
        toolCallId: "call_02",
        tool: "linear.create_issue",
        summary: "Linear 이슈 생성",
      });
      return;
    }
    if (state.holdStream) {
      await Promise.race([
        new Promise<void>((resolve) => {
          state.releaseStream = resolve;
        }),
        untilAbort(),
      ]);
      if (options?.signal?.aborted) return;
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
  title = "주간 제품 회의",
}: {
  hidden: boolean;
  noteId?: string;
  title?: string;
}) {
  usePersonalChatScope({ noteId, title, hidden });
  return null;
}

function FreshChatTrigger() {
  const { startFreshChat } = usePersonalChat();
  return (
    <button type="button" onClick={startFreshChat}>
      새 노트 만듦
    </button>
  );
}

function renderChat(child?: React.ReactNode, locale: "ko" | "en" = "ko") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const view = render(
    <QueryClientProvider client={client}>
      <PersonalChatProvider workspaceId={WORKSPACE_ID}>
        {child}
      </PersonalChatProvider>
    </QueryClientProvider>,
    {
      wrapper: ({ children }) => (
        <NextIntlClientProvider locale={locale} messages={messagesFor(locale)}>
          {children}
        </NextIntlClientProvider>
      ),
    }
  );
  return { ...view, invalidate, client };
}

function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: "내 에이전트 열기" }));
}

function historyButton() {
  return screen.getByRole("button", { name: "대화 기록" });
}

function expandSteps() {
  for (const button of screen.queryAllByRole("button", {
    name: /생각/,
    expanded: false,
  }))
    fireEvent.click(button);
}

async function deleteFromHeader() {
  fireEvent.click(await screen.findByTestId("chat-menu"));
  fireEvent.click(await screen.findByRole("menuitem", { name: "삭제" }));
}

function clickNewChat() {
  fireEvent.click(screen.getByTestId("chat-list-new"));
}

function pickChat(chatId: string) {
  fireEvent.click(historyButton());
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(`^대화 ${chatId}(?! 메뉴)`) })
  );
}

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

function appendAfterChips(text: string) {
  const input = screen.getByRole("textbox", { name: "메시지" });
  input.append(document.createTextNode(text));
  const range = document.createRange();
  range.selectNodeContents(input);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  fireEvent.input(input);
  return input;
}

function putProjectChip(title: string) {
  write(`@${title}`);
  fireEvent.click(screen.getByRole("option", { name: new RegExp(title) }));
}

function chipsInInput() {
  return [
    ...screen
      .getByRole("textbox", { name: "메시지" })
      .querySelectorAll("[data-scope-chip]"),
  ].map((el) => el.textContent?.trim());
}

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
    state.chatsHasMore = false;
    state.chatsNextId = "01KNEXTCHATID0";
    state.olderChats = [];
    state.olderCalls = [];
    state.olderFails = false;
    state.messages = [];
    state.chatsParams = [];
    state.messagesArgs = [];
    state.streamCalls = [];
    state.aborted = false;
    state.holdStream = false;
    state.streamFails = false;
    state.streamFailure = null;
    state.cancelsAfterStart = false;
    state.mode = "resume";
    state.order = [];
    state.resumeFailure = null;
    state.holdResume = false;
    state.approvalStream = false;
    state.approvalThenFails = false;
    state.holdAfterApprovalRequest = false;
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
    state.chatsRefetchMock.mockReset();
    state.refetchedChatIds = [];
    state.cursor = null;
    state.activeTurn = null;
    state.activeTurnByChat = {};
    state.lastTurn = null;
    state.resumeFrames = [];
    state.resumeUrls = [];
    state.cancelMock.mockReset();
    state.deleteMock.mockReset().mockResolvedValue({ status: 204 });
    renameMock.mockReset().mockResolvedValue({ status: 200 });
    state.createMock.mockReset().mockResolvedValue({
      status: 201,
      data: { success: true, data: { chatId: NEW_CHAT_ID } },
    });
    state.approveMock.mockReset();
    toastError.mockReset();
  });

  afterEach(cleanup);

  it("대화가 하나도 없으면 빈 상태를 보인다", () => {
    renderChat();
    openPanel();
    expect(screen.getByText("무엇을 도와드릴까요?")).toBeTruthy();
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
      chatId: NEW_CHAT_ID,
      body: {
        message: "정리해줘",
        noteIds: [],
        projectIds: [],
      },
    });
    await waitFor(() =>
      expect(state.resumeUrls).toEqual([eventsUrl(NEW_CHAT_ID, TURN_ID)])
    );
    expect(state.order.slice(0, 2)).toEqual(["send", "open"]);

    await waitFor(() => expect(state.refetchedChatIds).toEqual([NEW_CHAT_ID]));
  });

  it("예시를 누르면 보내지 않고 입력창만 채운다 — 보내기는 사람이 한다", async () => {
    const events: unknown[] = [];
    const off = onTrack((event, properties) =>
      events.push([event, properties])
    );
    renderChat();
    openPanel();
    fireEvent.click(screen.getByRole("button", { name: "최근 결정" }));

    expect(state.createMock).not.toHaveBeenCalled();
    expect(state.streamCalls).toHaveLength(0);
    expect(screen.getByRole("textbox", { name: "메시지" }).textContent).toBe(
      "최근 2주간 회의에서 정한 것을 근거와 함께 정리해줘"
    );
    expect(events).toContainEqual([
      "chat_example_clicked",
      { workspace_id: WORKSPACE_ID, kind: "decisions", state: "workspace" },
    ]);
    off();

    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    expect((state.streamCalls[0].body as { message: string }).message).toBe(
      "최근 2주간 회의에서 정한 것을 근거와 함께 정리해줘"
    );
  });

  it("지난 회의 요약 칩을 고르면 가장 최근 회의록이 범위 칩으로 붙고 그 범위로 보낸다", async () => {
    noteList.data = {
      status: 200,
      data: {
        success: true,
        data: {
          notes: [
            {
              noteId: "01K0000000002",
              title: "주간 제품 회의",
              meetingStatus: "ENDED",
            },
          ],
          hasMore: false,
        },
      },
    };
    try {
      renderChat();
      openPanel();
      fireEvent.click(
        await screen.findByRole("button", { name: "지난 회의 요약" })
      );
      expect(chipsInInput()).toEqual(["주간 제품 회의"]);
      expect(
        screen.getByRole("textbox", { name: "메시지" }).textContent
      ).toContain("이 회의를 요약해줘");
      fireEvent.click(screen.getByRole("button", { name: "보내기" }));
      await waitFor(() => expect(state.streamCalls).toHaveLength(1));
      expect(state.streamCalls[0].body).toMatchObject({
        noteIds: ["01K0000000002"],
      });
    } finally {
      noteList.data = undefined;
    }
  });

  it("회의록에서 열면 그 회의 기준 칩이 서고, 고르면 칩을 지닌 채 그 범위로 보낸다", async () => {
    renderChat(<NoteScope hidden={false} />);
    openPanel();
    await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));

    fireEvent.click(screen.getByRole("button", { name: "이 회의 결정" }));
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    expect(state.streamCalls[0].body).toMatchObject({
      noteIds: [NOTE_ID],
    });
    expect(
      (state.streamCalls[0].body as { message: string }).message
    ).toContain("이 회의에서 정한 것을 근거와 함께 정리해줘");
  });

  it("쓰던 글이 있으면 시작 카드가 보내지 않고 문장만 덧붙인다", async () => {
    renderChat();
    openPanel();
    write("회의 하나만");
    fireEvent.click(screen.getByRole("button", { name: "최근 결정" }));

    expect(state.createMock).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox").textContent).toContain("회의 하나만");
    expect(screen.getByRole("textbox").textContent).toContain(
      "최근 2주간 회의에서 정한 것을 근거와 함께 정리해줘"
    );
  });

  it("목록에 대화가 있으면 새로 만들지 않는다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    expect(state.createMock).not.toHaveBeenCalled();
    expect(state.streamCalls[0].chatId).toBe(CHAT_ID);
  });

  it("★ 202 가 준 turnId 가 상태에 선다 — 중지가 그 값으로 취소한다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.holdStream = true;
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.releaseStream).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "중지" }));

    expect(state.cancelMock).toHaveBeenCalledWith({
      chatId: CHAT_ID,
      turnId: TURN_ID,
    });
    state.releaseStream?.();
  });

  it("정상 종료 뒤 히스토리를 다시 읽고 현재 답변을 유지한다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
    expect(screen.getByText("정리했습니다.")).toBeTruthy();
  });

  it("새 대화의 첫 답이 저장된 뒤에도 보던 말풍선을 다시 만들지 않는다", async () => {
    state.holdStream = true;
    state.onRefetch = () => {
      state.messages = [
        {
          turnId: TURN_ID,
          createdAt: new Date().toISOString(),
          role: "USER",
          content: "정리해줘",
          scope: [],
          toolEvent: null,
        },
        {
          turnId: TURN_ID,
          createdAt: new Date().toISOString(),
          role: "ASSISTANT",
          content: "정리했습니다.",
          scope: [],
          toolEvent: null,
        },
      ];
    };
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.releaseStream).not.toBeNull());
    const answer = screen.getByTestId("assistant-message");
    const question = screen.getByText("정리해줘");
    state.releaseStream?.();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
        "disabled",
        false
      )
    );
    expect(state.refetchedChatIds).toContain(NEW_CHAT_ID);
    expect(screen.getByTestId("assistant-message")).toBe(answer);
    expect(screen.getByText("정리해줘")).toBe(question);
    expect(screen.getAllByTestId("assistant-message")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "복사" })).toBeTruthy();
  });

  it("히스토리 갱신이 실패하면 방금 끝난 턴을 지우지 않는다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.refreshFails = true;
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
    expect(screen.getByText("정리했습니다.")).toBeTruthy();
    expect(screen.getByText("정리해줘")).toBeTruthy();
  });

  it("완료 직후 히스토리 조회가 실패해도 답변을 오류 화면으로 교체하지 않는다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.holdStream = true;
    renderChat();
    openPanel();
    await sendMessage("정리해줘");
    await waitFor(() => expect(state.releaseStream).not.toBeNull());
    state.historyFails = true;
    state.refreshFails = true;
    state.releaseStream?.();

    await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
    expect(screen.getByText("정리했습니다.")).toBeTruthy();
    expect(screen.getByText("정리해줘")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "답은 화면에 남아 있습니다."
    );
  });

  it("완료된 답변을 보는 중 목록 재조회가 실패하면 목록을 다시 시도한다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    const { rerender, client } = renderChat();
    openPanel();
    await sendMessage("정리해줘");
    expect(await screen.findByText("정리했습니다.")).toBeTruthy();

    state.chatsFail = true;
    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider workspaceId={WORKSPACE_ID}>
          {null}
        </PersonalChatProvider>
      </QueryClientProvider>
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "대화 목록을 다시 읽지 못했습니다."
    );
    expect(screen.getByText("정리했습니다.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(state.chatsRefetchMock).toHaveBeenCalledOnce();
    expect(state.refetchMock).not.toHaveBeenCalled();
  });

  it("기본 대화에서 보내면 목록 순서가 바뀌어도 완료된 턴을 그 대화에 둔다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    renderChat();
    openPanel();
    await sendMessage("정리해줘");
    expect(await screen.findByText("정리했습니다.")).toBeTruthy();

    state.chats = [chatRow(OTHER_CHAT_ID), chatRow(CHAT_ID)];
    fireEvent.click(historyButton());
    expect(state.messagesArgs.at(-1)).toMatchObject({ chatId: CHAT_ID });
    expect(screen.getByText("정리했습니다.")).toBeTruthy();
  });

  it("목록 조회가 실패하면 빈 상태 대신 오류를 보이고 대화를 만들지 않는다", async () => {
    state.chatsFail = true;
    renderChat();
    openPanel();

    expect(screen.getByRole("alert").textContent).toContain(
      "대화를 불러오지 못했습니다."
    );
    expect(screen.queryByText("무엇을 도와드릴까요?")).toBeNull();
    expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
      "disabled",
      true
    );
    expect(state.createMock).not.toHaveBeenCalled();
  });

  it("전송이 끝나기 전 두 번째 전송을 받지 않는다", async () => {
    renderChat();
    openPanel();
    await sendMessage("정리해줘");
    await sendMessage("한 번 더");

    await waitFor(() => expect(state.streamCalls.length).toBeGreaterThan(0));
    expect(state.createMock).toHaveBeenCalledTimes(1);
    expect(state.streamCalls).toHaveLength(1);
  });

  it("뒤에 대화가 더 있으면 기록 끝의 버튼으로 이어 읽어 붙인다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.chatsHasMore = true;
    state.olderChats = [
      chatRow("01KOLDERCHAT01", null, "2026-06-30T00:00:00Z"),
    ];
    renderChat();
    openPanel();
    fireEvent.click(await screen.findByRole("button", { name: "대화 기록" }));

    fireEvent.click(
      await screen.findByRole("button", { name: "이전 대화 더 보기" })
    );

    await screen.findByRole("button", {
      name: /^대화 01KOLDERCHAT01(?! 메뉴)/,
    });
    expect(state.olderCalls[0]?.[1]).toEqual({
      limit: "30",
      afterUpdatedAt: "2026-07-01T00:00:00Z",
      afterChatId: "01KNEXTCHATID0",
    });
    expect(
      screen.queryByRole("button", { name: "이전 대화 더 보기" })
    ).toBeNull();
  });

  it("첫 쪽의 끝이 움직이면 붙여 둔 옛 쪽을 버리고 다시 이어 읽게 한다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.chatsHasMore = true;
    state.olderChats = [
      chatRow("01KOLDERCHAT01", null, "2026-06-30T00:00:00Z"),
    ];
    renderChat();
    openPanel();
    fireEvent.click(await screen.findByRole("button", { name: "대화 기록" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "이전 대화 더 보기" })
    );
    await screen.findByRole("button", {
      name: /^대화 01KOLDERCHAT01(?! 메뉴)/,
    });

    state.chatsNextId = "01KOTHERNEXT00";
    fireEvent.click(screen.getByRole("button", { name: "대화로 돌아가기" }));
    fireEvent.click(await screen.findByRole("button", { name: "대화 기록" }));

    expect(
      screen.queryByRole("button", { name: /^대화 01KOLDERCHAT01(?! 메뉴)/ })
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "이전 대화 더 보기" })
    ).toBeTruthy();
  });

  it("더 읽다 실패하면 이미 보던 기록은 그대로 두고 버튼이 남는다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.chatsHasMore = true;
    state.olderFails = true;
    renderChat();
    openPanel();
    fireEvent.click(await screen.findByRole("button", { name: "대화 기록" }));

    fireEvent.click(
      await screen.findByRole("button", { name: "이전 대화 더 보기" })
    );

    await waitFor(() => expect(state.olderCalls).toHaveLength(1));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "이전 대화 더 보기" })
      ).toBeEnabled()
    );
    expect(
      screen.getByRole("button", {
        name: new RegExp(`^대화 ${CHAT_ID}(?! 메뉴)`),
      })
    ).toBeTruthy();
  });

  it("열린 대화를 지우면 확인한 뒤 서버에서 지우고 빈 새 대화로 선다 (APP-1409)", async () => {
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

    await deleteFromHeader();
    expect(state.deleteMock).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "삭제" }));

    await waitFor(() =>
      expect(state.deleteMock).toHaveBeenCalledWith(
        expect.objectContaining({ chatId: CHAT_ID })
      )
    );
    await waitFor(() =>
      expect(screen.queryByText("이전 대화입니다.")).toBeNull()
    );
    expect(screen.getByText("무엇을 도와드릴까요?")).toBeTruthy();
  });

  it("이미 지운 대화(404)는 성공으로 접고 다른 실패는 알린다 (APP-1409)", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.deleteMock.mockRejectedValueOnce({
      status: 500,
      envelope: { code: "INTERNAL_ERROR", message: "서버 오류" },
    });
    renderChat();
    openPanel();
    await deleteFromHeader();
    fireEvent.click(await screen.findByRole("button", { name: "삭제" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledOnce());
  });

  describe("이름 바꾸기", () => {
    async function editHeader() {
      fireEvent.click(
        await screen.findByRole("button", {
          name: `이름 변경: 대화 ${CHAT_ID}`,
        })
      );
      return screen.getByRole("textbox", {
        name: "대화 제목",
      }) as HTMLInputElement;
    }

    it("머리글 제목을 그 자리에서 고치고 Enter 로 저장한다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      const input = await editHeader();
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);

      fireEvent.change(input, { target: { value: "  스프린트   회고  " } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() =>
        expect(renameMock).toHaveBeenCalledWith(
          renamed(CHAT_ID, "스프린트 회고")
        )
      );
      expect(screen.queryByRole("textbox", { name: "대화 제목" })).toBeNull();
    });

    it("Esc 는 취소, 빈 값은 저장하지 않고 원래 이름으로 돌아간다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();

      let input = await editHeader();
      fireEvent.change(input, { target: { value: "버릴 이름" } });
      fireEvent.keyDown(input, { key: "Escape" });

      input = await editHeader();
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.blur(input);

      expect(renameMock).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: `이름 변경: 대화 ${CHAT_ID}` })
      ).toBeTruthy();
    });

    it("한글 조합 중 Enter 는 저장하지 않고, 바깥 클릭은 저장한다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      const input = await editHeader();
      fireEvent.change(input, { target: { value: "회의" } });
      fireEvent.keyDown(input, { key: "Enter", isComposing: true });
      fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
      expect(renameMock).not.toHaveBeenCalled();

      fireEvent.blur(input);
      await waitFor(() =>
        expect(renameMock).toHaveBeenCalledWith(renamed(CHAT_ID, "회의"))
      );
    });

    it("저장이 실패하면 원래 이름으로 되돌리고 알린다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      renameMock.mockRejectedValueOnce({
        success: false,
        data: null,
        error: { code: "INVALID_INPUT", message: "잘못된 입력" },
      });
      renderChat();
      openPanel();
      const input = await editHeader();
      fireEvent.change(input, { target: { value: "새 이름" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith("이름을 바꾸지 못했습니다.")
      );
      expect(
        screen.getByRole("button", { name: `이름 변경: 대화 ${CHAT_ID}` })
      ).toBeTruthy();
    });

    it("이미 없는 대화(404)면 목록에서 빼고 빈 새 대화로 선다", async () => {
      state.chats = [chatRow(CHAT_ID), chatRow(OTHER_CHAT_ID)];
      renameMock.mockRejectedValueOnce({
        success: false,
        data: null,
        error: { code: "AGENT_CHAT_NOT_FOUND", message: "없음" },
      });
      renderChat();
      openPanel();
      const input = await editHeader();
      state.chats = [chatRow(OTHER_CHAT_ID)];
      fireEvent.change(input, { target: { value: "새 이름" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() =>
        expect(screen.getByText("무엇을 도와드릴까요?")).toBeTruthy()
      );
      fireEvent.click(historyButton());
      const history = within(screen.getByTestId("chat-history-view"));
      expect(history.queryByText(`대화 ${CHAT_ID}`)).toBeNull();
      expect(toastError).not.toHaveBeenCalled();
    });

    it("기록 줄의 메뉴에서 그 줄을 그 자리에서 고친다", async () => {
      state.chats = [chatRow(CHAT_ID), chatRow(OTHER_CHAT_ID)];
      renderChat();
      openPanel();
      fireEvent.click(historyButton());

      fireEvent.click(
        await screen.findByRole("button", {
          name: `대화 ${OTHER_CHAT_ID} 메뉴`,
        })
      );
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "이름 변경" })
      );
      const input = screen.getByRole("textbox", { name: "대화 제목" });
      fireEvent.change(input, { target: { value: "두 번째" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() =>
        expect(renameMock).toHaveBeenCalledWith(
          renamed(OTHER_CHAT_ID, "두 번째")
        )
      );
    });

    it("기록 줄의 메뉴 삭제는 헤더와 같은 확인·삭제 경로를 탄다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      fireEvent.click(historyButton());

      fireEvent.click(
        await screen.findByRole("button", { name: `대화 ${CHAT_ID} 메뉴` })
      );
      fireEvent.click(await screen.findByRole("menuitem", { name: "삭제" }));
      expect(state.deleteMock).not.toHaveBeenCalled();
      fireEvent.click(await screen.findByRole("button", { name: "삭제" }));

      await waitFor(() =>
        expect(state.deleteMock).toHaveBeenCalledWith(
          expect.objectContaining({ chatId: CHAT_ID })
        )
      );
    });

    it("Enter·Esc 로 끝내면 포커스가 머리글 제목 버튼으로 돌아온다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      const titleName = `이름 변경: 대화 ${CHAT_ID}`;

      let input = await editHeader();
      fireEvent.change(input, { target: { value: "새 이름" } });
      fireEvent.keyDown(input, { key: "Enter" });
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole("button", { name: titleName })
        )
      );

      input = await editHeader();
      fireEvent.keyDown(input, { key: "Escape" });
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole("button", { name: titleName })
        )
      );
    });

    it("다른 버튼을 눌러 빠지면 그 버튼에서 포커스를 뺏지 않는다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      const input = await editHeader();
      const history = historyButton();
      history.focus();
      fireEvent.blur(input, { relatedTarget: history });

      await waitFor(() =>
        expect(screen.queryByRole("textbox", { name: "대화 제목" })).toBeNull()
      );
      expect(document.activeElement).toBe(history);
    });

    it("기록 줄에서 편집을 끝내면 그 줄의 메뉴 버튼으로 돌아온다", async () => {
      state.chats = [chatRow(CHAT_ID), chatRow(OTHER_CHAT_ID)];
      renderChat();
      openPanel();
      fireEvent.click(historyButton());
      const menuName = `대화 ${OTHER_CHAT_ID} 메뉴`;

      fireEvent.click(await screen.findByRole("button", { name: menuName }));
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "이름 변경" })
      );
      const input = await screen.findByRole("textbox", { name: "대화 제목" });
      await waitFor(() => expect(document.activeElement).toBe(input));
      fireEvent.keyDown(input, { key: "Escape" });

      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole("button", { name: menuName })
        )
      );
    });

    it("계측이 읽도록 워크스페이스와 바꾸기 전 출처를 요청 변수에 싣는다", async () => {
      state.chats = [{ ...chatRow(CHAT_ID), titleSource: "AI" } as never];
      renderChat();
      openPanel();
      const input = await editHeader();
      fireEvent.change(input, { target: { value: "두 번째" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() =>
        expect(renameMock).toHaveBeenCalledWith({
          chatId: CHAT_ID,
          data: { title: "두 번째" },
          workspaceId: WORKSPACE_ID,
          previousTitleSource: "AI",
        })
      );
    });

    it("기록 줄 메뉴의 삭제도 계측이 읽을 워크스페이스를 싣는다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      fireEvent.click(historyButton());
      fireEvent.click(
        await screen.findByRole("button", { name: `대화 ${CHAT_ID} 메뉴` })
      );
      fireEvent.click(await screen.findByRole("menuitem", { name: "삭제" }));
      fireEvent.click(await screen.findByRole("button", { name: "삭제" }));

      await waitFor(() =>
        expect(state.deleteMock).toHaveBeenCalledWith({
          chatId: CHAT_ID,
          workspaceId: WORKSPACE_ID,
        })
      );
    });

    it("서버가 바꾼 제목은 목록을 다시 읽으면 머리글에 서고, 편집 중인 글자는 덮지 않는다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      const { rerender, client } = renderChat();
      openPanel();
      await screen.findByRole("button", {
        name: `이름 변경: 대화 ${CHAT_ID}`,
      });
      const refetched = () =>
        rerender(
          <QueryClientProvider client={client}>
            <PersonalChatProvider workspaceId={WORKSPACE_ID}>
              {null}
            </PersonalChatProvider>
          </QueryClientProvider>
        );

      state.chats = [{ ...chatRow(CHAT_ID), title: "AI 제목" }];
      refetched();
      fireEvent.click(
        await screen.findByRole("button", { name: "이름 변경: AI 제목" })
      );
      const input = screen.getByRole("textbox", {
        name: "대화 제목",
      }) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "내가 쓰는 중" } });
      state.chats = [{ ...chatRow(CHAT_ID), title: "다른 탭 제목" }];
      refetched();
      expect(input.value).toBe("내가 쓰는 중");
    });
  });

  describe("AI 제목을 기다리는 동안 (APP-1440)", () => {
    function rerendered(
      rerender: (ui: React.ReactNode) => void,
      client: QueryClient
    ) {
      rerender(
        <QueryClientProvider client={client}>
          <PersonalChatProvider workspaceId={WORKSPACE_ID}>
            {null}
          </PersonalChatProvider>
        </QueryClientProvider>
      );
    }

    it("이 탭에서 연 새 대화는 첫 질문 문장 대신 「새 대화」가 빛나다가 AI 제목으로 바뀐다", async () => {
      const { rerender, client } = renderChat();
      openPanel();
      await sendMessage("정리해줘");
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
          "disabled",
          false
        )
      );

      state.chats = [
        { ...chatRow(NEW_CHAT_ID), title: "정리해줘", titleSource: "QUESTION" },
      ] as never;
      rerendered(rerender, client);
      const pending = await screen.findByRole("button", {
        name: "제목 만드는 중",
      });
      expect(pending.getAttribute("aria-busy")).toBe("true");
      expect(pending.querySelector(".chat-shimmer")?.textContent).toBe(
        "새 대화"
      );

      state.chats = [
        { ...chatRow(NEW_CHAT_ID), title: "회의 정리", titleSource: "AI" },
      ] as never;
      rerendered(rerender, client);
      const titled = await screen.findByRole("button", {
        name: "이름 변경: 회의 정리",
      });
      expect(titled.getAttribute("aria-busy")).toBeNull();
      expect(titled.querySelector(".chat-title-in")).toBeTruthy();
    });

    it("이 탭에서 시작하지 않은 옛 대화의 첫 질문 제목은 곧바로 보인다", async () => {
      state.chats = [
        { ...chatRow(CHAT_ID), title: "지난 질문", titleSource: "QUESTION" },
      ] as never;
      renderChat();
      openPanel();
      expect(
        await screen.findByRole("button", { name: "이름 변경: 지난 질문" })
      ).toBeTruthy();
    });

    it("서버의 기본 제목(「새 대화」)은 화면 언어로 그린다", async () => {
      state.chats = [
        { ...chatRow(CHAT_ID), title: "새 대화", titleSource: "DEFAULT" },
      ] as never;
      renderChat(undefined, "en");
      fireEvent.click(screen.getByRole("button", { name: "Open My agent" }));
      expect(
        await screen.findByRole("button", { name: "Rename: New chat" })
      ).toBeTruthy();
      expect(screen.queryByText("새 대화")).toBeNull();
    });
  });

  describe("겹친 요청과 외부 갱신 (APP-1433 리뷰)", () => {
    function deferred<T>() {
      let resolve!: (value: T) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }
    const FAIL = {
      success: false,
      data: null,
      error: { code: "INVALID_INPUT", message: "잘못된 입력" },
    };
    const OLDER_A = "01KOLDERCHAT0A";
    const OLDER_B = "01KOLDERCHAT0B";

    function refetchedWith(
      rerender: (ui: React.ReactElement) => void,
      client: QueryClient
    ) {
      return () =>
        rerender(
          <QueryClientProvider client={client}>
            <PersonalChatProvider workspaceId={WORKSPACE_ID}>
              {null}
            </PersonalChatProvider>
          </QueryClientProvider>
        );
    }

    async function openOlder() {
      fireEvent.click(historyButton());
      fireEvent.click(
        await screen.findByRole("button", { name: "이전 대화 더 보기" })
      );
      await screen.findByRole("button", {
        name: new RegExp(`^대화 ${OLDER_B}(?! 메뉴)`),
      });
    }

    async function renameRow(
      chatId: string,
      currentTitle: string,
      title: string
    ) {
      fireEvent.click(
        await screen.findByRole("button", { name: `${currentTitle} 메뉴` })
      );
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "이름 변경" })
      );
      const input = screen.getByRole("textbox", { name: "대화 제목" });
      fireEvent.change(input, { target: { value: title } });
      fireEvent.keyDown(input, { key: "Enter" });
      await waitFor(() =>
        expect(renameMock).toHaveBeenCalledWith(renamed(chatId, title))
      );
    }

    function olderSetup() {
      state.chats = [chatRow(CHAT_ID)];
      state.chatsHasMore = true;
      state.olderChats = [
        chatRow(OLDER_A, null, "2026-06-30T00:00:00Z"),
        chatRow(OLDER_B, null, "2026-06-29T00:00:00Z"),
      ];
    }

    it("삭제가 끝나기 전에 다른 대화로 옮겼으면 옮겨 간 대화의 입력과 화면을 건드리지 않는다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      const pending = deferred<{ status: number }>();
      state.deleteMock.mockReturnValueOnce(pending.promise);
      const { rerender, client } = renderChat();
      openPanel();
      await deleteFromHeader();
      fireEvent.click(await screen.findByRole("button", { name: "삭제" }));
      await waitFor(() => expect(state.deleteMock).toHaveBeenCalled());

      state.chats = [chatRow(OTHER_CHAT_ID), chatRow(CHAT_ID)];
      refetchedWith(rerender, client)();
      await screen.findByRole("button", {
        name: `이름 변경: 대화 ${OTHER_CHAT_ID}`,
        hidden: true,
      });
      const composer = screen.getByRole("textbox", {
        name: "메시지",
        hidden: true,
      });
      composer.textContent = "B에 쓰던 문장";
      fireEvent.input(composer);

      state.chats = [chatRow(OTHER_CHAT_ID)];
      await act(async () => pending.resolve({ status: 204 }));

      expect(screen.getByRole("textbox", { name: "메시지" }).textContent).toBe(
        "B에 쓰던 문장"
      );
      expect(
        screen.getByRole("button", {
          name: `이름 변경: 대화 ${OTHER_CHAT_ID}`,
        })
      ).toBeTruthy();
    });

    it("서로 다른 대화의 이름 바꾸기가 겹쳐도 실패한 쪽만 되돌린다", async () => {
      olderSetup();
      const first = deferred<{ status: number }>();
      const second = deferred<{ status: number }>();
      renameMock
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      renderChat();
      openPanel();
      await openOlder();

      await renameRow(OLDER_A, `대화 ${OLDER_A}`, "첫째");
      await renameRow(OLDER_B, `대화 ${OLDER_B}`, "둘째");
      await act(async () => first.reject(FAIL));

      expect(
        screen.getByRole("button", { name: /^둘째(?! 메뉴)/ })
      ).toBeTruthy();
      expect(
        screen.getByRole("button", {
          name: new RegExp(`^대화 ${OLDER_A}(?! 메뉴)`),
        })
      ).toBeTruthy();
      await act(async () => second.resolve({ status: 200 }));
      expect(
        screen.getByRole("button", { name: /^둘째(?! 메뉴)/ })
      ).toBeTruthy();
    });

    it("같은 대화에 겹친 이름 바꾸기는 마지막 요청만 되돌릴 수 있고, 되돌릴 곳은 서버가 확인한 제목이다", async () => {
      olderSetup();
      const first = deferred<{ status: number }>();
      const second = deferred<{ status: number }>();
      renameMock
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      renderChat();
      openPanel();
      await openOlder();

      await renameRow(OLDER_A, `대화 ${OLDER_A}`, "하나");
      await renameRow(OLDER_A, "하나", "둘");
      await act(async () => first.reject(FAIL));
      expect(screen.getByRole("button", { name: /^둘(?! 메뉴)/ })).toBeTruthy();
      await act(async () => second.reject(FAIL));
      expect(
        screen.getByRole("button", {
          name: new RegExp(`^대화 ${OLDER_A}(?! 메뉴)`),
        })
      ).toBeTruthy();
    });

    it("되돌리기는 그 사이 서버가 준 다른 제목을 덮지 않는다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      const pending = deferred<{ status: number }>();
      renameMock.mockReturnValueOnce(pending.promise);
      const { client } = renderChat();
      const key = ["/v1/workspaces", WORKSPACE_ID, "agent-chats"];
      const listed = (title: string) => ({
        status: 200,
        data: {
          success: true,
          data: { chats: [{ ...chatRow(CHAT_ID), title }] },
        },
      });
      client.setQueryData(key, listed(`대화 ${CHAT_ID}`));
      openPanel();
      const input = await (async () => {
        fireEvent.click(
          await screen.findByRole("button", {
            name: `이름 변경: 대화 ${CHAT_ID}`,
          })
        );
        return screen.getByRole("textbox", { name: "대화 제목" });
      })();
      fireEvent.change(input, { target: { value: "내 이름" } });
      fireEvent.keyDown(input, { key: "Enter" });
      await waitFor(() => expect(renameMock).toHaveBeenCalled());
      await waitFor(() =>
        expect(
          (client.getQueryData(key) as ReturnType<typeof listed>).data.data
            .chats[0].title
        ).toBe("내 이름")
      );

      client.setQueryData(key, listed("다른 탭 제목"));
      await act(async () => pending.reject(FAIL));
      expect(
        (client.getQueryData(key) as ReturnType<typeof listed>).data.data
          .chats[0].title
      ).toBe("다른 탭 제목");
    });

    it("머리글 편집 중 목록 재조회로 열린 대화가 바뀌어도 입력은 남고 편집하던 대화에 저장한다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      const { rerender, client } = renderChat();
      openPanel();
      fireEvent.click(
        await screen.findByRole("button", {
          name: `이름 변경: 대화 ${CHAT_ID}`,
        })
      );
      const input = screen.getByRole("textbox", {
        name: "대화 제목",
      }) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "쓰던 이름" } });

      state.chats = [chatRow(OTHER_CHAT_ID), chatRow(CHAT_ID)];
      refetchedWith(rerender, client)();

      const still = screen.getByRole("textbox", {
        name: "대화 제목",
      }) as HTMLInputElement;
      expect(still).toBe(input);
      expect(still.value).toBe("쓰던 이름");
      fireEvent.keyDown(still, { key: "Enter" });
      await waitFor(() =>
        expect(renameMock).toHaveBeenCalledWith(renamed(CHAT_ID, "쓰던 이름"))
      );
    });

    it("기록 줄 편집 중 재조회로 그 줄이 다른 묶음으로 옮겨 가도 입력이 다시 마운트되지 않는다", async () => {
      const old = new Date(Date.now() - 10 * 86_400_000).toISOString();
      state.chats = [chatRow(CHAT_ID), chatRow(OTHER_CHAT_ID, null, old)];
      const { rerender, client } = renderChat();
      openPanel();
      fireEvent.click(historyButton());
      fireEvent.click(
        await screen.findByRole("button", {
          name: `대화 ${OTHER_CHAT_ID} 메뉴`,
        })
      );
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "이름 변경" })
      );
      const input = screen.getByRole("textbox", {
        name: "대화 제목",
      }) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "옮겨도 남는다" } });

      state.chats = [chatRow(OTHER_CHAT_ID), chatRow(CHAT_ID)];
      refetchedWith(rerender, client)();

      const still = screen.getByRole("textbox", {
        name: "대화 제목",
      }) as HTMLInputElement;
      expect(still).toBe(input);
      expect(still.value).toBe("옮겨도 남는다");
    });

    it("편집하던 대화가 실제로 지워지면 편집이 끝난다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      renameMock.mockRejectedValueOnce({
        success: false,
        data: null,
        error: { code: "AGENT_CHAT_NOT_FOUND", message: "없음" },
      });
      renderChat();
      openPanel();
      fireEvent.click(
        await screen.findByRole("button", {
          name: `이름 변경: 대화 ${CHAT_ID}`,
        })
      );
      const input = screen.getByRole("textbox", { name: "대화 제목" });
      state.chats = [];
      fireEvent.change(input, { target: { value: "없는 대화" } });
      fireEvent.keyDown(input, { key: "Enter" });
      await waitFor(() =>
        expect(screen.queryByRole("textbox", { name: "대화 제목" })).toBeNull()
      );
    });
  });

  describe("개편된 머리글·런처 (APP-1436)", () => {
    it("머리글 ⋯ 메뉴의 「이름 바꾸기」는 그 자리 편집을 연다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      fireEvent.click(await screen.findByTestId("chat-menu"));
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "이름 변경" })
      );
      const input = await screen.findByRole("textbox", { name: "대화 제목" });
      fireEvent.change(input, { target: { value: "메뉴로 바꾼 이름" } });
      fireEvent.keyDown(input, { key: "Enter" });
      await waitFor(() =>
        expect(renameMock).toHaveBeenCalledWith(
          renamed(CHAT_ID, "메뉴로 바꾼 이름")
        )
      );
    });

    it("빈 새 대화에는 ⋯ 메뉴가 없다 — 바꿀 이름도 지울 것도 없다", () => {
      renderChat();
      openPanel();
      expect(screen.queryByTestId("chat-menu")).toBeNull();
    });

    it("★ 답이 흐르는 동안 패널을 닫으면 런처에 점이 서고, 끝나면 사라진다", async () => {
      state.holdStream = true;
      renderChat();
      openPanel();
      await sendMessage("정리해줘");
      await waitFor(() => expect(state.streamCalls).toHaveLength(1));
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));

      const fab = screen.getByRole("button", { name: "내 에이전트 열기" });
      await waitFor(() =>
        expect(fab.querySelector('[data-attention="running"]')).toBeTruthy()
      );
      expect(fab.getAttribute("aria-describedby")).toBe("agent-fab-attention");

      await act(async () => state.releaseStream?.());
      await waitFor(() =>
        expect(fab.querySelector("[data-attention]")).toBeNull()
      );
    });

    it("★ 승인을 기다리면 런처가 「승인이 필요합니다」로 알린다", async () => {
      state.approvalStream = true;
      renderChat();
      openPanel();
      await sendMessage("이슈 만들어줘");
      await screen.findByTestId("approval-card");
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));

      const fab = screen.getByRole("button", { name: "내 에이전트 열기" });
      expect(fab.querySelector('[data-attention="approval"]')).toBeTruthy();
      expect(document.getElementById("agent-fab-attention")?.textContent).toBe(
        "승인이 필요합니다"
      );
    });

    it("입력창 안내는 @ 로 참조하는 법을 말한다", () => {
      renderChat();
      openPanel();
      expect(
        screen
          .getByRole("textbox", { name: "메시지" })
          .getAttribute("data-placeholder")
      ).toBe("@로 프로젝트나 회의록을 붙여 물어보세요");
    });

    it("맨 아래에 있으면 「맨 아래로」는 흐려지고 눌리지 않는다", () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      const button = screen.getByRole("button", { name: "맨 아래로" });
      expect(button.closest("[inert]")).toBeTruthy();
    });
  });

  it("★ ＋ 는 서버를 안 부르고 화면만 빈 새 대화로 바꾼다", async () => {
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
    expect(screen.getByText("무엇을 도와드릴까요?")).toBeTruthy();
  });

  it("★ ＋ 를 누른 뒤에 목록 첫 줄이 대신 열리지 않는다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    renderChat();
    openPanel();
    await waitFor(() =>
      expect(state.messagesArgs.at(-1)).toMatchObject({ chatId: CHAT_ID })
    );

    clickNewChat();

    const last = state.messagesArgs.at(-1) as {
      chatId: string;
      options: { query: { enabled: boolean } };
    };
    expect(last.chatId).toBe("");
    expect(last.options.query.enabled).toBe(false);
  });

  it("★ 새 노트가 요청하면 보던 대화 대신 빈 새 대화로 바뀐다 (APP-1278)", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.messages = [
      {
        createdAt: "2026-07-24T00:00:00Z",
        role: "ASSISTANT",
        content: "이전 대화입니다.",
        toolEvent: null,
      },
    ];
    renderChat(<FreshChatTrigger />);
    openPanel();
    await waitFor(() =>
      expect(screen.getByText("이전 대화입니다.")).toBeTruthy()
    );

    fireEvent.click(screen.getByRole("button", { name: "새 노트 만듦" }));

    await waitFor(() =>
      expect(screen.queryByText("이전 대화입니다.")).toBeNull()
    );
    expect(screen.getByText("무엇을 도와드릴까요?")).toBeTruthy();
    expect(state.createMock).not.toHaveBeenCalled();
  });

  it("★ 패널을 열기 전에 요청해도 앞 대화를 한 번도 읽지 않는다 (APP-1278)", async () => {
    state.chats = [chatRow(CHAT_ID)];
    renderChat(<FreshChatTrigger />);
    fireEvent.click(screen.getByRole("button", { name: "새 노트 만듦" }));
    openPanel();

    await waitFor(() =>
      expect(screen.getByText("무엇을 도와드릴까요?")).toBeTruthy()
    );
    expect(
      state.messagesArgs.some(
        (args) => (args as { chatId: string }).chatId === CHAT_ID
      )
    ).toBe(false);
    pickChat(CHAT_ID);
    await waitFor(() =>
      expect(state.messagesArgs.at(-1)).toMatchObject({ chatId: CHAT_ID })
    );
  });

  it("★ ＋ 를 두 번 눌러도 아무 일이 없다", () => {
    state.chats = [chatRow(CHAT_ID)];
    renderChat();
    openPanel();
    clickNewChat();
    write("쓰던 문장");
    clickNewChat();

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
    expect(state.streamCalls[0].chatId).toBe(NEW_CHAT_ID);
  });

  it("새 대화가 범위도 함께 비운다", async () => {
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

    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "메시지" }).textContent
      ).not.toContain("이건 지워져야 한다")
    );
    expect(chipsInInput()).toEqual(["주간 제품 회의"]);
  });

  it("워크스페이스에서 연 새 대화에는 붙을 칩이 없다", async () => {
    renderChat();
    openPanel();
    clickNewChat();
    expect(chipsInInput()).toEqual([]);
  });

  it("회의록에 들어가면 그 회의록이 칩으로 미리 붙는다", async () => {
    const { rerender, client } = renderChat();
    openPanel();
    expect(screen.queryByTestId("scope-chips")).toBeNull();

    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider workspaceId={WORKSPACE_ID}>
          <NoteScope hidden={false} />
        </PersonalChatProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));
    expect(chipsInInput()).toEqual(["주간 제품 회의"]);
    expect(state.chatsParams.at(-1)).toBe(WORKSPACE_ID);
  });

  it("지운 칩은 회의록을 나갔다 와도 다시 안 붙는다", async () => {
    const { rerender, client } = renderChat(<NoteScope hidden={false} />);
    openPanel();
    await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));

    removeChipFromInput("주간 제품 회의");
    await waitFor(() => expect(chipsInInput()).toEqual([]));
    expect(chipsInInput()).toEqual([]);

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

  describe("노트 화면의 기본 범위 칩", () => {
    const OTHER_NOTE_ID = "01K0000000006";

    function at(child: React.ReactNode, client: QueryClient) {
      return (
        <QueryClientProvider client={client}>
          <PersonalChatProvider workspaceId={WORKSPACE_ID}>
            {child}
          </PersonalChatProvider>
        </QueryClientProvider>
      );
    }

    function pickNoteByHand(id: string, title: string) {
      const input = screen.getByRole("textbox", { name: "메시지" });
      const chip = document.createElement("span");
      chip.setAttribute("data-scope-chip", "note");
      chip.setAttribute("data-scope-id", id);
      chip.setAttribute("data-scope-title", title);
      chip.textContent = title;
      input.append(chip, document.createTextNode(" "));
      fireEvent.input(input);
    }

    it("기록에서 연 기존 대화에도 그 노트 칩이 붙는다", async () => {
      state.chats = [chatRow(CHAT_ID), chatRow(OTHER_CHAT_ID)];
      renderChat(<NoteScope hidden={false} />);
      openPanel();
      await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));

      pickChat(OTHER_CHAT_ID);
      await waitFor(() =>
        expect(state.messagesArgs.at(-1)).toMatchObject({
          chatId: OTHER_CHAT_ID,
        })
      );
      expect(chipsInInput()).toEqual(["주간 제품 회의"]);
    });

    it("빼낸 칩은 같은 노트에서 보낸 뒤에도 다시 안 붙는다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat(<NoteScope hidden={false} />);
      openPanel();
      await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));
      removeChipFromInput("주간 제품 회의");

      appendAfterChips("정리해줘");
      fireEvent.click(screen.getByRole("button", { name: "보내기" }));
      await waitFor(() => expect(state.streamCalls).toHaveLength(1));
      expect(state.streamCalls[0].body).toMatchObject({ noteIds: [] });
      expect(chipsInInput()).toEqual([]);
    });

    it("다른 노트로 옮기면 기본 칩만 새 노트로 바뀌고 손으로 고른 칩은 남는다", async () => {
      const { rerender, client } = renderChat(<NoteScope hidden={false} />);
      openPanel();
      await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));
      pickNoteByHand("01K0000000007", "킥오프");

      rerender(
        at(
          <NoteScope hidden={false} noteId={OTHER_NOTE_ID} title="회고" />,
          client
        )
      );
      await waitFor(() => expect(chipsInInput()).toEqual(["회고", "킥오프"]));
    });

    it("노트 밖으로 나가면 기본 칩이 빠진다", async () => {
      const { rerender, client } = renderChat(<NoteScope hidden={false} />);
      openPanel();
      await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));

      rerender(at(null, client));
      await waitFor(() => expect(chipsInInput()).toEqual([]));
    });

    it("이미 그 노트 칩이 붙어 있으면 겹쳐 붙이지 않는다", async () => {
      const { rerender, client } = renderChat(<NoteScope hidden={false} />);
      openPanel();
      await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));
      pickNoteByHand(OTHER_NOTE_ID, "회고");

      rerender(
        at(
          <NoteScope hidden={false} noteId={OTHER_NOTE_ID} title="회고" />,
          client
        )
      );
      await waitFor(() => expect(chipsInInput()).toEqual(["회고"]));
      rerender(at(null, client));
      expect(chipsInInput()).toEqual(["회고"]);
    });
  });

  it("닫아도 패널을 언마운트하지 않는다", async () => {
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
    expect(screen.queryByText("무엇을 도와드릴까요?")).toBeNull();
    expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("워크스페이스 스코프로 열려 있을 때 노트를 side로 열어도 패널이 갈리지 않는다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    const { rerender, client } = renderChat();
    openPanel();
    await waitFor(() => expect(state.chatsParams.at(-1)).toBe(WORKSPACE_ID));

    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider workspaceId={WORKSPACE_ID}>
          <NoteScope hidden />
        </PersonalChatProvider>
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("personal-chat-panel")).toHaveAttribute(
        "data-hidden"
      )
    );
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
        <PersonalChatProvider workspaceId={WORKSPACE_ID}>
          <NoteScope hidden />
        </PersonalChatProvider>
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("personal-chat-panel")).toHaveAttribute(
        "data-hidden"
      )
    );
    expect(state.chatsParams.at(-1)).toBe(WORKSPACE_ID);
    expect(
      screen.queryByRole("button", { name: "내 에이전트 열기" })
    ).toBeNull();
    expect(state.aborted).toBe(false);
  });

  it("워크스페이스에서 연 개인 챗봇은 노트 회의 중으로 새지 않는다", async () => {
    const { rerender, client } = renderChat();
    openPanel();
    expect(screen.getByTestId("personal-chat-panel")).not.toHaveAttribute(
      "data-hidden"
    );

    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider workspaceId={WORKSPACE_ID}>
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
    state.chatsLoading = true;
    renderChat();
    openPanel();

    expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("새 대화가 만들어지는 중에는 보내지 않는다", () => {
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
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
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

    state.holdStream = true;
    await sendMessage("정리해줘");
    await waitFor(() => expect(state.releaseStream).not.toBeNull());
    await waitFor(() => expect(dividers()).toBe(2));

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

    await waitFor(() => expect(dividers()).toBe(2));
  });

  it("히스토리가 나중에 그 턴을 담아 오면 로컬 사본을 겹쳐 그리지 않는다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.refreshFails = true;
    const { rerender, client } = renderChat();
    openPanel();
    await sendMessage("정리해줘");
    await waitFor(() => expect(screen.getByText("정리했습니다.")).toBeTruthy());

    state.messages = [
      {
        turnId: TURN_ID,
        createdAt: "2026-07-24T00:00:00Z",
        role: "USER",
        content: "정리해줘",
        toolEvent: null,
      },
      {
        turnId: TURN_ID,
        createdAt: "2026-07-24T00:00:01Z",
        role: "ASSISTANT",
        content: "정리했습니다.",
        toolEvent: null,
      },
    ];
    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider workspaceId={WORKSPACE_ID}>
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

    await waitFor(() =>
      expect(screen.getAllByText("정리했습니다.")).toHaveLength(2)
    );
    expect(screen.getByText("정리해줘")).toBeTruthy();
  });

  it("승인은 2차 스트림이 확정할 때까지 다시 눌리지 않는다", async () => {
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
      expect(
        document
          .querySelector('[data-testid="approval-card"]')
          ?.getAttribute("data-approval")
      ).toBe("running")
    );
    expect(screen.queryByRole("button", { name: "승인" })).toBeNull();
    expect(screen.queryByRole("button", { name: "거절" })).toBeNull();
    expect(state.approveMock).toHaveBeenCalledTimes(1);
    expect(state.approveMock).toHaveBeenCalledWith({
      chatId: CHAT_ID,
      approvalId: "0K9GVJT2C4Q7F",
      data: { decision: "APPROVED" },
    });
    await waitFor(() =>
      expect(state.resumeUrls.at(-1)).toBe(
        eventsUrl(CHAT_ID, TURN_ID, APPROVAL_ENTRY_ID)
      )
    );

    state.releaseStream?.();
  });

  it("★ 2차가 끝나면 히스토리를 다시 읽되 이 탭의 로컬 말풍선을 유지한다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.approvalStream = true;
    renderChat();
    openPanel();
    await sendMessage("이슈 만들어줘");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "승인" })).toBeTruthy()
    );
    const question = screen.getByText("이슈 만들어줘");
    expect(state.refetchedChatIds).toEqual([]);

    state.messages = [
      {
        createdAt: "2026-07-24T00:00:00Z",
        role: "USER",
        content: "이슈 만들어줘",
        toolEvent: null,
        turnId: TURN_ID,
      },
      {
        createdAt: "2026-07-24T00:00:02Z",
        role: "ASSISTANT",
        content: "만들었습니다.",
        toolEvent: null,
        turnId: TURN_ID,
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
    expect(screen.getByText("이슈 만들어줘")).toBe(question);
    expect(screen.queryByRole("button", { name: "승인" })).toBeNull();
  });

  it("★ 승인 202 뒤 확정 프레임 없이 턴이 실패하면 카드와 줄이 「확인 필요」다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.approvalStream = true;
    state.approvalThenFails = true;
    renderChat();
    openPanel();
    await sendMessage("이슈 만들어줘");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "승인" })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    await waitFor(() => expect(state.releaseStream).not.toBeNull());
    state.releaseStream?.();

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "승인" })).toBeNull()
    );
    expect(screen.getByText("확인 필요")).toBeTruthy();
    expect(screen.queryByText(/중단됨/)).toBeNull();
    expect(
      [...document.querySelectorAll('[data-testid="approval-card"]')].map(
        (card) => card.getAttribute("data-approval")
      )
    ).toEqual(["check"]);
    expect(document.querySelectorAll('[data-step="tool"]')).toHaveLength(0);
  });

  it("★ 승인 202 가 앞 스트림이 닫히기 전에 와도 결정이 남는다 — 쓰기 줄이 「중단됨」이 안 된다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.approvalStream = true;
    state.holdAfterApprovalRequest = null;
    renderChat();
    openPanel();
    await sendMessage("이슈 만들어줘");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "승인" })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    await waitFor(() => expect(state.approveMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(state.holdAfterApprovalRequest).toBeTypeOf("function")
    );
    await act(async () => (state.holdAfterApprovalRequest as () => void)());

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "승인" })).toBeNull()
    );
    expect(
      [...document.querySelectorAll('[data-testid="approval-card"]')].map(
        (card) => card.getAttribute("data-approval")
      )
    ).toEqual(["check"]);
  });

  it("승인이 재시도 가능한 오류로 실패하면 잠금을 푼다", async () => {
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
    expect(screen.getByText("정리했")).toBeTruthy();
  });

  it("지나간 승인은 카드를 무효화한다 — 버튼이 사라지고 사유가 남는다", async () => {
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
    state.chats = [chatRow(CHAT_ID)];
    state.historyMissing = true;
    renderChat();
    openPanel();

    expect(screen.getByText("무엇을 도와드릴까요?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
      "disabled",
      false
    );
    expect(historyButton()).toHaveProperty("disabled", false);
  });

  it("턴이 도는 동안에는 노트를 떠나도 스코프가 바뀌지 않는다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    const { rerender, client } = renderChat(<NoteScope hidden={false} />);
    openPanel();
    await waitFor(() => expect(state.chatsParams.at(-1)).toBe(WORKSPACE_ID));

    write("정리해줘");
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider workspaceId={WORKSPACE_ID}>
          {null}
        </PersonalChatProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    expect(state.aborted).toBe(false);
  });

  it("조회가 실패하면 기록도 새 대화도 막는다", () => {
    state.chatsFail = true;
    renderChat();
    openPanel();

    expect(historyButton()).toHaveProperty("disabled", true);
    expect(screen.getByTestId("chat-list-new")).toHaveProperty(
      "disabled",
      true
    );
  });

  it("★ 못 닿은 문장이 컴포저로 돌아오고, 그대로 보내면 같은 몸통이 나간다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.streamFails = true;
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "메시지" }).textContent
      ).toContain("정리해줘")
    );

    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() => expect(state.streamCalls).toHaveLength(2));
    expect(state.streamCalls[1].body).toEqual(state.streamCalls[0].body);
  });

  it("★ 프로젝트 칩이 projectIds 로 나간다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    renderChat();
    openPanel();
    putProjectChip("결제 개편");
    appendAfterChips("이번 분기 결정 정리해줘");
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    expect(state.streamCalls[0].body).toMatchObject({
      noteIds: [],
      projectIds: ["01K0000000009"],
    });
  });

  it("★ 회의록 안에서 보낸 다음 질문도 그 회의록을 범위로 들고 간다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    renderChat(<NoteScope hidden={false} />);
    openPanel();
    await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));
    appendAfterChips("누가 무슨 일을 맡았어?");
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    await waitFor(() => expect(state.streamCalls).toHaveLength(1));

    await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "보내기" })).toBeTruthy()
    );
    appendAfterChips("그중 가장 급한 건?");
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() => expect(state.streamCalls).toHaveLength(2));
    expect(state.streamCalls[1].body).toMatchObject({ noteIds: [NOTE_ID] });
  });

  it("★ 되돌린 문장이 범위도 함께 들고 온다", async () => {
    state.chats = [chatRow(CHAT_ID)];
    state.streamFails = true;
    renderChat(<NoteScope hidden={false} />);
    openPanel();
    await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));
    appendAfterChips("정리해줘");
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    expect(state.streamCalls[0].body).toMatchObject({ noteIds: [NOTE_ID] });

    await waitFor(() => expect(chipsInInput()).toEqual(["주간 제품 회의"]));

    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() => expect(state.streamCalls).toHaveLength(2));
    expect(state.streamCalls[1].body).toEqual(state.streamCalls[0].body);
  });

  describe("돌아오면 이어받는다", () => {
    function frame(event: string, payload: unknown, id?: string) {
      return {
        event,
        data: JSON.stringify(payload),
        ...(id === undefined ? {} : { id }),
      };
    }

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

    it("★ 히스토리가 실어 준 답 조각에 재생이 이어 붙는다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = "1735689600000-6";
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "IN_PROGRESS",
        pendingApproval: null,
      };
      state.messages = [
        historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B"),
        historyRow("THINKING", "전사를 봅니다.", "0K9GVJT2C4Q3B"),
        historyRow("ASSISTANT", "안녕", "0K9GVJT2C4Q3B"),
      ];
      state.resumeFrames = [
        frame("token", { delta: "하세요" }, "1735689600000-7"),
      ];
      renderChat();
      openPanel();

      await waitFor(() =>
        expect(state.resumeUrls).toContain(
          eventsUrl(CHAT_ID, "0K9GVJT2C4Q3B", "1735689600000-6")
        )
      );
      expect(await screen.findByText("안녕하세요")).toBeTruthy();
      expect(screen.queryByText("안녕")).toBeNull();
      expandSteps();
      expect(screen.getByText("전사를 봅니다.")).toBeTruthy();
    });

    it("★ activeTurn이 있으면 cursor부터 턴 스트림으로 잇고 누적 전문을 그린다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = "1735689600000-4";
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "IN_PROGRESS",
        pendingApproval: null,
      };
      state.resumeFrames = [
        frame("token", { delta: "안녕하" }, "1735689600000-5"),
        frame("token", { delta: "세요" }, "1735689600000-6"),
      ];
      renderChat();
      openPanel();

      await waitFor(() =>
        expect(state.resumeUrls).toContain(
          eventsUrl(CHAT_ID, "0K9GVJT2C4Q3B", "1735689600000-4")
        )
      );
      expect(await screen.findByText("안녕하세요")).toBeTruthy();
      expect(state.streamCalls).toHaveLength(0);
    });

    it("★ 410 을 받으면 히스토리를 다시 읽고 그 결과가 화면에 선다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = "1735689600000-4";
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "IN_PROGRESS",
        pendingApproval: null,
      };
      state.messages = [historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B")];
      state.onRefetch = () => {
        state.messages = [
          historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B"),
          historyRow("ASSISTANT", "TTL 뒤에 읽은 답", "0K9GVJT2C4Q3B"),
        ];
        state.activeTurn = null;
        state.lastTurn = {
          turnId: "0K9GVJT2C4Q3B",
          status: "COMPLETED",
          failureCode: null,
          retryable: null,
        };
      };
      state.resumeFailure = {
        success: false,
        data: null,
        error: { code: "SSE_STREAM_GONE", message: "스트림이 사라졌습니다." },
      };
      renderChat();
      openPanel();

      await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
      expect(await screen.findByText("TTL 뒤에 읽은 답")).toBeTruthy();
      expect(state.resumeUrls).toHaveLength(1);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
          "disabled",
          false
        )
      );
    });

    it("★ 재연결을 포기하면 히스토리를 다시 읽어 그 사이 끝난 답을 세운다", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        state.chats = [chatRow(CHAT_ID)];
        state.cursor = "1735689600000-4";
        state.activeTurn = {
          turnId: "0K9GVJT2C4Q3B",
          status: "IN_PROGRESS",
          pendingApproval: null,
        };
        state.messages = [historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B")];
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
        state.resumeFrames = [];
        renderChat();
        openPanel();

        await waitFor(() => expect(state.resumeUrls.length).toBeGreaterThan(0));
        await vi.advanceTimersByTimeAsync(60_000);

        await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
        expect(await screen.findByText("서버가 굳힌 답")).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });

    it("★ 포기한 뒤 히스토리가 「끝났다」고 하면 로컬 사본을 접는다", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        state.chats = [chatRow(CHAT_ID)];
        state.cursor = null;
        state.activeTurn = {
          turnId: "0K9GVJT2C4Q3B",
          status: "IN_PROGRESS",
          pendingApproval: null,
        };
        state.messages = [historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B")];
        state.resumeFrames = [
          frame("thinking_delta", { text: "전사를 훑습니다" }, "1-0"),
        ];
        state.onRefetch = () => {
          state.messages = [
            historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B"),
            historyRow("THINKING", "전사를 훑습니다", "0K9GVJT2C4Q3B"),
          ];
          state.activeTurn = null;
          state.lastTurn = {
            turnId: "0K9GVJT2C4Q3B",
            status: "FAILED",
            failureCode: "STREAM_INTERRUPTED",
            retryable: true,
          };
        };
        renderChat();
        openPanel();

        expect(await screen.findByText("전사를 훑습니다")).toBeTruthy();
        state.resumeFrames = [];
        await vi.advanceTimersByTimeAsync(60_000);

        await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
        await waitFor(() => {
          expandSteps();
          expect(screen.getAllByText("전사를 훑습니다")).toHaveLength(1);
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("★ 포기한 뒤 히스토리가 「아직 돈다」고 하면 다시 붙는다", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        state.chats = [chatRow(CHAT_ID)];
        state.cursor = "1735689600000-4";
        state.activeTurn = {
          turnId: "0K9GVJT2C4Q3B",
          status: "IN_PROGRESS",
          pendingApproval: null,
        };
        state.messages = [historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B")];
        state.resumeFrames = [];
        renderChat();
        openPanel();

        await waitFor(() => expect(state.resumeUrls.length).toBeGreaterThan(0));
        let opensAtRefetch = -1;
        state.onRefetch = () => {
          opensAtRefetch = state.resumeUrls.length;
        };
        await vi.advanceTimersByTimeAsync(60_000);

        await waitFor(() => expect(opensAtRefetch).toBeGreaterThan(0));
        await waitFor(() =>
          expect(state.resumeUrls.length).toBeGreaterThan(opensAtRefetch)
        );
        expect(state.resumeUrls.at(-1)).toBe(
          `${eventsUrl(CHAT_ID, "0K9GVJT2C4Q3B")}?after=1735689600000-4`
        );
        expect(screen.queryByText("응답이 중간에 끊겼습니다.")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("★ 포기한 뒤 히스토리가 같은 턴의 승인 대기를 주면 승인 카드를 세운다", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        state.chats = [chatRow(CHAT_ID)];
        state.cursor = "1735689600000-4";
        state.activeTurn = {
          turnId: "0K9GVJT2C4Q3B",
          status: "IN_PROGRESS",
          pendingApproval: null,
        };
        state.messages = [historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B")];
        state.resumeFrames = [];
        renderChat();
        openPanel();

        await waitFor(() => expect(state.resumeUrls.length).toBeGreaterThan(0));
        state.onRefetch = () => {
          state.activeTurn = {
            turnId: "0K9GVJT2C4Q3B",
            status: "WAITING_APPROVAL",
            pendingApproval: {
              approvalId: "0K9GVJT2C4Q7F",
              tool: "linear.create_issue",
              summary: "Linear 이슈 생성",
            },
          };
        };
        await vi.advanceTimersByTimeAsync(60_000);

        expect(
          await screen.findByRole("button", { name: "승인" })
        ).toBeTruthy();
        expect(screen.queryByText("응답이 중간에 끊겼습니다.")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("★ 포기 뒤 재조회가 실패하면 탭이 돌아올 때 다시 묻는다", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        state.chats = [chatRow(CHAT_ID)];
        state.cursor = "1735689600000-4";
        state.activeTurn = {
          turnId: "0K9GVJT2C4Q3B",
          status: "IN_PROGRESS",
          pendingApproval: null,
        };
        state.messages = [historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B")];
        state.resumeFrames = [];
        renderChat();
        openPanel();

        await waitFor(() => expect(state.resumeUrls.length).toBeGreaterThan(0));
        state.refreshFails = true;
        await vi.advanceTimersByTimeAsync(60_000);
        await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));

        state.refreshFails = false;
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
        await act(async () => {
          document.dispatchEvent(new Event("visibilitychange"));
        });

        expect(await screen.findByText("서버가 굳힌 답")).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });

    it("★ cursor가 null 이어도 잇는다 — after 없이 처음부터 연다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = null;
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "IN_PROGRESS",
        pendingApproval: null,
      };
      renderChat();
      openPanel();

      await waitFor(() =>
        expect(state.resumeUrls).toContain(eventsUrl(CHAT_ID, "0K9GVJT2C4Q3B"))
      );
      expect(screen.queryByText("응답을 받지 못했습니다.")).toBeNull();
    });

    it("★ 승인 대기 중 돌아오면 카드가 다시 뜨고 스트림을 안 연다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = "1735689600000-9";
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
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = "1735689600000-4";
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
      expect(screen.queryByRole("button", { name: "보내기" })).toBeNull();
      expect(screen.getByRole("button", { name: "중지" })).toBeTruthy();
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
          "응답을 만들지 못했습니다. 잠시 후 다시 시도해 주세요."
        )
      ).toBeTruthy();
    });

    it("★ 도는 턴이 곧 마지막 턴이면 실패 배너를 안 세운다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = "1735689600000-4";
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

    it("★ 커서로 이어받은 턴은 카드 앞 생각·도구를 히스토리가 그린다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = APPROVAL_ENTRY_ID;
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "WAITING_APPROVAL",
        pendingApproval: {
          approvalId: "0K9GVJT2C4Q7F",
          tool: "linear.create_issue",
          summary: "Linear 이슈 생성",
        },
      };
      state.messages = [
        historyRow("USER", "이슈 만들어줘", "0K9GVJT2C4Q3B"),
        historyRow("THINKING", "필요한 팀을 확인하겠습니다.", "0K9GVJT2C4Q3B"),
        {
          ...historyRow("TOOL", "Linear 팀 목록 · 1건", "0K9GVJT2C4Q3B"),
          toolEvent: {
            tool: "linear.list_teams",
            decision: null,
            status: "success",
            url: null,
          },
        },
      ];
      renderChat();
      openPanel();

      expect(await screen.findByRole("button", { name: "승인" })).toBeTruthy();
      expect(state.resumeUrls).toHaveLength(0);

      fireEvent.click(screen.getByRole("button", { name: "생각" }));
      expect(screen.getAllByText("필요한 팀을 확인하겠습니다.")).toHaveLength(
        1
      );
      expect(screen.getAllByText("Linear 팀 목록 · 1건")).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "승인" })).toHaveLength(1);
    });

    it("★ 승인 대기는 커서가 없어도 히스토리를 접지 않는다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = null;
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "WAITING_APPROVAL",
        pendingApproval: {
          approvalId: "0K9GVJT2C4Q7F",
          tool: "linear.create_issue",
          summary: "Linear 이슈 생성",
        },
      };
      state.messages = [
        historyRow("USER", "이슈 만들어줘", "0K9GVJT2C4Q3B"),
        historyRow("THINKING", "필요한 팀을 확인하겠습니다.", "0K9GVJT2C4Q3B"),
        {
          ...historyRow("TOOL", "Linear 팀 목록 · 1건", "0K9GVJT2C4Q3B"),
          toolEvent: {
            tool: "linear.list_teams",
            decision: null,
            status: "success",
            url: null,
          },
        },
      ];
      renderChat();
      openPanel();

      expect(await screen.findByRole("button", { name: "승인" })).toBeTruthy();
      expect(state.resumeUrls).toHaveLength(0);

      fireEvent.click(screen.getByRole("button", { name: "생각" }));
      expect(screen.getAllByText("필요한 팀을 확인하겠습니다.")).toHaveLength(
        1
      );
      expect(screen.getAllByText("Linear 팀 목록 · 1건")).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "승인" })).toHaveLength(1);
    });

    it("★ 진행 중 턴의 도구 카드를 두 벌 그리지 않는다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = null;
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
          content: "스크립트에서 관련 발화 검색",
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
            summary: "스크립트에서 관련 발화 검색",
          },
          "1735689600000-5"
        ),
      ];
      renderChat();
      openPanel();

      await waitFor(() => expect(state.resumeUrls).toHaveLength(1));
      expect(
        await screen.findAllByText("스크립트에서 관련 발화 검색")
      ).toHaveLength(1);
      expect(screen.getByText("이슈 만들어줘")).toBeTruthy();
    });

    it("★ 409는 오류 배너가 아니라 이어받기다", async () => {
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
      await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
      expect(screen.queryByRole("button", { name: "다시 보내기" })).toBeNull();
      const restored = screen.getByRole("textbox", { name: "메시지" });
      expect(restored.textContent).toContain("겹쳐서 보낼래");
      expect(chipsInInput()).toEqual(["주간 제품 회의"]);
      expect(restored.textContent).not.toContain("noteId:");
    });

    it("★ 409 는 토스트를 띄우지 않는다 — 오류가 아니라 이어받기다", async () => {
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
      renderChat();
      openPanel();
      await sendMessage("정리해줘");

      await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
      expect(toastError).not.toHaveBeenCalled();
    });

    it("그 밖의 실패는 서버 문구를 토스트한다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.streamFails = true;
      state.streamFailure = {
        success: false,
        data: null,
        error: {
          code: "AGENT_CHAT_NOT_FOUND",
          message: "대화를 찾을 수 없습니다.",
        },
      };
      renderChat();
      openPanel();
      await sendMessage("정리해줘");

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith("대화를 찾을 수 없습니다.")
      );
      expect(toastError).toHaveBeenCalledTimes(1);
    });

    it("★ 409가 온 문장이 히스토리에 이미 있으면 컴포저로 안 되돌린다", async () => {
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
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = "1735689600000-4";
      state.streamFails = true;
      state.resumeFrames = [
        frame("token", { delta: "안녕하" }, "1735689600000-5"),
        frame("token", { delta: "세요" }, "1735689600000-6"),
      ];
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
      await waitFor(() =>
        expect(state.resumeUrls).toContain(
          eventsUrl(CHAT_ID, "0K9GVJT2C4Q3B", "1735689600000-4")
        )
      );
      expect(state.streamCalls).toHaveLength(1);
      expect(await screen.findByText("안녕하세요")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "다시 보내기" })).toBeNull();
      expect(screen.getAllByText("정리해줘")).toHaveLength(1);
    });

    it("★ 그 사이 턴이 끝나 있으면 답이 그대로 그려지고 다시 보낼 것이 없다", async () => {
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
      expect(state.resumeUrls).toHaveLength(0);
      expect(state.streamCalls).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "다시 보내기" })).toBeNull();
      expect(screen.getAllByText("정리해줘")).toHaveLength(1);
    });

    it("★ 히스토리가 그 질문을 안 받아 갔으면 문장을 컴포저로 되돌린다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.streamFails = true;
      renderChat();
      openPanel();
      await sendMessage("정리해줘");

      await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: "메시지" }).textContent
        ).toContain("정리해줘")
      );
      expect(screen.queryByRole("button", { name: "다시 보내기" })).toBeNull();
    });

    it("★ 토큰 없이 중지해도 생각 줄이 두 벌로 안 그려진다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = null;
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "IN_PROGRESS",
        pendingApproval: null,
      };
      state.messages = [historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B")];
      state.resumeFrames = [
        frame("thinking_delta", { text: "전사를 훑습니다" }, "1-0"),
      ];
      state.holdResume = true;
      renderChat();
      openPanel();

      await waitFor(() => expect(state.resumeUrls).toHaveLength(1));
      expect(await screen.findByText("전사를 훑습니다")).toBeTruthy();
      state.resumeFrames = [];
      state.onRefetch = () => {
        state.messages = [
          historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B"),
          historyRow("THINKING", "전사를 훑습니다", "0K9GVJT2C4Q3B"),
        ];
        state.activeTurn = null;
        state.lastTurn = {
          turnId: "0K9GVJT2C4Q3B",
          status: "CANCELLED",
          failureCode: null,
          retryable: null,
        };
      };

      fireEvent.click(await screen.findByRole("button", { name: "중지" }));
      await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
      await waitFor(() => {
        expandSteps();
        expect(screen.getAllByText("전사를 훑습니다")).toHaveLength(1);
      });
      expect(screen.getAllByText("정리해줘")).toHaveLength(1);
    });

    it("★ 중지가 턴을 취소한다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = "1735689600000-4";
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

      expect(state.cancelMock).toHaveBeenCalledWith({
        chatId: CHAT_ID,
        turnId: "0K9GVJT2C4Q3B",
      });
    });

    it("★ 중지 뒤 히스토리가 부분 답을 담아 오면 로컬 사본을 접는다", async () => {
      state.chats = [chatRow(CHAT_ID)];
      state.cursor = null;
      state.activeTurn = {
        turnId: "0K9GVJT2C4Q3B",
        status: "IN_PROGRESS",
        pendingApproval: null,
      };
      state.messages = [historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B")];
      state.resumeFrames = [frame("token", { delta: "반쯤" }, "1-0")];
      state.holdResume = true;
      state.onRefetch = () => {
        state.messages = [
          historyRow("USER", "정리해줘", "0K9GVJT2C4Q3B"),
          historyRow("ASSISTANT", "반쯤", "0K9GVJT2C4Q3B"),
        ];
        state.activeTurn = null;
        state.lastTurn = {
          turnId: "0K9GVJT2C4Q3B",
          status: "CANCELLED",
          failureCode: null,
          retryable: null,
        };
      };
      renderChat();
      openPanel();

      expect(await screen.findByText("반쯤")).toBeTruthy();
      fireEvent.click(await screen.findByRole("button", { name: "중지" }));

      await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
      await waitFor(() => expect(screen.getAllByText("반쯤")).toHaveLength(1));
      expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
        "disabled",
        false
      );
    });
  });

  describe("대화가 여럿 산다", () => {
    function twoChats() {
      state.chats = [chatRow(CHAT_ID, RUNNING_TURN), chatRow(OTHER_CHAT_ID)];
      state.activeTurnByChat = {
        [CHAT_ID]: {
          turnId: RUNNING_TURN.turnId,
          status: "IN_PROGRESS",
          pendingApproval: null,
        },
      };
      state.cursor = "1735689600000-4";
      state.holdResume = true;
    }

    it("★ A가 도는 동안 B로 옮기면 B의 전송이 안 잠긴다", async () => {
      twoChats();
      renderChat();
      openPanel();

      await waitFor(() => expect(state.resumeUrls).toHaveLength(1));
      expect(screen.queryByRole("button", { name: "보내기" })).toBeNull();

      pickChat(OTHER_CHAT_ID);

      await waitFor(() => expect(screen.queryByText("안녕하")).toBeNull());
      const send = screen.getByRole("button", { name: "보내기" });
      expect(send).toHaveProperty("disabled", false);

      await sendMessage("B에서 물어볼래");
      await waitFor(() => expect(state.streamCalls).toHaveLength(1));
      expect(state.streamCalls[0].chatId).toBe(OTHER_CHAT_ID);
    });

    it("★ 목록이 남의 턴을 말해도 전송을 잠그지 않는다", () => {
      state.chats = [chatRow(CHAT_ID), chatRow(OTHER_CHAT_ID, RUNNING_TURN)];
      renderChat();
      openPanel();

      expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
        "disabled",
        false
      );
    });

    it("★ 폴링이 배경에서 도는 동안에도 전송이 열려 있다", () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();

      expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
        "disabled",
        false
      );
    });

    it("★ 새 대화에 쓴 뒤에도 옛 대화를 고를 수 있다", async () => {
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
      twoChats();
      renderChat();
      openPanel();

      await waitFor(() => expect(state.resumeUrls).toHaveLength(1));
      pickChat(OTHER_CHAT_ID);
      pickChat(CHAT_ID);

      await waitFor(() => expect(state.resumeUrls).toHaveLength(2));
    });

    it("★ 배지는 목록이 말하고, 열린 대화는 SSE 가 이긴다", async () => {
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

      const rows = within(screen.getByTestId("chat-history-view"))
        .getAllByRole("button")
        .filter((row) => row.textContent?.startsWith("대화 "));
      expect(rows[0].textContent).toBe(`대화 ${CHAT_ID}방금`);
      expect(rows[1].textContent).toBe(`대화 ${OTHER_CHAT_ID}승인 대기`);
    });
  });

  describe("기록이 패널 안에서 교대한다", () => {
    function views() {
      return {
        thread: screen.getByTestId("chat-thread-view"),
        history: screen.getByTestId("chat-history-view"),
      };
    }

    it("★ 기록은 뜨는 레이어가 아니라 스레드와 같은 상자를 나눠 쓴다", () => {
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
      expect(views().history.textContent).toContain(`대화 ${CHAT_ID}`);

      fireEvent.click(historyButton());

      expect(views().history.hasAttribute("inert")).toBe(false);
      expect(views().thread.hasAttribute("inert")).toBe(true);
      expect(views().thread.textContent).toContain(
        "가려져도 남아 있어야 합니다."
      );
      expect(views().history.textContent).toContain(`대화 ${CHAT_ID}`);
    });

    it("★ 뷰가 갈리면 포커스를 손으로 옮긴다", () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();

      fireEvent.click(historyButton());
      const back = screen.getByRole("button", { name: "대화로 돌아가기" });
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

    it("★ 머리글은 하나다 — 기록 화면에서 같은 자리의 ←가 돌아가고, 목록 위 뒤로가기 줄은 없다", () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      const header = () =>
        screen.getByTestId("personal-chat-panel").querySelector("header")!;
      expect(header().querySelector("button")).toBe(historyButton());
      fireEvent.click(historyButton());

      const back = screen.getByRole("button", { name: "대화로 돌아가기" });
      expect(header().querySelector("button")).toBe(back);
      expect(header().textContent).toContain("대화 기록");
      expect(
        within(views().history).queryByRole("button", { name: /뒤로/ })
      ).toBeNull();

      fireEvent.click(back);
      expect(views().history.hasAttribute("inert")).toBe(true);
    });

    it("★ 기록에서 Esc 를 누르면 대화로 돌아간다", () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      fireEvent.click(historyButton());
      fireEvent.keyDown(
        screen.getByRole("button", { name: "대화로 돌아가기" }),
        { key: "Escape" }
      );
      expect(views().history.hasAttribute("inert")).toBe(true);
    });

    it("기록이 비었으면 비었다고 말하고 새 대화로 이끈다", () => {
      renderChat();
      openPanel();
      fireEvent.click(historyButton());
      const empty = screen.getByTestId("chat-history-empty");
      expect(empty.textContent).toContain("아직 대화가 없습니다");
      fireEvent.click(within(empty).getByRole("button", { name: "새 대화" }));
      expect(views().history.hasAttribute("inert")).toBe(true);
    });

    it("★ 지금 보는 대화는 색이 아니라 접근성 속성으로도 말한다", () => {
      state.chats = [chatRow(CHAT_ID), chatRow(OTHER_CHAT_ID)];
      renderChat();
      openPanel();
      fireEvent.click(historyButton());

      const rows = within(screen.getByTestId("chat-history-view"))
        .getAllByRole("button")
        .filter((row) => row.textContent?.startsWith("대화 "));
      expect(rows[0].getAttribute("aria-current")).toBe("true");
      expect(rows[1].hasAttribute("aria-current")).toBe(false);
    });

    it("★ 빈 새 대화를 쓰는 중이면 아무 줄도 선택돼 있지 않다", () => {
      state.chats = [chatRow(CHAT_ID)];
      renderChat();
      openPanel();
      clickNewChat();
      fireEvent.click(historyButton());

      const history = screen.getByTestId("chat-history-view");
      expect(history.querySelector("[aria-current]")).toBeNull();
    });

    it("★ 기록 목록이 날짜로 묶이고 줄마다 마지막으로 쓴 시각을 적는다", () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 9, 5, 12));
      try {
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
        ).toEqual(["오늘", "지난 7일"]);

        const rows = [...history.querySelectorAll("button")].filter((row) =>
          row.textContent?.startsWith("대화 ")
        );
        expect(rows.map((row) => row.textContent?.slice(3, 16))).toEqual([
          CHAT_ID,
          OTHER_CHAT_ID,
        ]);
        expect(rows[0].lastElementChild?.textContent).not.toBe(
          rows[1].lastElementChild?.textContent
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("헤더 첫 줄이 지금 보고 있는 대화의 제목이다", () => {
      state.chats = [chatRow(CHAT_ID), chatRow(OTHER_CHAT_ID)];
      renderChat();
      openPanel();

      const header = screen
        .getByTestId("personal-chat-panel")
        .querySelector("header");
      expect(header?.textContent).toContain(`대화 ${CHAT_ID}`);
      expect(header?.textContent).not.toContain("전체");
      expect(
        within(header!).queryByRole("button", { name: "대화 삭제" })
      ).toBeNull();
      expect(
        within(header!).getByRole("button", { name: "대화 메뉴" })
      ).toBeTruthy();
    });
  });
});
