import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("sonner", () => ({ toast: toastMock }));
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

vi.mock("@/lib/api/generated/projects/projects", () => ({
  getGetProjectsQueryKey: () => ["projects"],
  useGetProjectsSuspense: () => ({
    data: { status: 200, data: { success: true, data: { projects: [] } } },
    isPending: false,
    isError: false,
  }),
  useCreateProject: () => ({ mutateAsync: vi.fn() }),
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
  });

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

    // 셸은 캔버스 위에 흰 패널이 떠 있는 구조다 — 사이드바에는 면도 경계선도 없다.
    // 사이드바에 배경이 생기면 패널이 「떠 있는」 것으로 안 읽히고 2단 레이아웃이 된다.
    const sidebarContainer = document.querySelector(
      '[data-slot="sidebar-container"]'
    );
    expect(sidebarContainer).toHaveClass("border-r-0");
    expect(document.querySelector("main > div")).toHaveClass(
      "rounded-panel",
      "shadow-e2"
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
      // 결과는 연동 설정 화면에서 보여준다 — 모달이 아니라 라우트라서 돌아올 자리가 있다.
      expect(navState.replace).toHaveBeenCalledWith(
        "/w/01K0000000000/settings/integrations",
        { scroll: false }
      );
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
});
