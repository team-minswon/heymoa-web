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

const WORKSPACE_ID = "01K0000000001";
const NOTE_ID = "01K0000000002";
const CHAT_ID = "01K0000000003";
const NEW_CHAT_ID = "01K0000000004";

const state = vi.hoisted(() => ({
  active: null as { chatId: string; scope: string } | null,
  messages: [] as unknown[],
  createMock: vi.fn(),
  approveMock: vi.fn(),
  refetchMock: vi.fn(),
  refetchedChatIds: [] as string[],
  activeFails: false,
  refreshFails: false,
  historyFails: false,
  historyMissing: false,
  activeLoading: false,
  createPending: false,
  activeParams: [] as unknown[],
  messagesArgs: [] as unknown[],
  streamCalls: [] as { url: string; body: unknown }[],
  aborted: false,
  holdStream: false,
  approvalStream: false,
  approvalError: null as unknown,
  releaseStream: null as (() => void) | null,
}));

vi.mock("@/lib/api/generated/agent-chat/agent-chat", () => ({
  getGetActiveAgentChatQueryKey: (params: unknown) => ["active", params],
  getGetAgentChatMessagesQueryKey: (chatId: string) => ["messages", chatId],
  // 첫 전송은 방금 만든 chatId로 직접 가져온다 — 훅의 refetch는 아직 빈 id에 묶여 있다.
  getGetAgentChatMessagesQueryOptions: (chatId: string) => ({
    queryKey: ["messages", chatId],
    queryFn: () => {
      state.refetchedChatIds.push(chatId);
      if (state.refreshFails) throw new Error("REFRESH_FAILED");
      return {
        status: 200,
        data: { success: true, data: { messages: state.messages } },
      };
    },
  }),
  getSendAgentChatMessageUrl: (chatId: string) =>
    `/v1/agent-chats/${chatId}/messages`,
  useGetActiveAgentChat: (params: unknown) => {
    state.activeParams.push(params);
    return {
      isPending: false,
      isLoading: state.activeLoading,
      refetch: vi.fn(),
      data: state.activeLoading
        ? undefined
        : state.activeFails
        ? { status: 500, data: { success: false, data: null } }
        : { status: 200, data: { success: true, data: state.active } },
    };
  },
  useGetAgentChatMessages: (chatId: string, options: unknown) => {
    state.messagesArgs.push({ chatId, options });
    // enabled:false여도 TanStack은 pending으로 둔다 — 화면이 isPending을 믿으면
    // 활성 세션이 없을 때 스켈레톤에 갇힌다.
    const enabled = Boolean(chatId);
    const data =
      enabled && !state.historyFails && !state.historyMissing
        ? { status: 200, data: { success: true, data: { messages: state.messages } } }
        : undefined;
    return {
      isPending: !enabled,
      isLoading: false,
      isError: enabled && (state.historyFails || state.historyMissing),
      error: state.historyMissing
        ? {
            success: false,
            data: null,
            error: { code: "AGENT_CHAT_NOT_FOUND", message: "없는 대화입니다." },
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
  useResolveToolApproval: () => ({
    mutate: (
      variables: unknown,
      options?: { onError?: (error: unknown) => void }
    ) => {
      state.approveMock(variables);
      if (state.approvalError) options?.onError?.(state.approvalError);
    },
    isPending: false,
  }),
}));

vi.mock("@/lib/api/generated/notes/notes", () => ({
  useGetNote: (noteId: string) => ({
    isPending: false,
    data: noteId
      ? {
          status: 200,
          data: { success: true, data: { noteId, title: "주간 제품 회의" } },
        }
      : undefined,
  }),
}));

vi.mock("@/lib/api/sse", () => ({
  postEventStream: async function* (
    url: string,
    body: unknown,
    options?: { signal?: AbortSignal }
  ) {
    state.streamCalls.push({ url, body });
    options?.signal?.addEventListener("abort", () => {
      state.aborted = true;
    });
    yield {
      event: "message_start",
      data: JSON.stringify({ chatId: CHAT_ID, messageId: "m1" }),
    };
    yield { event: "token", data: JSON.stringify({ delta: "정리했" }) };
    if (state.approvalStream) {
      yield {
        event: "tool_approval_request",
        data: JSON.stringify({
          approvalId: "0K9GVJT2C4Q7F",
          toolCallId: "call_02",
          tool: "linear.create_issue",
          summary: "Linear 이슈 생성",
        }),
      };
      // 확정은 승인 API가 아니라 스트림이 한다 — 그때까지 붙잡아 둔다.
      await new Promise<void>((resolve) => {
        state.releaseStream = resolve;
      });
    }
    if (state.holdStream) {
      await new Promise<void>((resolve) => {
        state.releaseStream = resolve;
      });
    }
    yield {
      event: "message_end",
      data: JSON.stringify({ messageId: "m1", content: "정리했습니다." }),
    };
  },
}));

function NoteScope({
  hidden,
  noteId = NOTE_ID,
}: {
  hidden: boolean;
  noteId?: string;
}) {
  usePersonalChatScope({ noteId, hidden });
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

async function sendMessage(text: string) {
  fireEvent.change(screen.getByLabelText("메시지"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "보내기" }));
}

describe("PersonalChatProvider", () => {
  beforeEach(() => {
    state.active = null;
    state.messages = [];
    state.activeParams = [];
    state.messagesArgs = [];
    state.streamCalls = [];
    state.aborted = false;
    state.holdStream = false;
    state.approvalStream = false;
    state.approvalError = null;
    state.releaseStream = null;
    state.activeFails = false;
    state.refreshFails = false;
    state.historyFails = false;
    state.historyMissing = false;
    state.activeLoading = false;
    state.createPending = false;
    state.refetchMock.mockReset();
    state.refetchedChatIds = [];
    state.createMock.mockReset().mockResolvedValue({
      status: 201,
      data: { success: true, data: { chatId: NEW_CHAT_ID } },
    });
    state.approveMock.mockReset();
  });

  afterEach(cleanup);

  it("활성 세션이 없으면 빈 상태를 보인다", () => {
    renderChat();
    openPanel();
    expect(screen.getByText("아직 시작된 대화가 없습니다.")).toBeTruthy();
    expect(state.messagesArgs.at(-1)).toMatchObject({
      chatId: "",
      options: { query: { enabled: false } },
    });
  });

  it("활성 세션이 있으면 그 chatId로 히스토리를 읽는다", async () => {
    state.active = { chatId: CHAT_ID, scope: "workspace" };
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

  it("활성 세션이 없으면 첫 전송이 세션을 만들고 그 id로 스트림을 연다", async () => {
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.createMock).toHaveBeenCalledTimes(1));
    expect(state.createMock).toHaveBeenCalledWith({
      data: { scope: "workspace", workspaceId: WORKSPACE_ID },
    });
    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    expect(state.streamCalls[0]).toEqual({
      url: `/v1/agent-chats/${NEW_CHAT_ID}/messages`,
      body: { message: "정리해줘" },
    });

    // 히스토리도 **방금 만든** chatId로 다시 읽어야 한다. 훅의 refetch를 쓰면 아직
    // 빈 id에 묶여 있어 `/v1/agent-chats//messages`를 부른다.
    await waitFor(() => expect(state.refetchedChatIds).toEqual([NEW_CHAT_ID]));
  });

  it("활성 세션이 있으면 세션을 새로 만들지 않는다", async () => {
    state.active = { chatId: CHAT_ID, scope: "workspace" };
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    expect(state.createMock).not.toHaveBeenCalled();
    expect(state.streamCalls[0].url).toBe(`/v1/agent-chats/${CHAT_ID}/messages`);
  });

  it("정상 종료 뒤 히스토리를 다시 읽고 스트림을 비운다", async () => {
    state.active = { chatId: CHAT_ID, scope: "workspace" };
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
    state.active = { chatId: CHAT_ID, scope: "workspace" };
    state.refreshFails = true;
    renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() => expect(state.refetchedChatIds).toContain(CHAT_ID));
    expect(screen.getByText("정리했습니다.")).toBeTruthy();
    expect(screen.getByText("정리해줘")).toBeTruthy();
  });

  it("활성 세션 조회가 실패하면 빈 상태 대신 오류를 보이고 세션을 만들지 않는다", async () => {
    state.activeFails = true;
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

  it("새 대화가 세션을 만들고 스레드를 비운다", async () => {
    state.active = { chatId: CHAT_ID, scope: "workspace" };
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
    fireEvent.click(screen.getByRole("button", { name: /새 대화/ }));

    await waitFor(() => expect(state.createMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(state.messagesArgs.at(-1)).toMatchObject({ chatId: NEW_CHAT_ID })
    );
  });

  it("노트 스코프면 노트 제목을, 아니면 워크스페이스 이름을 보인다", async () => {
    const { rerender, client } = renderChat();
    openPanel();
    expect(screen.getByText("헤이모아")).toBeTruthy();

    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider workspaceId={WORKSPACE_ID} workspaceName="헤이모아">
          <NoteScope hidden={false} />
        </PersonalChatProvider>
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText("주간 제품 회의")).toBeTruthy());
    expect(state.activeParams.at(-1)).toEqual({ scope: "note", noteId: NOTE_ID });
  });

  it("닫아도 패널을 언마운트하지 않는다", async () => {
    // 언마운트하면 useChatStream이 abort하고, 계약상 부분 응답은 저장되지 않아
    // 흐르던 답변이 통째로 사라진다. 닫기도 감추기다.
    renderChat();
    openPanel();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    await waitFor(() =>
      expect(screen.getByTestId("personal-chat-panel").className).toContain(
        "hidden"
      )
    );
    expect(state.aborted).toBe(false);
  });

  it("첫 전송이 세션을 만들면 활성 조회 캐시를 갱신한다", async () => {
    const { invalidate } = renderChat();
    openPanel();
    await sendMessage("정리해줘");

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: [
          "active",
          { scope: "workspace", workspaceId: WORKSPACE_ID },
        ],
      })
    );
  });

  it("히스토리를 못 읽으면 빈 대화로 보이지 않고 전송을 막는다", async () => {
    state.active = { chatId: CHAT_ID, scope: "workspace" };
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
    state.active = { chatId: CHAT_ID, scope: "workspace" };
    const { rerender, client } = renderChat();
    openPanel();
    await waitFor(() =>
      expect(state.activeParams.at(-1)).toEqual({
        scope: "workspace",
        workspaceId: WORKSPACE_ID,
      })
    );

    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider workspaceId={WORKSPACE_ID} workspaceName="헤이모아">
          <NoteScope hidden />
        </PersonalChatProvider>
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("personal-chat-panel").className).toContain(
        "hidden"
      )
    );
    // 감춰졌을 뿐 스코프는 그대로 워크스페이스다.
    expect(state.activeParams.at(-1)).toEqual({
      scope: "workspace",
      workspaceId: WORKSPACE_ID,
    });
  });

  it("side 모드에서는 버튼이 사라지고 패널이 감춰지지만 스트림은 유지된다", async () => {
    const { rerender, client } = renderChat(<NoteScope hidden={false} />);
    openPanel();
    expect(screen.getByTestId("personal-chat-panel").className).not.toContain(
      "hidden"
    );

    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider workspaceId={WORKSPACE_ID} workspaceName="헤이모아">
          <NoteScope hidden />
        </PersonalChatProvider>
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("personal-chat-panel").className).toContain(
        "hidden"
      )
    );
    // 감출 뿐 언마운트하지 않는다 — 끊으면 부분 응답이 저장되지 않아 답변이 통째로 사라진다.
    // 스코프가 그대로면 패널 key도 그대로다. 워크스페이스로 돌아갔다면 다시 마운트된 것이다.
    expect(state.activeParams.at(-1)).toEqual({
      scope: "note",
      noteId: NOTE_ID,
    });
    expect(screen.queryByRole("button", { name: "개인 챗봇 열기" })).toBeNull();
    expect(state.aborted).toBe(false);
  });

  it("워크스페이스에서 연 개인 챗봇은 노트 회의 중으로 새지 않는다", async () => {
    // open()은 감춤을 존중한다. 안 그러면 워크스페이스에서 한 번 열면 노트 회의 중에도
    // 공유 트레이 위에 개인 패널이 계속 뜬다.
    const { rerender, client } = renderChat();
    openPanel();
    expect(screen.getByTestId("personal-chat-panel").className).not.toContain(
      "hidden"
    );

    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider workspaceId={WORKSPACE_ID} workspaceName="헤이모아">
          <NoteScope hidden />
        </PersonalChatProvider>
      </QueryClientProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("personal-chat-panel").className).toContain(
        "hidden"
      )
    );
  });

  it("활성 세션 조회가 끝나기 전에는 보내지 않는다", () => {
    // 여기서 보내면 있는 대화를 못 보고 새로 만들어 기존 대화를 비활성으로 내린다.
    state.activeLoading = true;
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
    expect(screen.getByLabelText("메시지")).toHaveProperty("value", "정리해줘");
  });

  it("히스토리가 나중에 그 턴을 담아 오면 로컬 사본을 겹쳐 그리지 않는다", async () => {
    // 즉시 반영이 실패해 로컬 턴을 남겨 뒀는데, 히스토리가 스스로 성공하면 같은 턴이
    // 두 벌 그려진다.
    state.active = { chatId: CHAT_ID, scope: "workspace" };
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
        <PersonalChatProvider workspaceId={WORKSPACE_ID} workspaceName="헤이모아">
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
    state.active = { chatId: CHAT_ID, scope: "workspace" };
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

  it("승인은 204 뒤 스트림이 확정할 때까지 다시 눌리지 않는다", async () => {
    // 204는 접수일 뿐이다. 그 사이 다시 누르면 중복 결정이 나가고 404/409가 뜬다.
    state.active = { chatId: CHAT_ID, scope: "workspace" };
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

    state.releaseStream?.();
  });

  it("승인이 재시도 가능한 오류로 실패하면 잠금을 푼다", async () => {
    // 풀지 않으면 스트림이 닫힐 때까지(계약상 최대 300초) 버튼이 잠긴 채 남는다.
    state.active = { chatId: CHAT_ID, scope: "workspace" };
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

    state.releaseStream?.();
  });

  it("만료된 승인은 잠금을 풀지 않는다", async () => {
    // 카드가 죽었다 — 다시 눌러도 같은 404다.
    state.active = { chatId: CHAT_ID, scope: "workspace" };
    state.approvalStream = true;
    state.approvalError = {
      success: false,
      data: null,
      error: { code: "APPROVAL_NOT_FOUND", message: "만료되었습니다." },
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
        true
      )
    );

    state.releaseStream?.();
  });

  it("턴이 도는 동안에는 히스토리 조회를 켜지 않는다", async () => {
    // 켜면 로딩 스켈레톤이 흐르는 스레드를 덮고, server가 스트림 전에 저장한
    // USER 메시지가 pendingUserMessage와 겹쳐 두 번 보인다.
    state.holdStream = true;
    renderChat();
    openPanel();
    fireEvent.change(screen.getByLabelText("메시지"), {
      target: { value: "정리해줘" },
    });
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

  it("없어진 세션(404)은 막다른 길이 아니라 빈 대화다", () => {
    // 다른 실패와 섞어 잠그면 유일한 복구 경로(새 대화)까지 막힌다.
    state.active = { chatId: CHAT_ID, scope: "workspace" };
    state.historyMissing = true;
    renderChat();
    openPanel();

    expect(screen.getByText("아직 시작된 대화가 없습니다.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
      "disabled",
      false
    );
    expect(screen.getByRole("button", { name: /새 대화/ })).toHaveProperty(
      "disabled",
      false
    );
  });

  it("턴이 도는 동안에는 노트를 떠나도 스코프가 바뀌지 않는다", async () => {
    // 스코프가 바뀌면 패널 key가 바뀌어 언마운트되고 흐르던 답변이 사라진다.
    state.active = { chatId: CHAT_ID, scope: "note" };
    const { rerender, client } = renderChat(<NoteScope hidden={false} />);
    openPanel();
    await waitFor(() =>
      expect(state.activeParams.at(-1)).toEqual({
        scope: "note",
        noteId: NOTE_ID,
      })
    );

    // 턴을 시작해 두고 노트를 떠난다.
    fireEvent.change(screen.getByLabelText("메시지"), {
      target: { value: "정리해줘" },
    });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    rerender(
      <QueryClientProvider client={client}>
        <PersonalChatProvider workspaceId={WORKSPACE_ID} workspaceName="헤이모아">
          {null}
        </PersonalChatProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(state.streamCalls).toHaveLength(1));
    expect(state.aborted).toBe(false);
  });

  it("조회가 실패하면 새 대화 버튼도 막는다", () => {
    // 못 본 활성 세션을 새 대화가 비활성으로 내리는 것을 막는다.
    state.activeFails = true;
    renderChat();
    openPanel();

    expect(screen.getByRole("button", { name: /새 대화/ })).toHaveProperty(
      "disabled",
      true
    );
  });
});
