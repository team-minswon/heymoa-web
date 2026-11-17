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
import type { ReactNode } from "react";
import type { NoteResponseDataParticipantsItem } from "@/lib/api/generated/models";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { NotePanel } from "@/components/notes/note-panel";
import { NoteRealtimeProvider } from "@/components/notes/note-realtime-provider";
import {
  RecordingProvider,
  useRecording,
  type RecordingRuntime,
} from "@/components/transcription/recording-provider";
import {
  beatRecording,
  recordingClaimOf,
} from "@/lib/transcription/recorder-lease";

const desktopApp = vi.hoisted(() => ({ value: false as boolean | null }));
vi.mock("@/lib/desktop/use-desktop-app", () => ({
  useDesktopApp: () => desktopApp.value,
}));

vi.mock("@/lib/notes/note-topic-client", () => ({
  NoteTopicClient: class {
    readonly connect = vi.fn();
    readonly close = vi.fn().mockResolvedValue(undefined);
  },
}));

const noteRefetch = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  userId: "u1",
}));
const recordingState = vi.hoisted(() => ({
  activeNoteId: null as string | null,
  phase: "idle" as string,
  sessionStatus: null as
    | "ACTIVE"
    | "READY"
    | "INTERRUPTED"
    | "COMPLETED"
    | null,
  sessionStartedAt: null as string | null,
  connectionNotice: null as
    | import("@/lib/transcription/realtime-session").ConnectionNotice
    | null,
  buffer: null as
    | import("@/lib/transcription/realtime-session").BufferState
    | null,
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
            connectionNotice: recordingState.connectionNotice,
            buffer: recordingState.buffer,
            ...(recordingState.sessionStatus
              ? {
                  session: {
                    noteId: recordingState.activeNoteId,
                    status: recordingState.sessionStatus,
                    startedAt: recordingState.sessionStartedAt,
                  },
                }
              : { session: null }),
          }
        : {}),
    }),
  };
});
const noteState = vi.hoisted(() => ({
  query: null as {
    data?: unknown;
    isError?: boolean;
    refetch?: () => void;
  } | null,
  value: {
    noteId: "01K0000000002",
    title: "주간 제품 회의",
    projectId: "01K0000000001",
    workspaceId: "01K0000000000" as string,
    projectName: "모바일 앱",
    meetingStatus: "IN_PROGRESS" as string,
    meetingStartedBy: { userId: "u1", name: "테스트 유저" } as unknown,
    meetingStartedAt: "2026-07-29T00:00:00Z",
    recordedDurationMs: 60_000,
    activeSessionStartedAt: "2026-07-29T00:01:00Z" as string | null,
    participants: [
      {
        participantId: "01K00000000P1",
        userId: "u1",
        guestId: null,
        name: "테스트 유저",
        email: "test@heymoa.com",
        image: null,
      },
      {
        participantId: "01K00000000P2",
        userId: "u2",
        guestId: null,
        name: "김서연",
        email: "seoyeon@heymoa.com",
        image: null,
      },
    ] as NoteResponseDataParticipantsItem[],
  },
}));

const admin = vi.hoisted(() => ({ value: true }));
vi.mock("@/lib/workspace/use-is-workspace-admin", () => ({
  useIsWorkspaceAdmin: () => admin.value,
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({
    user: { userId: authState.userId, name: "테스트 유저" },
  }),
  useAuthUserId: () => authState.userId,
}));
vi.mock("@/components/notes/note-details", () => ({
  NoteDetails: ({
    autoOpenParticipants,
    onParticipantsAutoOpened,
  }: {
    autoOpenParticipants?: boolean;
    onParticipantsAutoOpened?: () => void;
  }) => (
    <div
      data-testid="note-details"
      data-auto-open={String(!!autoOpenParticipants)}
    >
      <p>정보 내용</p>
      <button type="button" onClick={onParticipantsAutoOpened}>
        선택창 열림
      </button>
    </div>
  ),
  NoteDetailsSkeleton: () => <p>정보 로딩</p>,
}));
vi.mock("@/components/notes/transcript-view", () => ({
  TranscriptView: ({
    phase,
    focusSegmentId,
  }: {
    phase?: string;
    focusSegmentId?: string | null;
  }) => (
    <p
      data-testid="transcript-view"
      data-phase={phase}
      data-focus={focusSegmentId ?? ""}
    >
      전사 내용
    </p>
  ),
}));
const setRailSlot = vi.hoisted(() => vi.fn());
const personalChat = vi.hoisted(() => ({ isTurnActive: false }));
vi.mock("@/components/chat/personal-chat", () => ({
  usePersonalChat: () => ({ setRailSlot, ...personalChat }),
}));
vi.mock("@/components/notes/note-archive", () => ({
  NoteArchive: ({
    workspaceId,
    focusSegmentId,
    onFocusHandled,
  }: {
    workspaceId?: string;
    focusSegmentId?: string | null;
    onFocusHandled?: () => void;
  }) => (
    <div
      data-testid="note-archive"
      data-workspace={workspaceId ?? ""}
      data-focus={focusSegmentId ?? ""}
    >
      <button type="button" onClick={onFocusHandled}>
        점프 끝
      </button>
    </div>
  ),
}));
vi.mock("@/components/notes/review/review-tab", () => ({
  ReviewTab: ({ isEnded }: { isEnded: boolean }) => (
    <div data-testid="review-tab" data-ended={isEnded} />
  ),
}));
vi.mock("@/components/notes/meeting-end-dialog", () => ({
  MeetingEndDialog: ({
    open,
    onEnded,
    onEditParticipants,
  }: {
    open: boolean;
    onEnded?: () => void;
    onEditParticipants?: () => void;
  }) =>
    open ? (
      <>
        <button type="button" onClick={onEnded}>
          종료 확인
        </button>
        <button type="button" onClick={onEditParticipants}>
          참여자 지정하러 가기
        </button>
      </>
    ) : null,
}));
vi.mock("@/components/notes/meeting-end-feedback", () => ({
  END_FEEDBACK_DELAY_MS: 1000,
  claimEndFeedback: () => true,
  MeetingEndFeedback: ({ open }: { open: boolean }) =>
    open ? <div>회의 후 의견 창</div> : null,
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  getGetNoteQueryKey: (noteId: string) => [`/v1/notes/${noteId}`],
  getGetNotesQueryKey: (projectId: string) => [
    `/v1/projects/${projectId}/notes`,
  ],
  useDeleteNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetNoteAgendas: () => ({
    data: undefined,
    isPending: false,
    isError: false,
  }),
  useGetNote: () =>
    noteState.query ?? {
      data: { status: 200, data: { success: true, data: noteState.value } },
    },
}));

const runtime: RecordingRuntime = {
  createSession: (options) => ({
    requestPermission: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(async (sessionId: string) =>
      options.onEvent({
        type: "connected",
        sessionId,
        epoch: 1,
        durableThroughSeq: -1,
      })
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
            firstRecording: false,
            readyExpiresAt: "2026-07-11T00:10:00Z",
            startedAt: null,
            endedAt: null,
            endReason: null,
          })),
        }}
      >
        <NoteRealtimeProvider noteId="01K0000000002">
          {node}
        </NoteRealtimeProvider>
      </RecordingProvider>
    </QueryClientProvider>
  );

  const view = render(wrap(ui));
  return {
    ...view,
    rerenderNote: (node: ReactNode) => view.rerender(wrap(node)),
  };
}

function writeOtherTab(noteId: string, beatAt: number) {
  localStorage.setItem(
    "heymoa.transcription.recording:dead-tab",
    JSON.stringify({ noteId, clientInstanceId: "dead-tab", beatAt })
  );
}

function visibleByText(text: string | RegExp) {
  return screen
    .getAllByText(text)
    .filter((element) => !element.closest("[hidden]"));
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
    localStorage.clear();
    noteRefetch.mockReset();
    authState.userId = "u1";
    recordingState.activeNoteId = null;
    recordingState.phase = "idle";
    recordingState.sessionStatus = null;
    noteState.query = null;
    personalChat.isTurnActive = false;
    setRailSlot.mockReset();
    recordingState.sessionStartedAt = null;
    recordingState.connectionNotice = null;
    recordingState.buffer = null;
    noteState.value = {
      noteId: "01K0000000002",
      title: "주간 제품 회의",
      projectId: "01K0000000001",
      workspaceId: "01K0000000000",
      projectName: "모바일 앱",
      meetingStatus: "IN_PROGRESS",
      meetingStartedBy: { userId: "u1", name: "테스트 유저" },
      meetingStartedAt: "2026-07-29T00:00:00Z",
      recordedDurationMs: 60_000,
      activeSessionStartedAt: "2026-07-29T00:01:00Z",
      participants: [
        {
          participantId: "01K00000000P1",
          userId: "u1",
          guestId: null,
          name: "테스트 유저",
          email: "test@heymoa.com",
          image: null,
        },
        {
          participantId: "01K00000000P2",
          userId: "u2",
          guestId: null,
          name: "김서연",
          email: "seoyeon@heymoa.com",
          image: null,
        },
      ],
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

    expect(screen.getByRole("tab", { name: "스크립트" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "정보" }));
    expect(onTabChange).toHaveBeenCalledWith("details");
    expect(visibleByText("주간 제품 회의")).toHaveLength(1);
    expect(
      screen.queryByRole("heading", { name: "주간 제품 회의" })
    ).toBeNull();
  });

  it("녹음을 시작하면 그 노트가 속한 워크스페이스를 함께 기록한다", async () => {
    noteState.value.meetingStatus = "NOT_STARTED";
    noteState.value.meetingStartedBy = null;
    function RecordingProbe() {
      const { activeWorkspaceId, activeNoteId } = useRecording();
      return (
        <output data-testid="probe">{`${activeWorkspaceId}/${activeNoteId}`}</output>
      );
    }
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
        <RecordingProbe />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: "회의 시작" }));

    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent(
        "01K0000000000/01K0000000002"
      )
    );
  });

  it("다른 워크스페이스의 노트 URL이면 시작을 막고 이유를 보인다", () => {
    noteState.value.meetingStatus = "NOT_STARTED";
    noteState.value.meetingStartedBy = null;
    noteState.value.workspaceId = "01K0000000099";

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
      screen.queryByRole("button", { name: "회의 시작" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("이 노트는 이 워크스페이스에 없습니다.")
    ).toBeInTheDocument();
  });

  it("노트가 아직 안 왔으면 시작을 못 누른다", () => {
    noteState.value.meetingStatus = "NOT_STARTED";
    noteState.value.meetingStartedBy = null;
    noteState.query = { data: undefined, isError: false, refetch: noteRefetch };

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

    expect(screen.queryByRole("button", { name: "회의 시작" })).toBeNull();
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
    expect(screen.getByRole("button", { name: "일시정지" })).toBeEnabled();
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
        screen.getByRole("button", { name: "다른 노트에서 녹음 중" })
      ).toBeDisabled()
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

    const tray = screen.getByTestId("note-agent-rail");
    const root = tray.parentElement;

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
      "lg:w-[440px]"
    );
    expect(root).toHaveClass("lg:gap-2.5");
    expect(root?.className).not.toMatch(/(^|\s)gap-2\.5(\s|$)/);
    expect(tray).toHaveClass("rounded-panel", "shadow-e2");
  });

  it("전사와 레일 사이 선을 한 번만 그린다", () => {
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

    const rail = screen.getByTestId("note-agent-rail");
    expect(rail.className).not.toContain("lg:border-l");
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

  it("full 레일은 종료된 회의에도 상주한다", () => {
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
    expect(screen.getByTestId("note-agent-rail")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /레일 닫기|챗봇 닫기/ })
    ).toBeNull();
  });

  it("full 레일은 내 에이전트 하나이고, 서자마자 개인 챗봇에 자리를 넘긴다", () => {
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

    const rail = screen.getByTestId("note-agent-rail");
    expect(within(rail).queryByRole("tab")).toBeNull();
    expect(setRailSlot).toHaveBeenCalledWith(expect.any(HTMLElement));
  });

  it("레일을 접으면 통째로 빠지고, 위 막대 버튼이나 아래 알약으로 다시 연다", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "내 에이전트 접기" }));
    expect(screen.getByTestId("note-agent-rail")).toHaveClass("hidden");
    expect(setRailSlot).toHaveBeenLastCalledWith(expect.any(HTMLElement));

    fireEvent.click(
      screen.getByRole("button", { name: "이 회의에 대해 물어보기" })
    );
    expect(screen.getByTestId("note-agent-rail")).not.toHaveClass("hidden");

    fireEvent.click(screen.getByRole("button", { name: "내 에이전트 접기" }));
    fireEvent.click(screen.getByRole("button", { name: "내 에이전트 열기" }));
    expect(screen.getByTestId("note-agent-rail")).not.toHaveClass("hidden");
  });

  it("기본값에서는 좁은 화면에서만 레일을 접어 두고 그때만 여는 버튼을 세운다", () => {
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

    expect(screen.getByTestId("note-agent-rail")).toHaveClass("max-lg:hidden");
    expect(
      screen.getByRole("button", { name: "내 에이전트 열기" })
    ).toHaveClass("lg:hidden");
  });

  it("full 본문 탭은 정보 · 스크립트 · 타임라인 · 요약이다 — 시작 전에도", () => {
    noteState.value.meetingStatus = "NOT_STARTED";
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

    expect(screen.getAllByRole("tab").map((item) => item.textContent)).toEqual([
      "정보",
      "스크립트",
      "타임라인",
      "요약",
    ]);
  });

  it("회의 시작을 누르면 스크립트 탭으로 옮긴다", () => {
    noteState.value.meetingStatus = "NOT_STARTED";
    noteState.value.meetingStartedBy = null;
    const onTabChange = vi.fn();
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="details"
        onTabChange={onTabChange}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "회의 시작" }));

    expect(onTabChange).toHaveBeenCalledWith("transcript");
  });

  it("답이 흐르는 동안에는 레일을 접지 못한다", () => {
    personalChat.isTurnActive = true;
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
      screen.getByRole("button", { name: "답변이 끝나면 접을 수 있습니다" })
    ).toBeDisabled();
    expect(screen.getByTestId("note-agent-rail")).not.toHaveClass(
      "max-lg:hidden"
    );
    expect(
      screen.queryByRole("button", { name: "내 에이전트 열기" })
    ).toBeNull();
  });

  it("타임라인 탭은 본문에 서고, 사이드 뷰에서도 같은 면이다", () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="context"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByTestId("note-agent-rail")).toBeNull();
    expect(screen.getByRole("tab", { name: "타임라인" })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "유형으로 골라 보기" })
    ).toBeInTheDocument();
  });

  it("URL 과 노트의 소속이 다르면 아카이브에 워크스페이스를 안 넘긴다", () => {
    noteState.value.meetingStatus = "ENDED";
    noteState.value.workspaceId = "01K0000000099";

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

    expect(screen.getByTestId("note-archive")).toHaveAttribute(
      "data-workspace",
      ""
    );
  });

  it("확인된 소속을 아카이브에 넘긴다", () => {
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

    expect(screen.getByTestId("note-archive")).toHaveAttribute(
      "data-workspace",
      "01K0000000000"
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
          tab="details"
          onTabChange={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const [started] = visibleByText(/7월 29일/);
      expect(started.tagName).toBe("TIME");
      expect(started).toHaveAttribute("datetime", "2026-07-29T00:00:00Z");
    }
  );

  it("side 전사만 읽을 때는 에이전트 레일을 세우지 않는다", () => {
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

    expect(screen.queryByTestId("note-agent-rail")).toBeNull();
  });

  it("노트 상태 확정 뒤 아카이브에 근거 점프 대상을 넘긴다", () => {
    noteState.query = { data: undefined, isError: false };
    const panel = () => (
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        linkedSegmentId="evidence"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const { rerenderNote } = renderNotePanel(panel());
    expect(screen.getByTestId("transcript-view")).toHaveAttribute(
      "data-focus",
      ""
    );
    noteState.query = null;
    noteState.value.meetingStatus = "ENDED";
    rerenderNote(panel());
    expect(screen.getByTestId("note-archive")).toHaveAttribute(
      "data-focus",
      "evidence"
    );
  });

  it.each(["summary"] as const)(
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

      expect(screen.getByRole("tab", { name: "요약" })).toBeInTheDocument();
      expect(screen.getByRole("tabpanel")).toBeInTheDocument();
      expect(screen.getByLabelText("검토본 불러오는 중")).toBeInTheDocument();
      expect(screen.queryByTestId("review-tab")).toBeNull();
    }
  );

  it("삭제 확인창을 연 채 다른 노트로 바뀌면 창이 따라가지 않는다", async () => {
    noteState.value.meetingStatus = "ENDED";

    const { rerenderNote } = renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "노트 메뉴" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /삭제/ }));
    expect(await screen.findByText(/회의록을 삭제할까요/)).toBeTruthy();

    noteState.value = { ...noteState.value, noteId: "01K0000000009" };
    rerenderNote(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000009"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(screen.queryByText(/회의록을 삭제할까요/)).toBeNull()
    );
  });

  it("개인 답변이 흐르는 동안에는 좁은 화면에서도 레일을 접지 않는다", () => {
    noteState.value.meetingStatus = "ENDED";
    personalChat.isTurnActive = true;

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

    expect(screen.getByTestId("note-agent-rail")).not.toHaveClass(
      "max-lg:h-auto"
    );
  });

  it("관리자가 아니면 노트 메뉴가 없다(APP-1384)", () => {
    noteState.value.meetingStatus = "ENDED";
    admin.value = false;
    try {
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
      expect(screen.queryByRole("button", { name: "노트 메뉴" })).toBeNull();
    } finally {
      admin.value = true;
    }
  });

  it("노트를 옮겼다 돌아와도 삭제 확인창이 되살아나지 않는다", async () => {
    noteState.value.meetingStatus = "ENDED";
    const panel = (noteId: string) => (
      <NotePanel
        workspaceId="01K0000000000"
        noteId={noteId}
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const { rerenderNote } = renderNotePanel(panel("01K0000000002"));

    fireEvent.click(screen.getByRole("button", { name: "노트 메뉴" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /삭제/ }));
    expect(await screen.findByText(/회의록을 삭제할까요/)).toBeTruthy();

    noteState.value = { ...noteState.value, noteId: "01K0000000009" };
    rerenderNote(panel("01K0000000009"));
    await waitFor(() =>
      expect(screen.queryByText(/회의록을 삭제할까요/)).toBeNull()
    );

    noteState.value = { ...noteState.value, noteId: "01K0000000002" };
    rerenderNote(panel("01K0000000002"));
    expect(screen.queryByText(/회의록을 삭제할까요/)).toBeNull();
  });

  describe("발화 링크(?segment=)", () => {
    const focusOf = () =>
      screen.getByTestId("note-archive").getAttribute("data-focus");
    const panel = (segment: string | null, noteId = "01K0000000002") => (
      <NotePanel
        workspaceId="01K0000000000"
        noteId={noteId}
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        linkedSegmentId={segment}
      />
    );

    beforeEach(() => {
      noteState.value.meetingStatus = "ENDED";
    });

    it("노트가 열린 채 다른 발화 링크로 오면 그 발화로 다시 점프한다", async () => {
      const { rerenderNote } = renderNotePanel(panel("01K00000000A1"));
      expect(
        (await screen.findByTestId("note-archive")).getAttribute("data-focus")
      ).toBe("01K00000000A1");

      rerenderNote(panel("01K00000000B2"));

      await waitFor(() => expect(focusOf()).toBe("01K00000000B2"));
    });

    it("점프가 끝난 뒤 같은 링크로 다시 들어와도 다시 점프한다", async () => {
      const { rerenderNote } = renderNotePanel(panel("01K00000000A1"));
      await screen.findByTestId("note-archive");
      fireEvent.click(screen.getByRole("button", { name: "점프 끝" }));
      rerenderNote(panel(null));
      await waitFor(() => expect(focusOf()).toBe(""));

      rerenderNote(panel("01K00000000A1"));

      await waitFor(() => expect(focusOf()).toBe("01K00000000A1"));
    });

    it("노트가 바뀌면 이전 노트의 점프를 버린다", async () => {
      const { rerenderNote } = renderNotePanel(panel("01K00000000A1"));
      await screen.findByTestId("note-archive");

      noteState.value = { ...noteState.value, noteId: "01K0000000009" };
      rerenderNote(panel(null, "01K0000000009"));

      await waitFor(() => expect(focusOf()).toBe(""));
    });
  });

  describe("회의 종료 뒤 의견 창 (APP-1275)", () => {
    const panel = (noteId = "01K0000000002") => (
      <NotePanel
        workspaceId="01K0000000000"
        noteId={noteId}
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      noteState.value.meetingStatus = "PAUSED";
      noteState.value.activeSessionStartedAt = null;
    });
    afterEach(() => vi.useRealTimers());

    it("종료를 확인하고 1초 뒤에 뜬다", () => {
      renderNotePanel(panel());
      fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
      fireEvent.click(screen.getByRole("button", { name: "종료 확인" }));
      expect(screen.queryByText("회의 후 의견 창")).toBeNull();

      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByText("회의 후 의견 창")).toBeTruthy();
    });

    it("뜨기 전에 다른 노트로 가면 버린다 — 돌아와도 다시 뜨지 않는다", () => {
      const { rerenderNote } = renderNotePanel(panel());
      fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
      fireEvent.click(screen.getByRole("button", { name: "종료 확인" }));

      noteState.value = { ...noteState.value, noteId: "01K0000000009" };
      rerenderNote(panel("01K0000000009"));
      act(() => vi.advanceTimersByTime(1000));
      noteState.value = { ...noteState.value, noteId: "01K0000000002" };
      rerenderNote(panel());
      act(() => vi.advanceTimersByTime(1000));

      expect(screen.queryByText("회의 후 의견 창")).toBeNull();
    });
  });

  describe("참여자 지정하러 가기 (APP-1102)", () => {
    const panel = (
      tab: "transcript" | "details",
      noteId = "01K0000000002",
      onTabChange = vi.fn()
    ) => (
      <NotePanel
        workspaceId="01K0000000000"
        noteId={noteId}
        view="full"
        tab={tab}
        onTabChange={onTabChange}
        onClose={vi.fn()}
      />
    );
    const autoOpen = () =>
      screen.getByTestId("note-details").getAttribute("data-auto-open");

    beforeEach(() => {
      noteState.value.meetingStatus = "PAUSED";
      noteState.value.activeSessionStartedAt = null;
    });

    it("정보 탭으로 보내며 선택창 열기를 요청하고, 열리면 거둔다", () => {
      const onTabChange = vi.fn();
      const { rerenderNote } = renderNotePanel(
        panel("transcript", undefined, onTabChange)
      );
      fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
      fireEvent.click(
        screen.getByRole("button", { name: "참여자 지정하러 가기" })
      );
      expect(onTabChange).toHaveBeenCalledWith("details");

      rerenderNote(panel("details", undefined, onTabChange));
      expect(autoOpen()).toBe("true");

      fireEvent.click(screen.getByRole("button", { name: "선택창 열림" }));
      expect(autoOpen()).toBe("false");
    });

    it("도착한 뒤 바깥 경로로 탭을 떠나면 요청을 버린다", () => {
      const onTabChange = vi.fn();
      const { rerenderNote } = renderNotePanel(
        panel("transcript", undefined, onTabChange)
      );
      fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
      fireEvent.click(
        screen.getByRole("button", { name: "참여자 지정하러 가기" })
      );
      rerenderNote(panel("details", undefined, onTabChange));
      expect(autoOpen()).toBe("true");

      rerenderNote(panel("transcript", undefined, onTabChange));
      rerenderNote(panel("details", undefined, onTabChange));
      expect(autoOpen()).toBe("false");
    });

    it("정보 탭에 닿기 전에 다른 노트로 넘어가면 요청을 버린다", () => {
      const onTabChange = vi.fn();
      const { rerenderNote } = renderNotePanel(
        panel("transcript", undefined, onTabChange)
      );
      fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
      fireEvent.click(
        screen.getByRole("button", { name: "참여자 지정하러 가기" })
      );

      noteState.value = { ...noteState.value, noteId: "01K0000000009" };
      rerenderNote(panel("details", "01K0000000009", onTabChange));
      expect(autoOpen()).toBe("false");
    });
  });

  it("회의 종료 확인창이 노트 전환을 따라가지 않는다", async () => {
    noteState.value.meetingStatus = "PAUSED";
    noteState.value.activeSessionStartedAt = null;
    const panel = (noteId: string) => (
      <NotePanel
        workspaceId="01K0000000000"
        noteId={noteId}
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const { rerenderNote } = renderNotePanel(panel("01K0000000002"));

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    expect(screen.getByRole("button", { name: "종료 확인" })).toBeTruthy();

    noteState.value = { ...noteState.value, noteId: "01K0000000009" };
    rerenderNote(panel("01K0000000009"));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "종료 확인" })).toBeNull()
    );
  });

  it("full에서 노트를 못 읽으면 에이전트 레일도 세우지 않는다", () => {
    noteState.query = { data: undefined, isError: true };

    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    expect(screen.queryByTestId("note-agent-rail")).toBeNull();
  });

  it("full 모드는 요약 탭과 함께 회의 제어·창 제어를 직접 갖는다", () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="summary"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        onCollapse={vi.fn()}
      />
    );
    expect(screen.getByRole("tab", { name: "요약" })).toBeTruthy();
    expect(screen.getByTestId("review-tab")).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "회의 상태와 제어" })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "목록으로" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "노트 닫기" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "사이드 뷰로 보기" })
    ).toBeTruthy();
  });

  it("side + 종료는 정보·스크립트·타임라인·요약 탭과 아카이브를 보인다", () => {
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
      "정보",
      "스크립트",
      "타임라인",
      "요약",
    ]);
    expect(screen.getByTestId("note-archive")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "챗봇" })).toBeNull();
  });

  it("정보 탭 머리글이 회의 맥락을 보이고 회의 제어를 둔다", () => {
    const onTabChange = vi.fn();
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="details"
        onTabChange={onTabChange}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("기록 중")).toBeInTheDocument();
    expect(screen.queryByText("참관")).toBeNull();
    expect(screen.getByText("워크스페이스 멤버에게 공개")).toBeInTheDocument();
    expect(
      screen.getByText("워크스페이스 멤버에게 공개").parentElement?.textContent
    ).toMatch(/^참석자 \d+명 · /);
    expect(
      screen.getByRole("group", { name: "회의 상태와 제어" })
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "창 제어" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "회의 종료" })).toBeDisabled();
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it("일시정지된 회의를 종료하면 요약 탭으로 이동한다", () => {
    noteState.value.meetingStatus = "PAUSED";
    noteState.value.activeSessionStartedAt = null;
    const onTabChange = vi.fn();
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="details"
        onTabChange={onTabChange}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    fireEvent.click(screen.getByRole("button", { name: "종료 확인" }));

    expect(onTabChange).toHaveBeenCalledWith("summary");
  });

  it("탭은 상단바 안에 있고 제목 블록은 정보 탭만 갖는다", () => {
    const { rerenderNote } = renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const windowGroup = screen.getByRole("group", { name: "창 제어" });
    const topBar = windowGroup.closest('[data-slot="note-top-bar"]');
    expect(topBar).toHaveClass("sm:h-14", "shrink-0");
    expect(topBar?.contains(screen.getByRole("tablist"))).toBe(true);
    expect(
      screen.queryByRole("heading", { name: "주간 제품 회의" })
    ).toBeNull();
    expect(screen.queryByText(/참석자 \d+명/)).toBeNull();

    rerenderNote(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="details"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { name: "주간 제품 회의" })
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("group", { name: "창 제어" })
        .closest('[data-slot="note-top-bar"]')
        ?.contains(screen.getByRole("tablist"))
    ).toBe(true);
    expect(visibleByText("모바일 앱")).toHaveLength(1);
  });

  it("살아 있는 회의는 전사에서도 회의 종료에 닿는다", () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "회의 종료" })).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "주간 제품 회의" })
    ).toBeNull();
  });

  it("종료된 회의의 전사에는 회의 종료를 두지 않는다", () => {
    noteState.value.meetingStatus = "ENDED";
    noteState.value.activeSessionStartedAt = null;
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "회의 종료" })).toBeNull();
    expect(screen.getByRole("button", { name: "노트 메뉴" })).toBeTruthy();
    expect(
      screen.queryByRole("group", { name: "회의 상태와 제어" })
    ).toBeNull();
  });

  it("창 제어 버튼은 정본대로 32×32다", () => {
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

    expect(
      screen.getByRole("button", { name: "전체 화면으로 보기" })
    ).toHaveClass("size-8");
    expect(screen.getByRole("button", { name: "목록으로" })).toHaveClass(
      "size-8"
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

    fireEvent.click(screen.getByRole("button", { name: "스크립트와 요약 보기" }));

    expect(screen.queryByTestId("transcript-view")).toBeNull();
    expect(screen.getByTestId("note-archive")).toBeInTheDocument();
  });

  it.each(["summary"] as const)(
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

  it("side + 미시작은 정보·스크립트와 회의 시작을 보인다", () => {
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
      "정보",
      "스크립트",
    ]);
    expect(
      screen.getByRole("button", { name: "회의 시작" })
    ).toBeInTheDocument();
  });

  function dockElement(view: "side" | "full") {
    return (
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

  function renderDock(view: "side" | "full") {
    const rendered = renderNotePanel(dockElement(view));
    return { rerender: rendered.rerenderNote };
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

    it("끊기면 받아쓰기가 멈췄다고 말하고, 이으면 걷는다", () => {
      recordingState.activeNoteId = "01K0000000002";
      recordingState.phase = "recording";
      recordingState.connectionNotice = {
        cause: "disconnected",
        sinceMs: Date.now() - 10_000,
      };
      recordingState.buffer = {
        pendingMs: 13_000,
        limitMs: 300_000,
        paused: false,
        upload: null,
      };

      const { rerender } = renderDock(view);

      expect(screen.getByRole("status")).toHaveTextContent(
        "연결이 끊겨 받아쓰기와 실시간 분석이 멈췄습니다. 녹음한 소리는 이 탭에 모아 둡니다. 다시 연결될 때까지 탭을 열어 두세요."
      );

      recordingState.connectionNotice = null;
      rerender(dockElement(view));

      expect(screen.queryByText(/연결이 끊겨 받아쓰기와 실시간 분석이 멈췄습니다/)).toBeNull();
    });

    it("멈추는 중에 밀린 것을 올리면 저장 마무리 진행률을 보인다", () => {
      recordingState.activeNoteId = "01K0000000002";
      recordingState.phase = "stopping";
      recordingState.buffer = {
        pendingMs: 40_000,
        limitMs: 300_000,
        paused: false,
        upload: { percent: 40, remainingMs: 24_000 },
      };

      renderDock(view);

      expect(screen.getByText("저장 마무리 중… 40%")).toBeInTheDocument();
    });

    it("IN_PROGRESS 로컬 시작자는 일시정지 독을 본다", () => {
      recordingState.activeNoteId = "01K0000000002";
      recordingState.phase = "recording";

      renderDock(view);

      expect(screen.getByRole("button", { name: "일시정지" })).toBeEnabled();
      if (view === "side") {
        expect(
          screen.getByRole("button", { name: "회의 종료" })
        ).toBeInTheDocument();
      }
    });

    it("IN_PROGRESS 원격 시작자는 거짓 시작 대신 다른 탭 안내를 본다", () => {
      renderDock(view);

      expect(
        screen.getByText("다른 탭이나 기기에서 기록 중입니다.")
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "회의 시작" })).toBeNull();
      expect(screen.queryByRole("button", { name: "재개" })).toBeNull();
    });

    it("IN_PROGRESS라도 새로고침한 같은 탭이 녹음하던 노트면 잠그지 않는다", () => {
      beatRecording("01K0000000002");

      renderDock(view);

      expect(screen.queryByText("다른 탭이나 기기에서 기록 중입니다.")).toBeNull();
      expect(screen.getByRole("button", { name: "회의 시작" })).toBeEnabled();
    });

    it("닫힌 탭의 박동이 식었으면 새 탭에서도 잠그지 않는다", () => {
      writeOtherTab("01K0000000002", Date.now() - 10_000);

      renderDock(view);

      expect(screen.queryByText("다른 탭이나 기기에서 기록 중입니다.")).toBeNull();
      expect(screen.getByRole("button", { name: "회의 시작" })).toBeEnabled();
    });

    it("다른 탭의 박동이 살아 있으면 잠근다", () => {
      writeOtherTab("01K0000000002", Date.now() - 1_000);

      renderDock(view);

      expect(
        screen.getByText("다른 탭이나 기기에서 기록 중입니다.")
      ).toBeInTheDocument();
    });

    it("회의가 녹음 중을 벗어나면 그 노트의 녹음 기록을 지운다", () => {
      beatRecording("01K0000000002");
      writeOtherTab("01K0000000002", Date.now() - 10_000);
      noteState.value.meetingStatus = "PAUSED";

      renderDock(view);

      expect(recordingClaimOf("01K0000000002")).toBeNull();
    });

    it("다른 노트를 녹음하던 기록이면 여전히 잠근다", () => {
      beatRecording("01K0000000009");
      writeOtherTab("01K0000000009", Date.now() - 10_000);

      renderDock(view);

      expect(
        screen.getByText("다른 탭이나 기기에서 기록 중입니다.")
      ).toBeInTheDocument();
    });

    it("IN_PROGRESS의 세션 없는 로컬 실패도 원격 기록으로 취급한다", () => {
      recordingState.activeNoteId = "01K0000000002";
      recordingState.phase = "failed";

      renderDock(view);

      expect(
        screen.getByText("다른 탭이나 기기에서 기록 중입니다.")
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "다시 녹음" })).toBeNull();
    });

    it("IN_PROGRESS의 실패한 ACTIVE 세션은 원격 기록으로 취급한다", () => {
      recordingState.activeNoteId = "01K0000000002";
      recordingState.phase = "failed";
      recordingState.sessionStatus = "ACTIVE";

      renderDock(view);

      expect(
        screen.getByText("다른 탭이나 기기에서 기록 중입니다.")
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "다시 녹음" })).toBeNull();
    });

    it("IN_PROGRESS라도 죽음이 확인된 실패는 차단 대신 다시 시도를 연다", () => {
      recordingState.activeNoteId = "01K0000000002";
      recordingState.phase = "failed";
      recordingState.sessionStatus = "INTERRUPTED";

      renderDock(view);

      expect(screen.queryByText("다른 탭이나 기기에서 기록 중입니다.")).toBeNull();
      expect(
        screen.getByRole("button", { name: "다시 녹음" })
      ).toBeInTheDocument();
    });

    it("방금 이 창에서 일시정지한 진행자에게는 다른 탭 안내를 띄우지 않는다", () => {
      recordingState.activeNoteId = "01K0000000002";
      recordingState.phase = "completed";
      recordingState.sessionStatus = "COMPLETED";
      recordingState.sessionStartedAt = noteState.value.activeSessionStartedAt;

      renderDock(view);

      expect(screen.queryByText("다른 탭이나 기기에서 기록 중입니다.")).toBeNull();
    });

    it("갱신이 끝났는데도 IN_PROGRESS면 남이 재개한 것으로 본다", () => {
      recordingState.activeNoteId = "01K0000000002";
      recordingState.phase = "completed";
      recordingState.sessionStatus = "COMPLETED";
      recordingState.sessionStartedAt = "2026-07-29T09:00:00Z";

      renderDock(view);

      expect(
        screen.getByText("다른 탭이나 기기에서 기록 중입니다.")
      ).toBeInTheDocument();
    });

    it("IN_PROGRESS 비시작 멤버에게도 원격 기록 안내와 종료 제어를 보인다", () => {
      authState.userId = "u2";

      renderDock(view);

      expect(screen.getByLabelText("녹음 제어")).toBeInTheDocument();
      expect(
        screen.getByText("다른 탭이나 기기에서 기록 중입니다.")
      ).toBeInTheDocument();
      if (view === "side") {
        expect(
          screen.getByRole("button", { name: "회의 종료" })
        ).toBeInTheDocument();
      }
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

    it("PAUSED 비시작 멤버도 재개 독을 본다", () => {
      authState.userId = "u2";
      noteState.value.meetingStatus = "PAUSED";
      noteState.value.activeSessionStartedAt = null;

      renderDock(view);

      expect(screen.getByRole("button", { name: "재개" })).toBeInTheDocument();
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

        expect(screen.getByRole("button", { name: "다시 녹음" })).toBeEnabled();
        expect(
          screen.queryByText("다른 탭이나 기기에서 기록 중입니다.")
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

    it("다른 사용자가 시작한 진행 중 회의에서는 원격 기록을 안내한다", () => {
      authState.userId = "u2";

      renderStartGate();

      expect(screen.getByLabelText("녹음 제어")).toBeInTheDocument();
      expect(
        screen.getByText("다른 탭이나 기기에서 기록 중입니다.")
      ).toBeInTheDocument();
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

    describe("데스크톱 앱 안내 말풍선", () => {
      afterEach(() => {
        desktopApp.value = false;
      });

      it("브라우저의 미시작 회의에서 링크와 화살표가 있는 말풍선을 띄운다", () => {
        noteState.value.meetingStatus = "NOT_STARTED";
        noteState.value.meetingStartedBy = null;

        renderStartGate();

        const hint = screen.getByTestId("desktop-app-hint");
        expect(hint).toHaveTextContent("화상회의 녹음은 데스크톱 앱으로");
        const link = screen.getByRole("link", { name: "데스크톱 앱" });
        expect(link).toHaveAttribute("href", "/download");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        expect(hint.querySelector('span[aria-hidden="true"]')).not.toBeNull();
      });

      it.each([true, null])("앱 안(%s)에서는 띄우지 않는다", (v) => {
        desktopApp.value = v;
        noteState.value.meetingStatus = "NOT_STARTED";
        noteState.value.meetingStartedBy = null;

        renderStartGate();

        expect(screen.queryByTestId("desktop-app-hint")).toBeNull();
      });

      it("시작한 회의에서는 띄우지 않는다", () => {
        noteState.value.meetingStatus = "IN_PROGRESS";

        renderStartGate();

        expect(screen.queryByTestId("desktop-app-hint")).toBeNull();
      });
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

    fireEvent.click(screen.getByRole("button", { name: "스크립트와 요약 보기" }));

    expect(screen.queryByTestId("transcript-view")).toBeNull();
    expect(screen.getByTestId("note-archive")).toBeInTheDocument();
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
