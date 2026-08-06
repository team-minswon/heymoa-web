import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceAppShell } from "@/components/workspace/workspace-app-shell";

const navState = vi.hoisted(() => ({
  params: new URLSearchParams(""),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: navState.replace }),
  useSearchParams: () => navState.params,
  usePathname: () => "/w/01K0000000000",
}));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/ui/toast", () => ({ toast: toastMock }));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => ({
    session: null,
    elapsedMs: 0,
    error: null,
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
  }),
  useRecordingMeter: () => ({
    level: 0,
    levelHistory: [0, 0, 0, 0],
  }),
}));

vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspacesQueryKey: () => ["workspaces"],
  useGetWorkspaces: () => ({
    data: { status: 200, data: { success: true, data: { workspaces: [] } } },
  }),
  useCreateWorkspace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetWorkspaceSuspense: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          workspaceId: "01K0000000000",
          name: "김민수의 워크스페이스",
        },
      },
    },
    isPending: false,
    isError: false,
  }),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { name: "김민수", email: "minsu@example.com" } }),
}));

const projectState = vi.hoisted(() => ({
  projects: [] as { projectId: string; name: string }[],
  create: vi.fn(),
}));
vi.mock("@/lib/api/generated/projects/projects", () => ({
  getGetProjectsQueryKey: () => ["projects"],
  useGetProjectsSuspense: () => ({
    data: {
      status: 200,
      data: { success: true, data: { projects: projectState.projects } },
    },
    isPending: false,
    isError: false,
  }),
  useCreateProject: () => ({
    mutateAsync: projectState.create,
    isPending: false,
  }),
  useUpdateProject: () => ({ mutateAsync: vi.fn() }),
  useDeleteProject: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/lib/api/generated/notes/notes", () => ({
  getGetNotesQueryKey: () => ["notes"],
  useCreateNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetNote: () => ({ data: undefined }),
}));

describe("WorkspaceAppShell", () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  beforeEach(() => {
    navState.params = new URLSearchParams("");
    navState.replace.mockClear();
    toastMock.success.mockClear();
    toastMock.error.mockClear();
    projectState.projects = [];
    projectState.create.mockReset();
    projectState.create.mockResolvedValue({
      status: 201,
      data: { success: true, data: { projectId: "01K0000000001" } },
    });
  });

  // 이 파일은 셸을 통째로 마운트한다 — 안 치우면 앞 테스트가 남긴 트리의 입력이
  // `screen` 질의에 함께 걸려서 "창이 닫혔는가"를 물을 수 없다.
  afterEach(cleanup);

  it("renders one app navigation and a main content region", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <WorkspaceAppShell workspaceId="01K0000000000">
          <p>노트 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    expect(
      screen.getByRole("navigation", { name: "워크스페이스" })
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("노트 목록");
    expect(screen.getAllByText("김민수의 워크스페이스")).not.toHaveLength(0);

    // 셸이 캔버스를 꽉 채우지 않는다 — 사이드바는 캔버스 위에 그냥 앉고(배경·테두리 없음)
    // 본문만 둥근 흰 패널로 뜬다(design.pen `IUax1`). 예전에는 사이드바에 `border-r`이 있어
    // 두 면이 한 셸처럼 붙어 있었다.
    const sidebarContainer = document.querySelector(
      '[data-slot="sidebar-container"]'
    );
    expect(sidebarContainer).toHaveClass("overflow-hidden", "bg-transparent");
    expect(sidebarContainer?.className).not.toMatch(/(^|\s|:)border-r(\s|$)/);

    const panel = screen
      .getByRole("main")
      .closest("[data-slot='sidebar-inset']")
      ?.querySelector(".rounded-panel");
    expect(panel).not.toBeNull();
    expect(panel).toHaveClass(
      "rounded-panel",
      "border",
      "border-[var(--el-hairline)]"
    );
  });

  it("OAuth 복귀 쿼리로 연동 결과 토스트를 띄우고 쿼리를 지운다", async () => {
    navState.params = new URLSearchParams("provider=LINEAR&status=connected");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceAppShell workspaceId="01K0000000000">
          <p>노트 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith(
        "Linear 연동을 연결했습니다."
      );
      expect(navState.replace).toHaveBeenCalledWith("/w/01K0000000000", {
        scroll: false,
      });
    });
  });

  it("status가 connected가 아니면 실패 토스트를 띄운다", async () => {
    navState.params = new URLSearchParams("provider=GITHUB&status=error");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceAppShell workspaceId="01K0000000000">
          <p>노트 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "연동 연결에 실패했습니다. 잠시 후 다시 시도해 주세요."
      );
    });
  });
  /**
   * 프로젝트가 없는 워크스페이스에서 「새 노트」를 누르면 **프로젝트를 먼저 묻고, 만든 뒤
   * 회의 창으로 이어진다.** 예전에는 그 버튼이 그냥 비활성이었고, 유일한 입구인 사이드바
   * 「프로젝트 만들기」는 절차의 1단계로 읽히지 않았다.
   */
  it("프로젝트가 없으면 새 노트가 프로젝트 만들기부터 이어 붙인다", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceAppShell workspaceId="01K0000000000">
          <p>노트 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "새 노트" }));
    // 회의 이름이 아니라 프로젝트 이름을 먼저 묻는다.
    expect(
      screen.getByRole("dialog", { name: "첫 프로젝트 만들기" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("회의 이름")).toBeNull();

    fireEvent.change(screen.getByLabelText("프로젝트 이름"), {
      target: { value: "주간" },
    });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));

    await waitFor(() => {
      expect(projectState.create).toHaveBeenCalledWith({
        workspaceId: "01K0000000000",
        data: { name: "주간", description: null },
      });
      // 절차가 끊기지 않는다 — 프로젝트를 만들면 회의 창이 바로 이어진다.
      expect(screen.getByLabelText("회의 이름")).toBeInTheDocument();
    });
  });

  it("프로젝트가 있으면 새 노트가 곧장 회의 이름을 묻는다", () => {
    projectState.projects = [{ projectId: "01K0000000001", name: "주간" }];
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceAppShell workspaceId="01K0000000000">
          <p>노트 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "새 노트" }));

    expect(screen.getByLabelText("회의 이름")).toBeInTheDocument();
    expect(screen.queryByLabelText("프로젝트 이름")).toBeNull();
  });

  it("전체 노트 화면이 셸을 덮으면 열려 있던 만들기 창을 닫는다", () => {
    // 창은 포털(`z-50`)이라 `inert`도 덮는 면(`z-30`)도 닿지 않는다. 셸은 노트로 이동해도
    // 재마운트되지 않으니 저절로 사라지지도 않아, 허브에서 열어 둔 창이 노트 위에 남았다.
    projectState.projects = [{ projectId: "01K0000000001", name: "주간" }];
    const { rerender } = render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceAppShell workspaceId="01K0000000000">
          <p>노트 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "새 노트" }));
    expect(screen.getByLabelText("회의 이름")).toBeInTheDocument();

    navState.params = new URLSearchParams("view=full");
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceAppShell workspaceId="01K0000000000" activeNoteId="01K0000000002">
          <p>노트 목록</p>
        </WorkspaceAppShell>
      </QueryClientProvider>
    );

    expect(screen.queryByLabelText("회의 이름")).toBeNull();
  });
});
