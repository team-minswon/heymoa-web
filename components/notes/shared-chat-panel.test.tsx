import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SharedChatPanel } from "@/components/notes/shared-chat-panel";
import type { SharedChatPhase } from "@/lib/notes/meeting-state";

const NOTE_ID = "01K0000000002";
const CHAT_ID = "01K0000000003";

const openPersonalMock = vi.hoisted(() => vi.fn());
vi.mock("@/components/chat/personal-chat", () => ({
  usePersonalChat: () => ({ open: openPersonalMock }),
}));
const realtime = vi.hoisted(() => ({
  chat: {
    stream: {
      phase: "idle",
      messageId: null,
      text: "",
      content: null as string | null,
      records: [],
      pendingApproval: null,
      error: null,
    },
    text: "",
    interrupted: false,
    locked: null as boolean | null,
  },
}));
vi.mock("@/components/notes/note-realtime-provider", () => ({
  useNoteRealtime: () => realtime,
}));

const state = vi.hoisted(() => ({
  messages: [] as unknown[],
  lock: {
    locked: false,
    lockedBy: null as string | null,
    pendingApproval: null as {
      approvalId: string;
      tool: string;
      summary: string | null;
    } | null,
  },
  historyFails: false,
  streamFails: false,
  streamCalls: [] as { url: string; body: unknown }[],
  queryOptions: [] as Array<{
    query: { refetchInterval: (query: unknown) => number | false };
  }>,
  approveMock: vi.fn(),
}));

vi.mock("@/lib/api/generated/note-shared-chat/note-shared-chat", () => ({
  getSendNoteSharedChatMessageUrl: (noteId: string) =>
    `/v1/notes/${noteId}/chat/messages`,
  getGetNoteSharedChatMessagesQueryOptions: (noteId: string) => ({
    queryKey: ["shared", noteId],
    queryFn: () => ({
      status: 200,
      data: {
        success: true,
        data: { chatId: CHAT_ID, messages: state.messages, lock: state.lock },
      },
    }),
  }),
  useGetNoteSharedChatMessages: (
    _noteId: string,
    options: {
      query: { refetchInterval: (query: unknown) => number | false };
    }
  ) => {
    state.queryOptions.push(options);
    return {
      isLoading: false,
      isError: state.historyFails,
      refetch: vi.fn(),
      data: state.historyFails
        ? undefined
        : {
            status: 200,
            data: {
              success: true,
              data: {
                chatId: CHAT_ID,
                messages: state.messages,
                lock: state.lock,
              },
            },
          },
    };
  },
}));

vi.mock("@/lib/api/generated/agent-chat/agent-chat", () => ({
  useResolveToolApproval: () => ({
    mutate: (variables: unknown) => state.approveMock(variables),
    isPending: false,
  }),
}));

vi.mock("@/lib/api/sse", () => ({
  postEventStream: async function* (url: string, body: unknown) {
    state.streamCalls.push({ url, body });
    if (state.streamFails) {
      throw {
        success: false,
        data: null,
        error: {
          code: "LLM_PROVIDER_ERROR",
          message: "응답 생성에 실패했습니다.",
        },
      };
    }
    yield {
      event: "message_start",
      data: JSON.stringify({ chatId: CHAT_ID, messageId: "m1" }),
    };
    yield { event: "token", data: JSON.stringify({ delta: "정리했" }) };
    yield {
      event: "message_end",
      data: JSON.stringify({ messageId: "m1", content: "정리했습니다." }),
    };
  },
}));

function renderPanel(phase: SharedChatPhase) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SharedChatPanel noteId={NOTE_ID} phase={phase} />
    </QueryClientProvider>
  );
}

describe("SharedChatPanel", () => {
  beforeEach(() => {
    state.messages = [];
    state.lock = { locked: false, lockedBy: null, pendingApproval: null };
    state.historyFails = false;
    state.streamFails = false;
    state.streamCalls = [];
    state.queryOptions = [];
    realtime.chat = {
      stream: {
        phase: "idle",
        messageId: null,
        text: "",
        content: null,
        records: [],
        pendingApproval: null,
        error: null,
      },
      text: "",
      interrupted: false,
      locked: null,
    };
    openPersonalMock.mockReset();
    state.approveMock.mockReset();
  });

  afterEach(cleanup);

  it("활성 상태에서 전송하면 스트림을 열고 히스토리를 반영한다", async () => {
    renderPanel("active");
    fireEvent.change(screen.getByLabelText("메시지"), {
      target: { value: "정리해줘" },
    });
    // 스트림이 끝난 뒤 히스토리(폴링 캐시)가 그 턴을 담아 온다 — 훅과 refresh가 같은 값을 준다.
    state.messages = [
      {
        messageId: "u1",
        createdAt: "2026-07-24T00:00:00Z",
        role: "USER",
        content: "정리해줘",
        authorName: "테스트 유저",
        toolEvent: null,
      },
      {
        messageId: "a1",
        createdAt: "2026-07-24T00:00:01Z",
        role: "ASSISTANT",
        content: "정리했습니다.",
        authorName: null,
        toolEvent: null,
      },
    ];
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() =>
      expect(state.streamCalls).toEqual([
        {
          url: `/v1/notes/${NOTE_ID}/chat/messages`,
          body: { message: "정리해줘" },
        },
      ])
    );
    // 정상 종료 후 스트림이 비워지고 히스토리 한 벌만 남는다.
    await waitFor(() => expect(screen.getByText("정리했습니다.")).toBeTruthy());
  });

  it("실패한 턴 뒤 폴링이 유저 메시지를 올려도 버블이 두 벌이 아니다", async () => {
    // 서버·목은 message_end가 없어도 USER를 저장한다. 폴링이 그걸 올리면 로컬
    // pendingUserMessage와 겹쳐 유저 버블이 두 벌 남는다.
    state.streamFails = true;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const el = (
      <QueryClientProvider client={client}>
        <SharedChatPanel noteId={NOTE_ID} phase="active" />
      </QueryClientProvider>
    );
    const { rerender } = render(el);

    fireEvent.change(screen.getByLabelText("메시지"), {
      target: { value: "정리해줘" },
    });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    // 실패 안내가 뜨고 방금 보낸 유저 버블은 남는다.
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText("정리해줘")).toBeTruthy();

    // 폴링이 그 USER를 히스토리에 올린다.
    state.messages = [
      {
        messageId: "u1",
        createdAt: "2026-07-24T00:00:00Z",
        role: "USER",
        content: "정리해줘",
        authorName: "테스트 유저",
        toolEvent: null,
      },
    ];
    rerender(el);

    await waitFor(() =>
      expect(screen.getAllByText("정리해줘")).toHaveLength(1)
    );
  });

  it("종료된 로컬 실패보다 새 원격 턴을 우선 표시한다", async () => {
    state.streamFails = true;
    const view = renderPanel("active");
    fireEvent.change(screen.getByLabelText("메시지"), {
      target: { value: "실패할 질문" },
    });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());

    realtime.chat.locked = false;
    view.rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <SharedChatPanel noteId={NOTE_ID} phase="active" />
      </QueryClientProvider>
    );
    realtime.chat.locked = true;
    realtime.chat.stream = {
      ...realtime.chat.stream,
      phase: "streaming",
      text: "다른 멤버의 새 답변",
    };
    view.rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <SharedChatPanel noteId={NOTE_ID} phase="active" />
      </QueryClientProvider>
    );

    expect(screen.getByText("다른 멤버의 새 답변")).toBeInTheDocument();
    expect(screen.queryByText("응답을 만들지 못했습니다")).toBeNull();

    realtime.chat.locked = false;
    realtime.chat.stream = {
      ...realtime.chat.stream,
      phase: "idle",
      text: "다른 멤버의 완료 답변",
      content: "다른 멤버의 완료 답변",
    };
    view.rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <SharedChatPanel noteId={NOTE_ID} phase="active" />
      </QueryClientProvider>
    );
    expect(screen.getByText("다른 멤버의 완료 답변")).toBeInTheDocument();
    expect(screen.queryByText("응답을 만들지 못했습니다")).toBeNull();
  });

  it("원격 중단 사본보다 송신자의 실제 로컬 실패를 우선 표시한다", async () => {
    realtime.chat.stream = {
      ...realtime.chat.stream,
      phase: "stalled",
      text: "원격 부분 답변",
    };
    state.streamFails = true;
    renderPanel("active");
    fireEvent.change(screen.getByLabelText("메시지"), {
      target: { value: "새 질문" },
    });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() =>
      expect(screen.getByText("응답을 만들지 못했습니다")).toBeInTheDocument()
    );
    expect(screen.queryByText("원격 부분 답변")).toBeNull();
  });

  it("active baseline은 30초, 원격 잠금 중에는 10초 safety poll로 복구한다", () => {
    realtime.chat.locked = true;
    renderPanel("active");

    const refetchInterval = state.queryOptions.at(-1)?.query.refetchInterval;
    expect(
      refetchInterval?.({
        state: { data: undefined },
      })
    ).toBe(10_000);

    realtime.chat.locked = false;
    expect(
      refetchInterval?.({
        state: { data: undefined },
      })
    ).toBe(30_000);
  });

  it("빈 대화의 관전자 잠금은 안내와 입력 중 표시만 보인다", () => {
    state.lock = { locked: true, lockedBy: "홍길동", pendingApproval: null };
    renderPanel("active");

    expect(screen.getByRole("alert")).toHaveTextContent("홍길동님이 입력 중");
    expect(screen.getAllByText(/홍길동님이 입력 중/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("typing-divider")).toBeTruthy();
    expect(screen.queryByText("아직 나눈 대화가 없습니다.")).toBeNull();
    expect(screen.queryByLabelText("메시지")).toBeNull();
    expect(screen.queryByRole("button", { name: "보내기" })).toBeNull();
  });

  it("관전자는 승인 대기를 폴링으로 보고 '입력 중'이 아니라 '승인 대기 중'을 보인다", () => {
    // 관전자는 스트림을 못 받으므로 lock.pendingApproval이 승인 대기의 유일한 신호다.
    state.lock = {
      locked: true,
      lockedBy: "홍길동",
      pendingApproval: {
        approvalId: "0K9GVJT2C4Q7F",
        tool: "linear.create_issue",
        summary: "Linear 이슈 'APP 버그' 생성",
      },
    };
    renderPanel("active");

    expect(
      screen.getAllByText(/홍길동님이 승인 대기 중/).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Linear 이슈 'APP 버그' 생성")).toBeTruthy();
    expect(screen.queryByText(/홍길동님이 입력 중/)).toBeNull();
    // jobCE — Pending Row + "승인 대기" Badge로 도구를 드러낸다.
    expect(screen.getByTestId("spectator-pending")).toBeTruthy();
    expect(screen.getByText("승인 대기")).toBeTruthy();
    expect(screen.getByText("linear.create_issue")).toBeTruthy();
  });

  it("히스토리를 못 읽으면 빈 대화 대신 오류를 보이고 전송을 막는다", () => {
    // 빈 배열로 접으면 잠금·대화 상태를 모른 채 전송이 열려 화면과 실제가 어긋난다.
    state.historyFails = true;
    renderPanel("active");
    expect(screen.getByRole("alert").textContent).toContain(
      "대화를 불러오지 못했습니다."
    );
    expect(screen.getByLabelText("메시지")).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "보내기" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("회의 미시작이면 녹음 시작 안내를 보인다", () => {
    renderPanel("not-started");
    expect(screen.getByText("아직 회의가 시작되지 않았습니다")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "보내기" })).toBeNull();
  });

  it("회의 상태를 모르면 입력 대신 확인 중 안내를 보인다", () => {
    renderPanel("unknown");
    expect(screen.getByText("회의 상태를 확인하는 중입니다")).toBeTruthy();
    expect(screen.queryByLabelText("메시지")).toBeNull();
    expect(screen.queryByRole("button", { name: "보내기" })).toBeNull();
  });
});
