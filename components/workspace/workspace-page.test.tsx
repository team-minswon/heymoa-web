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

// 목록 행이 이동 진행 표시를 위해 경로·쿼리를 읽는다(APP-215).
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

vi.mock("@/lib/api/generated/notes/notes", () => ({
  // 행이 삭제 다이얼로그를 그리므로 그 훅도 목에 있어야 한다.
  getGetNotesQueryKey: (projectId: string) => [
    `/v1/projects/${projectId}/notes`,
  ],
  getGetWorkspaceNotesQueryKey: (workspaceId: string) => [
    `/v1/workspaces/${workspaceId}/notes`,
  ],
  useDeleteNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  getNotes: (...args: unknown[]) => getNotes(...args),
  /** **팬아웃이 사라진 자리** (APP-685). 워크스페이스 단위 조회 하나다. */
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

  /**
   * **목록은 `ScrollArea`로 스크롤한다.** 네이티브 스크롤바는 폭을 먹어서, 목록이 도착해
   * 스크롤이 생기는 순간 본문이 스크롤바만큼 좁아졌다 — 로딩 직후 폭이 튀는 것이 그것이다.
   * 게다가 이 컨테이너는 `rounded-panel` + `overflow-hidden` 패널 안이라 네이티브 바가 둥근
   * 모서리에 붙어 잘린 채 그려졌다.
   *
   * jsdom은 px를 못 재니 **어느 컨테이너로 스크롤하는지**로 검사한다.
   */
  it("네이티브 스크롤 컨테이너가 아니라 ScrollArea로 스크롤한다", async () => {
    const { container } = renderPage();

    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]'
    );
    expect(viewport).not.toBeNull();
    // 네이티브 세로 스크롤러가 남아 있으면 폭 시프트가 그대로다.
    expect(container.querySelector(".overflow-y-auto")).toBeNull();

    // **가로는 뷰포트에서 잘라야 한다.** 장식 블롭이 콘텐츠 상자 밖으로 나가 가로 스크롤을
    // 만드는데(1026 폭에서 31px 실측) 세로 바만 그리므로 손잡이 없는 스크롤이 된다.
    // `!`가 붙어야 한다 — base-ui가 뷰포트에 `overflow: scroll`을 인라인으로 박는다.
    expect(viewport?.className).toContain("overflow-x-hidden!");
  });

  /**
   * 프로젝트가 하나도 없으면 제목·개수가 군더더기다 — 「0개의 회의 기록」은 셀 것이 있다는
   * 뜻인데 여기엔 아무것도 없고, 지금 필요한 것은 무엇을 먼저 해야 하는가 하나다
   * (design.pen `kbUlG`).
   */
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
    // v5: 제품 면 대문자 키커 금지, 새 노트 진입점은 상단바(헤더 CTA 없음).
    expect(screen.queryByText("Meeting notes")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /새 회의 기록|새 노트/ })
    ).toBeNull();
  });

  /**
   * **목록에 필터가 없다.** 「전체 / 내가 시작」이었는데 시작자로 걸러 보는 요구가 실제로
   * 없었고, 「내가 시작」을 걷으면 남는 칩이 「전체」 하나라 고르는 것이 아니게 된다 —
   * 줄을 통째로 없앴다. 시작자는 각 행의 아바타가 이미 말한다.
   */
  it("시작자 필터 없이 모든 노트를 그린다", async () => {
    renderPage();
    await screen.findByText("주간 제품 회의");

    expect(screen.queryByRole("group", { name: "노트 필터" })).toBeNull();
    expect(screen.queryByRole("button", { name: "내가 시작" })).toBeNull();
    // 내가 시작한 것(주간 제품 회의)과 남이 시작한 것(리서치 공유)이 함께 선다.
    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(screen.getByText("리서치 공유")).toBeInTheDocument();
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

  /**
   * **목록은 한 쪽(30개)씩 읽는다** (APP-1019). 서버가 「뒤에 더 있다」고 하면 목록 끝에 버튼이 서고,
   * 누르면 **커서를 달고 이어 읽어** 앞쪽에 붙인다. 개수는 「이상」으로 말한다 — 아직 다 안 읽었다.
   */
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
      // 첫 쪽은 limit 만 보낸다. 커서는 없다.
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
      // 이어 읽는 요청은 응답의 다음 커서를 그대로 보낸다.
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

      // 읽은 곳까지만 보이고 남은 커서가 그대로라 버튼이 되살아난다.
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "이전 기록 더 보기" })
        ).toBeEnabled()
      );
      expect(screen.getByText("최근 회의")).toBeInTheDocument();
    });
  });
});
