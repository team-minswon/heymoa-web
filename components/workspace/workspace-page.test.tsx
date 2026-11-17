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
  WorkspacePage,
  noteListRefetchInterval,
} from "@/components/workspace/workspace-page";

const auth = vi.hoisted(() => ({
  user: { userId: "user-me", name: "나" } as {
    userId: string;
    name: string;
  } | null,
}));
const getNotes = vi.hoisted(() => vi.fn());
const getWorkspaceNotes = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/w/01K0000000000",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: auth.user }),
}));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => ({
    phase: "idle",
    activeNoteId: undefined,
    session: null,
  }),
  useRecordingNoteId: () => null,
  useRecordingMeter: () => ({ level: 0, levelHistory: [0, 0, 0, 0, 0] }),
}));
const shell = vi.hoisted(() => ({
  selectedProjectId: "01K0000000001" as string | null,
  projects: [{ projectId: "01K0000000001", name: "모바일 앱" }] as {
    projectId: string;
    name: string;
  }[],
  openCreateProject: vi.fn(),
  requestNewMeeting: vi.fn(),
}));
vi.mock("@/components/workspace/workspace-app-shell", () => ({
  useWorkspaceShell: () => ({
    selectedProjectId: shell.selectedProjectId,
    projects: shell.projects,
    isWorkspacePending: false,
    isWorkspaceError: false,
    openCreateProject: shell.openCreateProject,
    requestNewMeeting: shell.requestNewMeeting,
  }),
}));
const NOTE_LIST = vi.hoisted(() => ({
  status: 200,
  data: {
    success: true,
    data: {
      notes: [
        {
          noteId: "01K0000000002",
          projectId: "01K0000000001",
          title: "주간 제품 회의",
          createdAt: "2026-07-10T00:00:00Z",
          updatedAt: "2026-07-11T00:00:00Z",
          lastRecordedAt: null,
          recordedDurationMs: 0,
          meetingStatus: "IN_PROGRESS",
          meetingStartedAt: "2026-07-11T00:00:00Z",
          meetingStartedBy: { userId: "user-me", name: "나" },
          participants: [],
        },
        {
          noteId: "01K0000000003",
          projectId: "01K0000000001",
          title: "리서치 공유",
          createdAt: "2026-07-09T00:00:00Z",
          updatedAt: "2026-07-10T00:00:00Z",
          lastRecordedAt: null,
          recordedDurationMs: 0,
          meetingStatus: "ENDED",
          meetingStartedAt: "2026-07-09T00:00:00Z",
          meetingStartedBy: { userId: "user-other", name: "남" },
          participants: [],
        },
      ],
      hasMore: false,
      nextSortedAt: null,
      nextNoteId: null,
    },
  },
}));

const stream = vi.hoisted(() => ({ healthy: false }));
vi.mock("@/lib/events/health", () => ({
  useEventStreamHealthy: () => stream.healthy,
}));
const listOptions = vi.hoisted(() => ({
  refetchInterval: null as null | ((notes: unknown) => number),
}));
vi.mock("@/lib/workspace/use-note-list-pages", async (original) => {
  const actual =
    await original<typeof import("@/lib/workspace/use-note-list-pages")>();
  return {
    ...actual,
    useNoteListPages: (
      options: Parameters<typeof actual.useNoteListPages>[0]
    ) => {
      listOptions.refetchInterval = options.refetchInterval as (
        notes: unknown
      ) => number;
      return actual.useNoteListPages(options);
    },
  };
});

vi.mock("@/lib/api/generated/notes/notes", () => ({
  getGetNotesQueryKey: (projectId: string) => [
    `/v1/projects/${projectId}/notes`,
  ],
  getGetWorkspaceNotesQueryKey: (workspaceId: string) => [
    `/v1/workspaces/${workspaceId}/notes`,
  ],
  useDeleteNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  getNotes: (...args: unknown[]) => getNotes(...args),
  getWorkspaceNotes: (...args: unknown[]) => getWorkspaceNotes(...args),
}));

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <WorkspacePage workspaceId="01K0000000000" />
    </QueryClientProvider>
  );
}

describe("WorkspacePage", () => {
  beforeEach(() => {
    getNotes.mockResolvedValue(NOTE_LIST);
    getWorkspaceNotes.mockResolvedValue(NOTE_LIST);
  });

  afterEach(() => {
    cleanup();
    getNotes.mockReset();
    getWorkspaceNotes.mockReset();
    auth.user = { userId: "user-me", name: "나" };
    shell.selectedProjectId = "01K0000000001";
    shell.projects = [{ projectId: "01K0000000001", name: "모바일 앱" }];
    shell.openCreateProject.mockReset();
    shell.requestNewMeeting.mockReset();
  });

  it("네이티브 스크롤 컨테이너가 아니라 ScrollArea로 스크롤한다", async () => {
    const { container } = renderPage();

    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]'
    );
    expect(viewport).not.toBeNull();
    expect(container.querySelector(".overflow-y-auto")).toBeNull();

    // `!` 가 필요합니다. base-ui 가 뷰포트에 `overflow: scroll` 을 인라인으로 넣습니다.
    expect(viewport?.className).toContain("overflow-x-hidden!");
  });

  it("프로젝트가 없으면 제목을 걷고 절차를 그린다", () => {
    shell.selectedProjectId = null;
    shell.projects = [];
    renderPage();

    const onboarding = screen.getByTestId("workspace-onboarding");
    expect(onboarding).toHaveAttribute("data-stage", "no-project");
    expect(screen.queryByText(/개의 회의 기록/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "첫 프로젝트 만들기" }));
    expect(shell.openCreateProject).toHaveBeenCalledOnce();
    expect(shell.requestNewMeeting).not.toHaveBeenCalled();
  });

  it("renders the screen title, count, and flat list without the marketing kicker", async () => {
    renderPage();
    await screen.findByText("주간 제품 회의");

    expect(
      screen.getByRole("heading", { name: "모바일 앱" })
    ).toBeInTheDocument();
    expect(screen.getByText(/2개의 회의 기록/)).toBeInTheDocument();
    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(screen.getByText("리서치 공유")).toBeInTheDocument();
    expect(screen.queryByText("Meeting notes")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /새 회의 기록|새 노트/ })
    ).toBeNull();
  });

  it("시작자 필터 없이 모든 노트를 그린다", async () => {
    renderPage();
    await screen.findByText("주간 제품 회의");

    expect(screen.queryByRole("group", { name: "노트 필터" })).toBeNull();
    expect(screen.queryByRole("button", { name: "내가 시작" })).toBeNull();
    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(screen.getByText("리서치 공유")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "일시정지됨" })).toBeNull();
    expect(getNotes).toHaveBeenCalled();
    for (const [, params] of getNotes.mock.calls) {
      expect(params).not.toHaveProperty("meetingStatus");
    }
  });

  it("polls active lists every 10 seconds and inactive lists every 30 seconds", () => {
    const notes = (meetingStatus: "IN_PROGRESS" | "ENDED") =>
      [
        {
          meetingStatus,
          meetingStartedAt:
            meetingStatus === "IN_PROGRESS" ? "2026-07-11T00:00:00Z" : null,
          meetingStartedBy:
            meetingStatus === "IN_PROGRESS"
              ? { userId: "user-other", name: "남" }
              : null,
        },
      ] as Parameters<typeof noteListRefetchInterval>[0];

    expect(noteListRefetchInterval(notes("IN_PROGRESS"))).toBe(10_000);
    expect(noteListRefetchInterval(notes("ENDED"))).toBe(30_000);
  });

  it("이벤트 스트림이 건강하면 노트 목록 폴링은 60초 안전망, 끊기면 원래 10/30초로 돈다", async () => {
    const active = [
      {
        meetingStatus: "IN_PROGRESS",
        meetingStartedAt: "2026-07-11T00:00:00Z",
        meetingStartedBy: { userId: "user-other", name: "남" },
      },
    ];
    stream.healthy = true;
    renderPage();
    await screen.findByText("주간 제품 회의");
    expect(listOptions.refetchInterval?.(active)).toBe(60_000);
    cleanup();

    stream.healthy = false;
    renderPage();
    await screen.findByText("주간 제품 회의");
    expect(listOptions.refetchInterval?.(active)).toBe(10_000);
    expect(listOptions.refetchInterval?.([])).toBe(30_000);
  });

  describe("더 보기", () => {
    const row = (noteId: string, title: string, startedAt: string) => ({
      ...NOTE_LIST.data.data.notes[1],
      noteId,
      title,
      meetingStartedAt: startedAt,
      createdAt: startedAt,
    });
    const firstPage = {
      status: 200,
      headers: new Headers(),
      data: {
        success: true,
        error: null,
        data: {
          notes: [row("01K0000000010", "최근 회의", "2026-07-12T00:00:00Z")],
          hasMore: true,
          nextSortedAt: "2026-07-12T00:00:00Z",
          nextNoteId: "01K0000000010",
        },
      },
    };
    const secondPage = {
      status: 200,
      headers: new Headers(),
      data: {
        success: true,
        error: null,
        data: {
          notes: [row("01K0000000009", "옛 회의", "2026-07-01T00:00:00Z")],
          hasMore: false,
          nextSortedAt: null,
          nextNoteId: null,
        },
      },
    };

    it("뒤에 더 있으면 개수를 이상으로 말하고 버튼을 둔다", async () => {
      getNotes.mockResolvedValue(firstPage);
      renderPage();

      await screen.findByText("최근 회의");
      expect(screen.getByText(/1개 이상의 회의 기록/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "이전 기록 더 보기" })
      ).toBeInTheDocument();
      expect(getNotes.mock.calls[0]?.[1]).toEqual({ limit: "30" });
    });

    it("누르면 커서를 달아 이어 읽고 앞쪽에 붙이며, 다 읽으면 버튼이 사라진다", async () => {
      getNotes.mockImplementation(
        async (_projectId: string, params: { afterNoteId?: string }) =>
          params.afterNoteId ? secondPage : firstPage
      );
      renderPage();

      fireEvent.click(
        await screen.findByRole("button", { name: "이전 기록 더 보기" })
      );

      await screen.findByText("옛 회의");
      expect(screen.getByText("최근 회의")).toBeInTheDocument();
      expect(screen.getByText(/2개의 회의 기록/)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "이전 기록 더 보기" })
      ).toBeNull();
      expect(getNotes).toHaveBeenCalledWith(
        "01K0000000001",
        {
          limit: "30",
          afterSortedAt: "2026-07-12T00:00:00Z",
          afterNoteId: "01K0000000010",
        },
        expect.anything()
      );
    });

    it("더 읽다 실패하면 이미 보던 목록은 그대로 두고 다시 누를 수 있다", async () => {
      getNotes.mockImplementation(
        async (_projectId: string, params: { afterNoteId?: string }) => {
          if (params.afterNoteId) throw new Error("network");
          return firstPage;
        }
      );
      renderPage();

      fireEvent.click(
        await screen.findByRole("button", { name: "이전 기록 더 보기" })
      );

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "이전 기록 더 보기" })
        ).toBeEnabled()
      );
      expect(screen.getByText("최근 회의")).toBeInTheDocument();
    });
  });
});
