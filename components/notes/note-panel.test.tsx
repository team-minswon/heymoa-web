import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { NotePanel } from "@/components/notes/note-panel";
import {
  RecordingProvider,
  type RecordingRuntime,
} from "@/components/transcription/recording-provider";

const useGetProject = vi.hoisted(() => vi.fn());
const noteRefetch = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  userId: "u1",
}));
/** 로컬 provider 소유권을 상태 행렬에서 바꿔 볼 수 있게 둔다. */
const recordingState = vi.hoisted(() => ({
  activeNoteId: null as string | null,
  phase: "idle" as string,
  sessionStatus: null as "ACTIVE" | "READY" | "INTERRUPTED" | null,
}));

vi.mock("@/components/transcription/recording-provider", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/transcription/recording-provider")
  >("@/components/transcription/recording-provider");
  return {
    ...actual,
    useRecording: () => ({
      ...actual.useRecording(),
      ...(recordingState.activeNoteId
        ? {
            activeNoteId: recordingState.activeNoteId,
            phase: recordingState.phase,
            ...(recordingState.sessionStatus
              ? {
                  session: {
                    noteId: recordingState.activeNoteId,
                    status: recordingState.sessionStatus,
                  },
                }
              : { session: null }),
          }
        : {}),
    }),
  };
});
const noteState = vi.hoisted(() => ({
  /** 세팅하면 `useGetNote` 반환을 통째로 대신한다 — 로딩·실패를 그리려고 쓴다. */
  query: null as {
    data?: unknown;
    isError?: boolean;
    refetch?: () => void;
  } | null,
  value: {
    noteId: "01K0000000002",
    title: "주간 제품 회의",
    projectId: "01K0000000001",
    meetingStatus: "IN_PROGRESS" as string,
    meetingStartedBy: { userId: "u1", name: "테스트 유저" } as unknown,
    meetingStartedAt: "2026-07-29T00:00:00Z",
    recordedDurationMs: 60_000,
    activeSessionStartedAt: "2026-07-29T00:01:00Z" as string | null,
  },
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({
    user: { userId: authState.userId, name: "테스트 유저" },
  }),
}));
vi.mock("@/components/notes/note-details", () => ({
  NoteDetails: () => <p>정보 내용</p>,
  NoteDetailsSkeleton: () => <p>정보 로딩</p>,
}));
vi.mock("@/components/notes/transcript-view", () => ({
  TranscriptView: ({ phase }: { phase?: string }) => (
    <p data-testid="transcript-view" data-phase={phase}>
      전사 내용
    </p>
  ),
}));
vi.mock("@/components/notes/shared-chat-panel", () => ({
  SharedChatPanel: ({
    phase,
    onTurnActiveChange,
  }: {
    phase: string;
    onTurnActiveChange?: (active: boolean) => void;
  }) => (
    <div data-testid="shared-chat-panel" data-phase={phase}>
      <input aria-label="공유 질문" defaultValue="" />
      <button type="button" onClick={() => onTurnActiveChange?.(true)}>
        턴 시작
      </button>
      <button type="button" onClick={() => onTurnActiveChange?.(false)}>
        턴 끝
      </button>
    </div>
  ),
}));
vi.mock("@/components/notes/note-archive", () => ({
  NoteArchive: () => <div data-testid="note-archive" />,
}));
vi.mock("@/components/notes/note-summary", () => ({
  NoteSummary: ({ isEnded }: { isEnded: boolean }) => (
    <div data-testid="note-summary" data-ended={isEnded} />
  ),
}));
vi.mock("@/components/notes/meeting-end-dialog", () => ({
  MeetingEndDialog: ({
    open,
    onEnded,
  }: {
    open: boolean;
    onEnded?: () => void;
  }) =>
    open ? (
      <button type="button" onClick={onEnded}>
        종료 확인
      </button>
    ) : null,
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  getGetNoteQueryKey: (noteId: string) => [`/v1/notes/${noteId}`],
  useGetNote: () =>
    noteState.query ?? {
      data: { status: 200, data: { success: true, data: noteState.value } },
    },
}));
vi.mock("@/lib/api/generated/projects/projects", () => ({
  useGetProject: (...args: unknown[]) => {
    useGetProject(...args);
    return {
      data: {
        status: 200,
        data: {
          success: true,
          data: {
            projectId: "01K0000000001",
            name: "주간",
          },
        },
      },
    };
  },
}));

const runtime: RecordingRuntime = {
  createSession: (options) => ({
    requestPermission: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(async (sessionId: string) =>
      options.onEvent({ type: "connected", sessionId })
    ),
    commit: vi.fn(),
    stop: vi.fn(async () =>
      options.onEvent({ type: "completed", sessionId: "01K0000000010" })
    ),
    reconcile: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  }),
};

function renderNotePanel(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrap = (node: ReactNode) => (
    <QueryClientProvider client={client}>
      <RecordingProvider
        runtime={runtime}
        enablePolling={false}
        api={{
          startSession: vi.fn(async (noteId) => ({
            sessionId: "01K0000000010",
            noteId,
            status: "READY" as const,
            readyExpiresAt: "2026-07-11T00:10:00Z",
            startedAt: null,
            endedAt: null,
            endReason: null,
          })),
        }}
      >
        {node}
      </RecordingProvider>
    </QueryClientProvider>
  );

  const view = render(wrap(ui));
  return {
    ...view,
    rerenderNote: (node: ReactNode) => view.rerender(wrap(node)),
  };
}

describe("NotePanel", () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });
  afterEach(() => {
    cleanup();
    noteRefetch.mockReset();
    authState.userId = "u1";
    recordingState.activeNoteId = null;
    recordingState.phase = "idle";
    recordingState.sessionStatus = null;
    noteState.query = null;
    noteState.value = {
      noteId: "01K0000000002",
      title: "주간 제품 회의",
      projectId: "01K0000000001",
      meetingStatus: "IN_PROGRESS",
      meetingStartedBy: { userId: "u1", name: "테스트 유저" },
      meetingStartedAt: "2026-07-29T00:00:00Z",
      recordedDurationMs: 60_000,
      activeSessionStartedAt: "2026-07-29T00:01:00Z",
    };
  });
  it("changes only the controlled tab", () => {
    const onTabChange = vi.fn();
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="transcript"
        onTabChange={onTabChange}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("tab", { name: "전사" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "회의 정보" }));
    expect(onTabChange).toHaveBeenCalledWith("details");
    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(screen.getByText("주간")).toBeInTheDocument();
    expect(useGetProject).toHaveBeenCalledWith(
      "01K0000000000",
      "01K0000000001",
      { query: { enabled: true } }
    );
  });

  it("shows five microphone bars in the compact recording dock", async () => {
    noteState.value.meetingStatus = "NOT_STARTED";
    noteState.value.meetingStartedBy = null;
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "회의 시작" }));
    await waitFor(() =>
      expect(
        screen.getByTestId("note-recording-waveform").children
      ).toHaveLength(5)
    );
    expect(
      screen.queryByRole("button", { name: "구간 확정" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /일시 정지|재개/ })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "중지" })).toBeEnabled();
  });

  it("blocks a second note from starting while another note records", async () => {
    noteState.value.meetingStatus = "NOT_STARTED";
    noteState.value.meetingStartedBy = null;
    renderNotePanel(
      <>
        <NotePanel
          workspaceId="01K0000000000"
          noteId="01K0000000002"
          view="full"
          tab="transcript"
          onTabChange={vi.fn()}
          onClose={vi.fn()}
        />
        <NotePanel
          workspaceId="01K0000000000"
          noteId="01K0000000003"
          view="full"
          tab="transcript"
          onTabChange={vi.fn()}
          onClose={vi.fn()}
        />
      </>
    );

    fireEvent.click(screen.getAllByRole("button", { name: "회의 시작" })[0]);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "다른 회의에서 녹음 중" })
      ).toBeDisabled()
    );
  });

  it("full + 활성이면 공유 챗봇 트레이가 선다", () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(
      screen.getByTestId("shared-chat-panel").getAttribute("data-phase")
    ).toBe("active");
  });

  it("full + 중지에서도 기존 공유 챗봇 기록을 읽을 수 있다", () => {
    noteState.value.meetingStatus = "PAUSED";
    noteState.value.activeSessionStartedAt = null;

    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("shared-chat-panel")).toHaveAttribute(
      "data-phase",
      "paused"
    );
  });

  it("짧은 landscape에서는 14rem 높이 트레이 대신 bounded side column을 쓴다", () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const tray = screen.getByTestId("shared-chat-panel").parentElement;
    const root = tray?.parentElement;

    expect(root).toHaveClass(
      "flex-col",
      "max-lg:landscape:flex-row",
      "lg:flex-row"
    );
    expect(tray).toHaveClass(
      "h-[clamp(14rem,36dvh,18rem)]",
      "w-full",
      "max-lg:landscape:h-full",
      "max-lg:landscape:w-[min(22rem,42vw)]",
      "max-lg:landscape:border-l",
      "max-lg:landscape:border-t-0",
      "lg:h-full",
      "lg:w-[464px]"
    );
  });

  it("passes the existing meeting phase to the transcript", () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("transcript-view")).toHaveAttribute(
      "data-phase",
      "active"
    );
  });

  it("full + 종료면 트레이가 사라진다 — 우측은 개인 챗봇 몫", () => {
    noteState.value.meetingStatus = "ENDED";
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByTestId("shared-chat-panel")).toBeNull();
  });

  it("답변이 흐르는 중 회의가 종료돼도 트레이를 걷지 않고, 턴이 끝나면 아카이브로 넘긴다", () => {
    const el = (
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const { rerenderNote } = renderNotePanel(el);
    expect(screen.getByTestId("shared-chat-panel")).toBeTruthy();

    // 턴이 흐른다.
    fireEvent.click(screen.getByRole("button", { name: "턴 시작" }));
    // 그 사이 다른 멤버가 회의를 끝낸다(폴링이 ENDED를 올린다).
    noteState.value.meetingStatus = "ENDED";
    rerenderNote(el);
    // 트레이는 아직 있고 아카이브는 아직 없다 — 언마운트하면 흐르던 답변이 사라진다.
    expect(screen.getByTestId("shared-chat-panel")).toBeTruthy();
    expect(screen.queryByTestId("note-archive")).toBeNull();

    // 턴이 끝난다.
    fireEvent.click(screen.getByRole("button", { name: "턴 끝" }));
    expect(screen.queryByTestId("shared-chat-panel")).toBeNull();
    expect(screen.getByTestId("note-archive")).toBeTruthy();
  });

  it("side + 활성은 전사·챗봇·회의 정보 탭을 두고 챗봇을 탭 패널 안에 둔다", () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="chat"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getAllByRole("tab").map((item) => item.textContent)).toEqual([
      "전사",
      "챗봇",
      "회의 정보",
    ]);
    expect(
      screen
        .getByTestId("shared-chat-panel")
        .closest('[data-slot="tabs-content"]')
    ).toBeInTheDocument();
  });

  it("side + 중지는 챗봇 기록 탭을 유지한다", () => {
    noteState.value.meetingStatus = "PAUSED";
    noteState.value.activeSessionStartedAt = null;

    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="chat"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("tab", { name: "챗봇" })).toBeInTheDocument();
    expect(screen.getByTestId("shared-chat-panel")).toHaveAttribute(
      "data-phase",
      "paused"
    );
  });

  it.each(["full", "side"] as const)(
    "%s는 최초 시작을 절대 시각 time 요소로 보인다",
    (view) => {
      renderNotePanel(
        <NotePanel
          workspaceId="01K0000000000"
          noteId="01K0000000002"
          view={view}
          tab="transcript"
          onTabChange={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const started = screen.getByText(/7월 29일.*시작/);
      expect(started.tagName).toBe("TIME");
      expect(started).toHaveAttribute("datetime", "2026-07-29T00:00:00Z");
    }
  );

  it("side 전사만 읽을 때는 공유 챗봇을 마운트하지 않는다", () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByTestId("shared-chat-panel")).toBeNull();
  });

  it("side 챗봇은 다른 탭으로 이동해도 같은 패널을 keepMounted한다", () => {
    const panel = (tab: "chat" | "transcript") => (
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab={tab}
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const { rerenderNote } = renderNotePanel(panel("chat"));
    const sharedPanel = screen.getByTestId("shared-chat-panel");

    fireEvent.click(screen.getByRole("button", { name: "턴 시작" }));
    rerenderNote(panel("transcript"));

    expect(screen.getByTestId("shared-chat-panel")).toBe(sharedPanel);
    expect(sharedPanel.closest('[data-slot="tabs-content"]')).not.toBeVisible();
  });

  it("side 챗봇의 무턴 초안은 전사 탭으로 이동해도 같은 패널에 남는다", () => {
    const panel = (tab: "chat" | "transcript") => (
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab={tab}
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const { rerenderNote } = renderNotePanel(panel("chat"));
    const sharedPanel = screen.getByTestId("shared-chat-panel");
    const draft = screen.getByRole("textbox", { name: "공유 질문" });
    fireEvent.change(draft, { target: { value: "남겨 둘 초안" } });

    rerenderNote(panel("transcript"));

    expect(screen.getByTestId("shared-chat-panel")).toBe(sharedPanel);
    expect(sharedPanel.querySelector('[aria-label="공유 질문"]')).toHaveValue(
      "남겨 둘 초안"
    );
    expect(sharedPanel.closest('[data-slot="tabs-content"]')).not.toBeVisible();
  });

  it("side 공유 답변이 흐르는 동안 full 확장을 잠근다", () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="chat"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        onExpand={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "턴 시작" }));

    expect(
      screen.getByRole("button", {
        name: "답변이 끝나면 확장할 수 있습니다",
      })
    ).toBeDisabled();
  });

  it.each(["chat", "summary"] as const)(
    "side + unknown 직링크 %s는 대응 탭 패널을 유지한다",
    (tab) => {
      noteState.query = { data: undefined, isError: false };

      renderNotePanel(
        <NotePanel
          workspaceId="01K0000000000"
          noteId="01K0000000002"
          view="side"
          tab={tab}
          onTabChange={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(
        screen.getByRole("tab", { name: tab === "chat" ? "챗봇" : "요약" })
      ).toBeInTheDocument();
      expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    }
  );

  it("full 모드는 요약 탭을 두되, 회의 조작은 상단바로 올려 패널에 두지 않는다", () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="summary"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("tab", { name: "요약" })).toBeTruthy();
    expect(screen.getByTestId("note-summary")).toBeTruthy();
    // full의 상태·종료·닫기는 셸 상단바가 맡는다.
    expect(screen.queryByTestId("meeting-controls")).toBeNull();
    expect(screen.queryByRole("button", { name: "회의 닫기" })).toBeNull();
  });

  it("side + 종료는 기록·요약·회의 정보 탭과 아카이브를 보인다", () => {
    noteState.value.meetingStatus = "ENDED";
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getAllByRole("tab").map((item) => item.textContent)).toEqual([
      "기록",
      "요약",
      "회의 정보",
    ]);
    expect(screen.getByTestId("note-archive")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "챗봇" })).toBeNull();
  });

  it("side 헤더는 회의 맥락을 보이고 종료 성공 뒤 요약 탭으로 이동한다", () => {
    const onTabChange = vi.fn();
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="transcript"
        onTabChange={onTabChange}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("기록 중")).toBeInTheDocument();
    expect(screen.getByText("테스트 유저")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "회의 상태 및 제어" })
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "창 제어" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "회의 닫기" })).toHaveClass(
      "size-11"
    );
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    fireEvent.click(screen.getByRole("button", { name: "종료 확인" }));

    expect(onTabChange).toHaveBeenCalledWith("summary");
  });

  it("side 좁은 헤더는 제목과 상태·창 제어 그룹을 쌓고 44px 버튼을 유지한다", () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        onExpand={vi.fn()}
      />
    );

    const title = screen.getByRole("heading", { name: "주간 제품 회의" });
    const headerLayout = title.parentElement?.parentElement;
    const meetingGroup = screen.getByRole("group", {
      name: "회의 상태 및 제어",
    });
    const windowGroup = screen.getByRole("group", { name: "창 제어" });
    const controlLayout = windowGroup.parentElement;

    expect(headerLayout).toHaveClass(
      "flex-col",
      "sm:flex-row",
      "sm:items-start"
    );
    expect(controlLayout).toHaveClass(
      "w-full",
      "flex-wrap",
      "justify-between",
      "sm:w-auto"
    );
    expect(meetingGroup).toHaveClass("flex-wrap");
    expect(
      screen.getByRole("button", { name: "전체 화면으로 보기" })
    ).toHaveClass("size-11");
    expect(screen.getByRole("button", { name: "회의 닫기" })).toHaveClass(
      "size-11"
    );
  });

  it("side 뷰어가 읽는 중 회의가 끝나면 안내 뒤 아카이브를 연다", () => {
    authState.userId = "u2";
    const el = (
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const { rerenderNote } = renderNotePanel(el);

    noteState.value.meetingStatus = "ENDED";
    rerenderNote(el);

    expect(
      screen.getByRole("region", { name: "회의 종료 안내" })
    ).toHaveTextContent("회의가 종료되었습니다");
    expect(screen.getByTestId("transcript-view")).toBeInTheDocument();
    expect(screen.queryByTestId("note-archive")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "기록과 요약 보기" }));

    expect(screen.queryByTestId("transcript-view")).toBeNull();
    expect(screen.getByTestId("note-archive")).toBeInTheDocument();
  });

  it("side의 공유 턴 중 회의가 끝나도 기록 탭 뒤에서 패널을 보존한다", () => {
    authState.userId = "u2";
    const onTabChange = vi.fn();
    const panel = (tab: "chat" | "transcript") => (
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab={tab}
        onTabChange={onTabChange}
        onClose={vi.fn()}
      />
    );
    const { rerenderNote } = renderNotePanel(panel("chat"));

    fireEvent.click(screen.getByRole("button", { name: "턴 시작" }));
    noteState.value.meetingStatus = "ENDED";
    // NoteView가 ended + chat을 즉시 transcript로 정규화한다. 답변 패널은 숨겨도
    // 턴이 끝날 때까지 마운트해 부분 응답을 잃지 않는다.
    rerenderNote(panel("transcript"));

    expect(screen.getByTestId("shared-chat-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("note-archive")).toBeNull();
    expect(
      screen.getByRole("region", { name: "회의 종료 안내" })
    ).toHaveTextContent("회의가 종료되었습니다");
    fireEvent.click(screen.getByRole("button", { name: "기록과 요약 보기" }));
    expect(
      screen.getByRole("button", { name: "답변이 끝나면 이동합니다" })
    ).toBeDisabled();

    fireEvent.click(screen.getByText("턴 끝"));

    expect(onTabChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "회의 종료 안내" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "챗봇" })).toBeNull();
    expect(screen.getByTestId("note-archive")).toBeInTheDocument();
  });

  it("side 공유 턴·승인 대기 중 회의가 끝나도 챗봇 탭과 패널에 접근한다", () => {
    authState.userId = "u2";
    const panel = (
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="chat"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const { rerenderNote } = renderNotePanel(panel);

    fireEvent.click(screen.getByRole("button", { name: "턴 시작" }));
    noteState.value.meetingStatus = "ENDED";
    rerenderNote(panel);

    expect(screen.getByRole("tab", { name: "챗봇" })).toBeInTheDocument();
    expect(screen.getByTestId("shared-chat-panel")).toBeVisible();
    expect(screen.getByTestId("shared-chat-panel")).toHaveAttribute(
      "data-phase",
      "ended"
    );
  });

  it.each(["chat", "summary"] as const)(
    "side 조회가 실패하면 이유와 재시도를 보이고 %s 지속 UI는 숨긴다",
    (tab) => {
      noteState.query = {
        data: undefined,
        isError: true,
        refetch: noteRefetch,
      };

      renderNotePanel(
        <NotePanel
          workspaceId="01K0000000000"
          noteId="01K0000000002"
          view="side"
          tab={tab}
          onTabChange={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "회의 상태를 확인하지 못했습니다."
      );
      fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
      expect(noteRefetch).toHaveBeenCalledOnce();
      expect(screen.queryByRole("tabpanel")).toBeNull();
    }
  );

  it("side + 미시작은 전사·회의 정보와 회의 시작을 보인다", () => {
    noteState.value.meetingStatus = "NOT_STARTED";
    noteState.value.meetingStartedBy = null;
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getAllByRole("tab").map((item) => item.textContent)).toEqual([
      "전사",
      "회의 정보",
    ]);
    expect(
      screen.getByRole("button", { name: "회의 시작" })
    ).toBeInTheDocument();
  });

  function renderDock(view: "side" | "full") {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view={view}
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
  }

  describe.each(["full", "side"] as const)("%s 회의 제어 행렬", (view) => {
    it("NOT_STARTED는 모든 멤버에게 회의 시작 독을 보인다", () => {
      authState.userId = "u2";
      noteState.value.meetingStatus = "NOT_STARTED";
      noteState.value.meetingStartedBy = null;

      renderDock(view);

      expect(
        screen.getByRole("button", { name: "회의 시작" })
      ).toBeInTheDocument();
    });

    it("IN_PROGRESS 로컬 시작자는 중지 독을 본다", () => {
      recordingState.activeNoteId = "01K0000000002";
      recordingState.phase = "recording";

      renderDock(view);

      expect(screen.getByRole("button", { name: "중지" })).toBeEnabled();
      if (view === "side") {
        expect(
          screen.getByRole("button", { name: "회의 종료" })
        ).toBeInTheDocument();
      }
    });

    it("IN_PROGRESS 원격 시작자는 거짓 시작 대신 다른 탭 안내를 본다", () => {
      renderDock(view);

      expect(
        screen.getByText("다른 탭·기기에서 기록 중입니다.")
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "회의 시작" })).toBeNull();
      expect(screen.queryByRole("button", { name: "재개" })).toBeNull();
    });

    it("IN_PROGRESS의 세션 없는 로컬 실패도 원격 기록으로 취급한다", () => {
      recordingState.activeNoteId = "01K0000000002";
      recordingState.phase = "failed";

      renderDock(view);

      expect(
        screen.getByText("다른 탭·기기에서 기록 중입니다.")
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
    });

    it("IN_PROGRESS의 실패한 ACTIVE 세션은 원격 기록으로 취급한다", () => {
      recordingState.activeNoteId = "01K0000000002";
      recordingState.phase = "failed";
      recordingState.sessionStatus = "ACTIVE";

      renderDock(view);

      expect(
        screen.getByText("다른 탭·기기에서 기록 중입니다.")
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
    });

    it("IN_PROGRESS라도 죽음이 확인된 실패는 차단 대신 다시 시도를 연다", () => {
      // failed+ACTIVE(서버 상태 미확인)·failed+세션 없음은 위에서 원격 기록으로 차단하지만,
      // 폴링이 INTERRUPTED를 확인한 실패까지 "다른 탭·기기에서 기록 중"으로 가리면
      // 아무도 기록하지 않는데 그렇게 읽힌다.
      recordingState.activeNoteId = "01K0000000002";
      recordingState.phase = "failed";
      recordingState.sessionStatus = "INTERRUPTED";

      renderDock(view);

      expect(screen.queryByText("다른 탭·기기에서 기록 중입니다.")).toBeNull();
      expect(
        screen.getByRole("button", { name: "다시 시도" })
      ).toBeInTheDocument();
    });

    it("IN_PROGRESS 뷰어에게는 독이 없다", () => {
      authState.userId = "u2";

      renderDock(view);

      expect(screen.queryByLabelText("녹음 제어")).toBeNull();
    });

    it("PAUSED 시작자는 재개 독을 본다", () => {
      noteState.value.meetingStatus = "PAUSED";
      noteState.value.activeSessionStartedAt = null;

      renderDock(view);

      expect(screen.getByRole("button", { name: "재개" })).toBeInTheDocument();
      if (view === "side") {
        expect(
          screen.getByRole("button", { name: "회의 종료" })
        ).toBeInTheDocument();
      }
    });

    it.each(["NOT_STARTED", "PAUSED"] as const)(
      "%s의 세션 없는 권한 실패는 다시 시도할 수 있다",
      (meetingStatus) => {
        noteState.value.meetingStatus = meetingStatus;
        noteState.value.meetingStartedBy =
          meetingStatus === "NOT_STARTED"
            ? null
            : { userId: "u1", name: "테스트 유저" };
        noteState.value.activeSessionStartedAt = null;
        recordingState.activeNoteId = "01K0000000002";
        recordingState.phase = "failed";

        renderDock(view);

        expect(screen.getByRole("button", { name: "다시 시도" })).toBeEnabled();
        expect(
          screen.queryByText("다른 탭·기기에서 기록 중입니다.")
        ).toBeNull();
      }
    );

    it("ENDED는 독 없이 요약 탭을 보인다", () => {
      noteState.value.meetingStatus = "ENDED";
      noteState.value.activeSessionStartedAt = null;

      renderDock(view);

      expect(screen.queryByLabelText("녹음 제어")).toBeNull();
      expect(screen.getByRole("tab", { name: "요약" })).toBeInTheDocument();
    });
  });

  describe("녹음 시작 게이트", () => {
    function renderStartGate() {
      renderNotePanel(
        <NotePanel
          workspaceId="01K0000000000"
          noteId="01K0000000002"
          view="full"
          tab="transcript"
          onTabChange={vi.fn()}
          onClose={vi.fn()}
        />
      );
    }

    it("종료된 회의는 시작 버튼 자리에 이유가 선다", () => {
      noteState.value = { ...noteState.value, meetingStatus: "ENDED" };

      renderStartGate();

      expect(screen.queryByLabelText("녹음 제어")).toBeNull();
    });

    it("상태를 아직 모르면 독을 열지 않는다", () => {
      // 콜드 캐시·느린 응답. 소유자도 모르는 동안은 독 자체를 열지 않는다.
      noteState.query = { data: undefined, isError: false };

      renderStartGate();

      expect(screen.queryByLabelText("녹음 제어")).toBeNull();
      expect(screen.queryByRole("button", { name: "회의 시작" })).toBeNull();
    });

    it("full 조회 실패는 독 없이 지속 실패 이유와 재시도를 보인다", () => {
      noteState.query = {
        data: undefined,
        isError: true,
        refetch: noteRefetch,
      };

      renderStartGate();

      expect(screen.getByRole("alert")).toHaveTextContent(
        "회의 상태를 확인하지 못했습니다."
      );
      expect(
        screen.getByRole("button", { name: "다시 시도" })
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("녹음 제어")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
      expect(noteRefetch).toHaveBeenCalledOnce();
    });

    it("다른 사용자가 시작한 진행 중 회의에서는 독을 숨긴다", () => {
      authState.userId = "u2";

      renderStartGate();

      expect(screen.queryByLabelText("녹음 제어")).toBeNull();
      expect(screen.queryByRole("button", { name: "회의 시작" })).toBeNull();
    });

    it("미시작 회의에서는 독을 유지한다", () => {
      noteState.value.meetingStatus = "NOT_STARTED";
      noteState.value.meetingStartedBy = null;

      renderStartGate();

      expect(screen.getByLabelText("녹음 제어")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "회의 시작" })
      ).toBeInTheDocument();
    });

    it("좁은 화면에서는 독을 본문 아래 레인에 두고 desktop에서만 띄운다", () => {
      noteState.value.meetingStatus = "NOT_STARTED";
      noteState.value.meetingStartedBy = null;

      renderStartGate();

      const dock = screen.getByLabelText("녹음 제어");
      const lane = dock.parentElement?.parentElement;

      expect(lane).toHaveClass("shrink-0", "lg:absolute", "lg:bottom-6");
      expect(lane).not.toHaveClass("absolute");
    });
  });

  it("뷰어가 읽는 중 회의가 끝나면 안내 뒤 명시적으로 아카이브를 연다", () => {
    authState.userId = "u2";
    const el = (
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const { rerenderNote } = renderNotePanel(el);

    noteState.value.meetingStatus = "ENDED";
    rerenderNote(el);

    expect(
      screen.getByRole("region", { name: "회의 종료 안내" })
    ).toHaveTextContent("회의가 종료되었습니다");
    expect(screen.getByTestId("transcript-view")).toBeInTheDocument();
    expect(screen.queryByTestId("note-archive")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "기록과 요약 보기" }));

    expect(screen.queryByTestId("transcript-view")).toBeNull();
    expect(screen.getByTestId("note-archive")).toBeInTheDocument();
  });

  it("흐르는 답변 중 아카이브를 요청하면 이동 대기를 알린 뒤 턴 종료 후 연다", () => {
    authState.userId = "u2";
    const el = (
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const { rerenderNote } = renderNotePanel(el);

    fireEvent.click(screen.getByRole("button", { name: "턴 시작" }));
    noteState.value.meetingStatus = "ENDED";
    rerenderNote(el);
    fireEvent.click(screen.getByRole("button", { name: "기록과 요약 보기" }));

    expect(
      screen.getByRole("region", { name: "회의 종료 안내" })
    ).toHaveTextContent("회의가 종료되었습니다");
    expect(
      screen.getByRole("button", { name: "답변이 끝나면 이동합니다" })
    ).toBeDisabled();
    expect(screen.getByTestId("transcript-view")).toBeInTheDocument();
    expect(screen.queryByTestId("note-archive")).toBeNull();
    expect(screen.getByTestId("shared-chat-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "턴 끝" }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("note-archive")).toBeInTheDocument();
    expect(screen.queryByTestId("shared-chat-panel")).toBeNull();
  });

  it("종료된 회의를 처음 열면 바로 아카이브를 보인다", () => {
    authState.userId = "u2";
    noteState.value.meetingStatus = "ENDED";

    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText("회의가 종료되었습니다")).toBeNull();
    expect(screen.getByTestId("note-archive")).toBeInTheDocument();
  });
});
