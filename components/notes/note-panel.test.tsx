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
import { NoteRealtimeProvider } from "@/components/notes/note-realtime-provider";

// 이 파일이 보는 것은 패널이지 소켓이 아니다. 연결은 세우지 않는다.
vi.mock("@/lib/notes/note-topic-client", () => ({
  getNoteTopicWebSocketUrl: () => "ws://localhost/ws/transcriptions",
  NoteTopicClient: class {
    readonly connect = vi.fn();
    readonly close = vi.fn().mockResolvedValue(undefined);
  },
}));
import {
  RecordingProvider,
  useRecording,
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
  sessionStatus: null as
    | "ACTIVE"
    | "READY"
    | "INTERRUPTED"
    | "COMPLETED"
    | null,
  /** 노트가 들고 있는 활성 세션이 이 세션인지 가르는 값. */
  sessionStartedAt: null as string | null,
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
    participants: [
      { userId: "u1", name: "테스트 유저", email: "test@heymoa.com" },
      { userId: "u2", name: "김서연", email: "seoyeon@heymoa.com" },
    ] as unknown,
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
// 레일이 셸의 개인 챗봇 자리를 등록한다. 여기서는 provider를 세우지 않으므로 훅만 채운다.
const setRailSlot = vi.hoisted(() => vi.fn());
const personalChat = vi.hoisted(() => ({ isTurnActive: false }));
vi.mock("@/components/chat/personal-chat", () => ({
  usePersonalChat: () => ({ setRailSlot, ...personalChat }),
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
  getGetNotesQueryKey: (projectId: string) => [
    `/v1/projects/${projectId}/notes`,
  ],
  // 삭제 메뉴가 노트 헤더로 옮겨오면서 패널이 이 훅을 지나간다.
  useDeleteNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetNote: () =>
    noteState.query ?? {
      data: { status: 200, data: { success: true, data: noteState.value } },
    },
}));
/** URL의 워크스페이스가 이 노트의 것이 아니면 서버가 `PROJECT_NOT_FOUND`를 준다. */
const projectGone = vi.hoisted(() => ({ value: false }));
/** 프로젝트 조회가 아직 안 끝난 상태. 소속이 확인되기 전이다. */
const projectPending = vi.hoisted(() => ({ value: false }));
/** 프로젝트 조회가 500 등으로 실패. 어긋난 URL이라는 증거는 아니다. */
const projectFailed = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/api/generated/projects/projects", () => ({
  useGetProject: (...args: unknown[]) => {
    useGetProject(...args);
    if (projectPending.value) {
      return {
        data: undefined,
        isError: false,
        error: null,
        failureReason: null,
      };
    }
    if (projectFailed.value) {
      return {
        data: undefined,
        isError: true,
        error: new Error("Internal Server Error"),
        failureReason: new Error("Internal Server Error"),
      };
    }
    if (projectGone.value) {
      return {
        data: undefined,
        isError: false,
        error: null,
        // 재시도가 남아 있어도 첫 실패로 판정해야 한다(APP-385).
        failureReason: {
          success: false,
          data: null,
          error: {
            code: "PROJECT_NOT_FOUND",
            message: "프로젝트를 찾을 수 없습니다.",
          },
        },
      };
    }
    return {
      isError: false,
      error: null,
      failureReason: null,
      data: {
        status: 200,
        data: {
          success: true,
          data: {
            projectId: "01K0000000001",
            // 실제 응답에 있는 값이다(`ProjectResponseData`). 노트의 **확인된** 소속이라
            // 독은 이 값으로만 녹음을 시작한다 — URL을 믿지 않는다.
            workspaceId: "01K0000000000",
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

/**
 * 기록 중에는 레일이 「실시간 정리」로 열린다. 공유 챗을 보는 테스트는 그 전제를 명시한다 —
 * 패널은 마운트돼 있지만 `hidden` 이라 접근성 트리에 없다.
 */
function openSharedRailTab() {
  // 사이드 뷰나 죽은 회의에는 레일 자체가 없다. 있을 때만 옮긴다.
  const trigger = screen.queryByRole("tab", { name: "이 회의" });
  if (trigger) fireEvent.click(trigger);
}

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
        {/* NotePanel 은 프로덕션에서 항상 NoteRealtimeProvider 안이다
            (`note-route-client.tsx`). 여기서는 소켓을 띄우지 않고 컨텍스트만 세운다. */}
        <NoteRealtimeProvider noteId="01K0000000002">{node}</NoteRealtimeProvider>
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
    projectGone.value = false;
    projectPending.value = false;
    projectFailed.value = false;
    noteRefetch.mockReset();
    authState.userId = "u1";
    recordingState.activeNoteId = null;
    recordingState.phase = "idle";
    recordingState.sessionStatus = null;
    noteState.query = null;
    personalChat.isTurnActive = false;
    setRailSlot.mockReset();
    recordingState.sessionStartedAt = null;
    noteState.value = {
      noteId: "01K0000000002",
      title: "주간 제품 회의",
      projectId: "01K0000000001",
      meetingStatus: "IN_PROGRESS",
      meetingStartedBy: { userId: "u1", name: "테스트 유저" },
      meetingStartedAt: "2026-07-29T00:00:00Z",
      recordedDurationMs: 60_000,
      activeSessionStartedAt: "2026-07-29T00:01:00Z",
      participants: [
        { userId: "u1", name: "테스트 유저", email: "test@heymoa.com" },
        { userId: "u2", name: "김서연", email: "seoyeon@heymoa.com" },
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

    expect(screen.getByRole("tab", { name: "전사" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "정보" }));
    expect(onTabChange).toHaveBeenCalledWith("details");
    // 전사에서는 제목이 **상단바 빵조각 하나뿐이다** — 세리프 제목은 정보 탭의 머리글이다.
    expect(screen.getAllByText("주간 제품 회의")).toHaveLength(1);
    expect(
      screen.queryByRole("heading", { name: "주간 제품 회의" })
    ).toBeNull();
    expect(useGetProject).toHaveBeenCalledWith(
      "01K0000000000",
      "01K0000000001",
      // 실패 자기 복구용 refetchInterval은 별도 테스트가 동작으로 검증한다 — 여기서는
      // 어느 프로젝트를 물었는지만 본다.
      { query: expect.objectContaining({ enabled: true }) }
    );
  });

  /**
   * **녹음이 어느 워크스페이스 것인지는 여기서만 정해진다.** 계약이 노트 → 워크스페이스를
   * 안 알려줘서(노트 응답에 `projectId`만 있다) 이 패널이 아는 값을 독에 내려주고, 독이
   * `start()`에 실어야 프로바이더가 안다. 타입은 문자열 두 개라 **noteId를 잘못 넘겨도
   * 컴파일이 통과한다** — 실제로 무엇이 실렸는지를 본다.
   *
   * 이 값이 틀리면 나가기 잠금과 추방 시 녹음 정리가 조용히 엉뚱한 워크스페이스에 걸린다.
   */
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

  /**
   * **`/w/B/notes/<A의 노트>` 딥링크.** 노트 조회는 워크스페이스로 좁혀지지 않아 A의 노트가
   * 그대로 그려진다. 여기서 녹음을 시작하면 세션은 A에 생기는데 소속은 B로 기록돼 A의
   * 나가기 잠금과 추방 정리가 둘 다 빗나간다.
   *
   * 프로젝트 조회가 그 어긋남을 판정해 준다(`PROJECT_NOT_FOUND`). 독은 감추지 않고 시작
   * 자리에 이유를 세운다 — 감추면 레이아웃이 흔들린다.
   */
  it("다른 워크스페이스의 노트 URL이면 시작을 막고 이유를 보인다", () => {
    noteState.value.meetingStatus = "NOT_STARTED";
    noteState.value.meetingStartedBy = null;
    projectGone.value = true;

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

  // **확인 전에는 시작을 열지 않는다.** 프로젝트 조회가 끝나기 전에 눌리면 URL의 값으로
  // 시작하게 되는데, `/w/B/notes/<A의 노트>`면 세션은 A에 생기고 소속은 B로 기록된다.
  it("노트 소속이 확인되기 전에는 시작을 못 누른다", () => {
    noteState.value.meetingStatus = "NOT_STARTED";
    noteState.value.meetingStartedBy = null;
    projectPending.value = true;

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

    expect(screen.getByRole("button", { name: "회의 시작" })).toBeDisabled();
  });

  /**
   * **일시적 실패의 복구는 값을 추측하는 것이 아니다.** 500이 왔다고 URL의 워크스페이스로
   * 시작하면 `/w/B/notes/<A의 노트>`에서 소속이 B로 잘못 기록된다(codex 7회차 — 6회차
   * 반영이 그렇게 한 번 틀렸다). 대신 이유를 세우고, 조회가 30초마다 스스로 다시 돈다 —
   * 이유 없이 잠긴 버튼만 남기는 것(6회차 지적)도 아니다.
   */
  it("프로젝트 조회가 실패하면 시작을 막고 이유를 보이며 스스로 다시 확인한다", () => {
    noteState.value.meetingStatus = "NOT_STARTED";
    noteState.value.meetingStartedBy = null;
    projectFailed.value = true;

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
    expect(
      screen.getByText(
        "노트 정보를 확인하지 못했습니다. 자동으로 다시 시도합니다."
      )
    ).toBeInTheDocument();

    // 복구 경로 — 실패 상태에서만 재조회 타이머가 돈다.
    const options = useGetProject.mock.calls.at(-1)?.[2] as {
      query: { refetchInterval: (query: unknown) => number | false };
    };
    expect(
      options.query.refetchInterval({ state: { status: "error" } })
    ).toBeGreaterThan(0);
    expect(
      options.query.refetchInterval({ state: { status: "success" } })
    ).toBe(false);
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
        screen.getByRole("button", { name: "다른 노트에서 녹음 중" })
      ).toBeDisabled()
    );
  });

  it("full + 활성이면 실시간 정리·내 에이전트 레일이 선다", () => {
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
    expect(screen.getByRole("tab", { name: "실시간 정리" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("full + 중지에서도 에이전트 레일을 유지한다", () => {
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

    expect(screen.getByTestId("note-agent-rail")).toBeInTheDocument();
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

    // 레일 안에 탭이 생기면서 `shared-chat-panel`이 두 겹 더 들어갔다. DOM을 거슬러 오르는
    // 대신 기하를 실제로 갖는 상자를 이름으로 잡는다.
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
      // 레일 폭은 440이다 (design.pen `L4PpR`). 예전 464는 옛 산술이었다.
      "lg:w-[440px]"
    );
    // 캔버스 10px 틈은 **넓은 화면 규칙**이다 — 좁은 화면은 두 면이 테두리로 붙는데
    // 틈까지 두면 붙은 척하면서 벌어진다.
    expect(root).toHaveClass("lg:gap-2.5");
    expect(root?.className).not.toMatch(/(^|\s)gap-2\.5(\s|$)/);
    expect(tray).toHaveClass("rounded-panel", "shadow-e2");
  });

  // 가르는 선을 두 곳이 그리면 두 겹이 된다 — 자리를 잡아 주는 쪽만 그린다.
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

    expect(screen.getByTestId("note-agent-rail")).toBeInTheDocument();
    expect(screen.getByTestId("note-agent-rail").parentElement).toHaveClass(
      "lg:gap-2.5"
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

  // 레일은 회의 상태로 여닫지 않는다 — 전체 화면이면 항상 오른쪽 440에 서 있다
  // (design.pen `XtEMZ`/`L4PpR`). 예전에는 종료되면 통째로 사라져 본문 폭이 튀었다.
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
    // 닫기가 없다 — 레일은 고정이다.
    expect(
      screen.queryByRole("button", { name: /레일 닫기|챗봇 닫기/ })
    ).toBeNull();
  });

  it("종료된 회의에서도 「내 에이전트」로 물어볼 곳이 남는다", () => {
    // 공유 챗봇은 살아 있는 회의에 붙은 것이라 ENDED면 컴포저가 잠긴다. 노트 안에서는 개인
    // 챗봇도 감춰 두므로, 탭이 없으면 종료된 회의에는 물어볼 곳이 한 군데도 없다.
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

    const personal = screen.getByRole("tab", { name: "내 에이전트" });
    expect(screen.getByRole("tab", { name: "내 에이전트" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(personal).toHaveAttribute("aria-selected", "true");
    // 셸의 개인 챗봇이 들어올 자리를 실제로 넘겨줬다.
    expect(setRailSlot).toHaveBeenCalledWith(expect.any(HTMLElement));
    expect(screen.queryByTestId("shared-chat-panel")).toBeNull();
  });

  it.skip("제거된 공유 턴의 종료 전환", () => {
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
    openSharedRailTab();
    fireEvent.click(screen.getByRole("button", { name: "턴 시작" }));
    // 그 사이 다른 멤버가 회의를 끝낸다(폴링이 ENDED를 올린다).
    noteState.value.meetingStatus = "ENDED";
    rerenderNote(el);
    // 트레이는 아직 있고 아카이브는 아직 없다 — 언마운트하면 흐르던 답변이 사라진다.
    expect(screen.getByTestId("shared-chat-panel")).toBeTruthy();
    expect(screen.queryByTestId("note-archive")).toBeNull();

    // 턴이 끝나면 왼쪽이 아카이브로 넘어간다. **레일은 그대로 선다** — 이제 상주라
    // 회의 상태로 걷지 않는다.
    fireEvent.click(screen.getByRole("button", { name: "턴 끝" }));
    expect(screen.getByTestId("shared-chat-panel")).toBeTruthy();
    expect(screen.getByTestId("note-archive")).toBeTruthy();
  });

  it.skip("제거된 side 공유 챗봇 탭", () => {
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
      "정보",
      "전사",
      // 사이드 뷰에는 레일이 없어서 실시간 정리가 노트 탭으로 내려온다.
      "실시간 정리",
      "챗봇",
    ]);
    expect(
      screen
        .getByTestId("shared-chat-panel")
        .closest('[data-slot="tabs-content"]')
    ).toBeInTheDocument();
  });

  it.skip("제거된 side 공유 챗봇 기록 탭", () => {
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
      // 메타 줄은 정보 탭의 머리글에 있다 — 전사·요약은 읽는 면이라 크롬을 걷었다.
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

      const started = screen.getByText(/7월 29일/);
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

  it.skip("제거된 side 공유 챗봇 keepMounted", () => {
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

    openSharedRailTab();
    fireEvent.click(screen.getByRole("button", { name: "턴 시작" }));
    rerenderNote(panel("transcript"));

    expect(screen.getByTestId("shared-chat-panel")).toBe(sharedPanel);
    expect(sharedPanel.closest('[data-slot="tabs-content"]')).not.toBeVisible();
  });

  it.skip("제거된 side 공유 챗봇 초안", () => {
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

  it.skip("제거된 side 공유 턴 확장 잠금", () => {
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

    openSharedRailTab();
    fireEvent.click(screen.getByRole("button", { name: "턴 시작" }));

    expect(
      screen.getByRole("button", {
        name: "답변이 끝나면 확장할 수 있습니다",
      })
    ).toBeDisabled();
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
    }
  );

  it("삭제 확인창을 연 채 다른 노트로 바뀌면 창이 따라가지 않는다", async () => {
    // 이 패널은 노트가 바뀌어도 재마운트되지 않는다. 창이 열린 채 대상만 바뀌면 A를 지우려다
    // B가 지워진다 — 상태가 「열렸나」가 아니라 「어느 노트의 것인가」를 담아야 한다.
    // 기록 중이면 삭제 메뉴 자체가 없다(서버가 409).
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
    expect(await screen.findByText(/을 삭제할까요/)).toBeTruthy();

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

    await waitFor(() => expect(screen.queryByText(/을 삭제할까요/)).toBeNull());
  });

  it("개인 답변이 흐르는 동안에는 좁은 화면에서도 레일을 접지 않는다", () => {
    // 접으면 중지도 도구 승인도 화면 밖으로 나간다 — 레일이 슬롯을 쥐고 있어 떠 있는 FAB로
    // 되돌아가지도 않는다. 다른 멤버가 회의를 끝내는 순간이 바로 그 자리다.
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

  it.skip("이전 3탭 기준 좁은 화면 접힘", () => {
    // 레일을 통째로 감추면 탭 버튼까지 같이 감춰져서 종료된 회의에는 들어갈 길이 없어진다.
    // 접는 것은 대화뿐이고 탭 줄은 남는다.
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
    // 종료된 회의는 좁은 화면에서 대화를 접는다 — 전사 높이를 지키기 위해서다.
    expect(rail).toHaveClass("max-lg:h-auto");
    expect(rail).not.toHaveClass("max-lg:hidden");

    const personal = screen.getByRole("tab", { name: "내 에이전트" });
    fireEvent.click(personal);

    expect(screen.getByTestId("note-agent-rail")).not.toHaveClass(
      "max-lg:h-auto"
    );
    expect(setRailSlot).toHaveBeenCalledWith(expect.any(HTMLElement));
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
    expect(await screen.findByText(/을 삭제할까요/)).toBeTruthy();

    noteState.value = { ...noteState.value, noteId: "01K0000000009" };
    rerenderNote(panel("01K0000000009"));
    await waitFor(() => expect(screen.queryByText(/을 삭제할까요/)).toBeNull());

    // 되돌아온다. 저장된 대상을 안 버렸으면 여기서 창이 저절로 뜬다.
    noteState.value = { ...noteState.value, noteId: "01K0000000002" };
    rerenderNote(panel("01K0000000002"));
    expect(screen.queryByText(/을 삭제할까요/)).toBeNull();
  });

  it("회의 종료 확인창이 노트 전환을 따라가지 않는다", async () => {
    // 삭제 확인창과 같은 함정인데 결과가 더 나쁘다 — 대상만 B로 바뀌어 **다른 회의가
    // 종료된다.** 예전에는 상단바의 노트 액션 슬롯이 `key={activeNoteId}`로 막았다.
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

  it("full에서 노트를 못 읽으면 공유 레일도 세우지 않는다", () => {
    // 왼쪽이 재시도인데 오른쪽 레일이 「회의 상태를 확인하는 중」을 그리면 같은 실패가
    // 두 가지 뜻으로 보인다. side가 이미 같은 조건으로 챗 탭을 뺀다.
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

    expect(screen.queryByTestId("shared-chat-panel")).toBeNull();
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
    expect(screen.getByTestId("note-summary")).toBeTruthy();
    // 전체 화면이 워크스페이스 상단바를 통째로 덮으므로 **회의 제어·창 제어를 노트가 직접
    // 갖는다.** 예전에는 셸 상단바의 노트 액션 슬롯이 맡았고, 그 바가 안 보이게 되면서
    // 회의 종료·축소·닫기가 갈 곳이 없어졌다.
    expect(
      screen.getByRole("group", { name: "회의 상태 및 제어" })
    ).toBeTruthy();
    // 목록으로 나가는 길은 상단바의 ← 하나다 — 예전에는 같은 곳으로 가는 「노트 닫기」가
    // 헤더에 따로 있었다.
    expect(screen.getByRole("button", { name: "목록으로" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "노트 닫기" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "사이드 뷰로 보기" })
    ).toBeTruthy();
  });

  // 뷰가 바뀌면 레일의 SharedChatPanel이 언마운트되고 탭 아래에 새로 마운트되어 SSE가 끊긴다.
  // 계약상 부분 응답은 저장되지 않으므로 흐르던 답변이 통째로 사라진다 — 확장과 같은 이유로 막는다.
  it.skip("제거된 공유 턴 축소 잠금", () => {
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

    openSharedRailTab();
    fireEvent.click(screen.getByRole("button", { name: "턴 시작" }));

    expect(
      screen.getByRole("button", { name: "답변이 끝나면 축소할 수 있습니다" })
    ).toBeDisabled();
  });

  it("side + 종료는 정보·전사·요약 탭과 아카이브를 보인다", () => {
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
      "전사",
      // 원장은 종료로 지워지지 않는다. 회의 중에 본 것을 나중에 되짚을 자리가 남아야 한다.
      "실시간 정리",
      "요약",
    ]);
    expect(screen.getByTestId("note-archive")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "챗봇" })).toBeNull();
  });

  it("정보 탭 머리글이 회의 맥락을 보이고 종료 성공 뒤 요약 탭으로 이동한다", () => {
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

    // 상태 칩은 상단바에 있고, 메타 줄은 정보 탭 머리글에 있다. 시작자에게는 자기 이름을
    // 다시 적지 않는다 — 참관일 때만 메타 줄이 「OOO님이 기록 중」을 말한다.
    expect(screen.getByText("기록 중")).toBeInTheDocument();
    expect(screen.queryByText("참관")).toBeNull();
    expect(screen.getByText("워크스페이스 멤버에게 공개")).toBeInTheDocument();
    expect(
      screen.getByText("워크스페이스 멤버에게 공개").parentElement?.textContent
    ).toMatch(/^참석자 \d+명 · /);
    expect(
      screen.getByRole("group", { name: "회의 상태 및 제어" })
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "창 제어" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    fireEvent.click(screen.getByRole("button", { name: "종료 확인" }));

    expect(onTabChange).toHaveBeenCalledWith("summary");
  });

  /**
   * **크롬이 700 패널에서 233(33%)을 먹던 것을 걷은 것이 이 구조다.** 세리프 제목(41)과
   * 메타 두 줄(36)은 전사·요약에서 군더더기였다 — 제목은 상단바 빵조각에, 메타는 정보 탭의
   * 「회의 정보」 표에 이미 있다.
   *
   * **탭이 상단바에 있어야 이게 가능하다.** 탭이 제목 블록 아래에 있으면 탭을 누를 때마다
   * 줄이 141px씩 오르내려 커서 밑에서 버튼이 도망간다. jsdom은 px를 못 재니 **탭 목록이
   * 상단바 안에 있는지**로 검사한다.
   */
  it("탭은 상단바 안에 있고 제목 블록은 정보 탭만 갖는다", () => {
    // `rerenderNote`다 — 맨 `rerender`는 프로바이더 래퍼를 벗겨서 `useRecording`이 터진다.
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
    const topBar = windowGroup.closest("div.h-14");
    expect(topBar).toHaveClass("h-14", "shrink-0");
    // 탭 목록이 그 바 안에 있어야 제목 블록이 켜지든 꺼지든 제자리에 남는다.
    expect(topBar?.contains(screen.getByRole("tablist"))).toBe(true);
    // 전사에는 세리프 제목도 메타도 없다.
    expect(screen.queryByRole("heading", { name: "주간 제품 회의" })).toBeNull();
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
    // 탭은 여전히 같은 바 안이다 — 이게 깨지면 탭 줄이 튄다.
    expect(
      screen
        .getByRole("group", { name: "창 제어" })
        .closest("div.h-14")
        ?.contains(screen.getByRole("tablist"))
    ).toBe(true);
    // 프로젝트 pill도 이 머리글의 것이다 — 전사에서는 상단바가 이미 좁다.
    expect(screen.getByText("주간")).toBeInTheDocument();
  });

  /**
   * 회의 제어는 **상단바 오른쪽**이다. 전사를 보다가 회의를 끝내는 것은 흔한 일인데, 제목
   * 블록에 묶어 두면 정보 탭까지 다녀와야 한다.
   *
   * 노트 메뉴(`⋯`)와 한 자리를 나눠 쓴다 — 삭제는 기록 중에 숨고(서버 409) 회의 종료는
   * 기록 중·중지됨에만 뜨니 겹치지 않는다.
   */
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
    // 제목 블록은 여전히 없다 — 제어 한 줄만 섰다.
    expect(screen.queryByRole("heading", { name: "주간 제품 회의" })).toBeNull();
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

    // 종료된 회의에서는 그 자리를 노트 메뉴가 쓴다.
    expect(screen.queryByRole("button", { name: "회의 종료" })).toBeNull();
    expect(screen.getByRole("button", { name: "노트 메뉴" })).toBeTruthy();
    expect(
      screen.queryByRole("group", { name: "회의 상태 및 제어" })
    ).toBeNull();
  });

  // 좁은 폭에서 헤더가 세로로 자라 전사 높이를 0까지 밀어낸 적이 있다(812×375 landscape에서
  // 헤더 278/355 실측). 그 원인은 창 제어·회의 제어·상태·제목이 **한 헤더에 다 있었기**
  // 때문이다. 지금은 창 제어·상태·탭이 모두 높이 56 고정 바에 있다(design.pen `KktRX`).
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

    // 정본은 32×32 버튼이다(`UfrA6`/`BJAQl`).
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

    fireEvent.click(screen.getByRole("button", { name: "기록과 요약 보기" }));

    expect(screen.queryByTestId("transcript-view")).toBeNull();
    expect(screen.getByTestId("note-archive")).toBeInTheDocument();
  });

  it.skip("제거된 side 공유 턴 종료 보존", () => {
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

    openSharedRailTab();
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

  it.skip("제거된 side 공유 턴 승인 대기", () => {
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

    openSharedRailTab();
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

  it("side + 미시작은 정보·전사와 회의 시작을 보인다", () => {
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
      "전사",
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

    // 중지 직후의 창이다. 소켓이 completed를 주면 phase는 활성 밖으로 나가는데 노트 쿼리는
    // 아직 IN_PROGRESS라, 자기가 방금 끈 것을 남이 켠 것으로 읽어 진행자 본인에게
    // "다른 탭·기기에서 기록 중입니다"가 떴다.
    it("방금 이 창에서 중지한 진행자에게는 다른 탭 안내를 띄우지 않는다", () => {
      recordingState.activeNoteId = "01K0000000002";
      recordingState.phase = "completed";
      recordingState.sessionStatus = "COMPLETED";
      // 노트가 아직 내 세션을 활성으로 들고 있다 — IN_PROGRESS는 그 갱신을 못 따라온 값이다.
      recordingState.sessionStartedAt = noteState.value.activeSessionStartedAt;

      renderDock(view);

      expect(screen.queryByText("다른 탭·기기에서 기록 중입니다.")).toBeNull();
    });

    // 완료를 영구 예외로 두면 낡은 로컬 세션이 남의 활성 세션을 계속 가린다.
    it("갱신이 끝났는데도 IN_PROGRESS면 남이 재개한 것으로 본다", () => {
      recordingState.activeNoteId = "01K0000000002";
      recordingState.phase = "completed";
      recordingState.sessionStatus = "COMPLETED";
      // 다른 탭이 재개해 노트의 활성 세션이 내 것과 달라졌다.
      recordingState.sessionStartedAt = "2026-07-29T09:00:00Z";

      renderDock(view);

      expect(
        screen.getByText("다른 탭·기기에서 기록 중입니다.")
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

  it.skip("제거된 공유 턴 아카이브 대기", () => {
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

    openSharedRailTab();
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
    // 레일은 상주라 아카이브로 넘어가도 그대로 선다 — 걷히는 것은 왼쪽 본문뿐이다.
    expect(screen.getByTestId("shared-chat-panel")).toBeInTheDocument();
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
