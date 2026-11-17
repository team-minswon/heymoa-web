import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const logout = vi.fn();
const auth = vi.hoisted(() => ({
  isLoggingOut: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/w/01K0000000000",
  useSearchParams: () => new URLSearchParams(),
}));

import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("@/components/auth/auth-provider", () => ({
  useAuthUserId: () => "01K0000000003",
  useAuth: () => ({
    user: { id: "01K0000000003", name: "김민수", email: "minsu@example.com" },
    isLoggingOut: auth.isLoggingOut,
    logout,
  }),
}));

const projectApi = vi.hoisted(() => ({
  updateMock: vi.fn(),
}));

vi.mock("@/lib/api/generated/projects/projects", () => ({
  getGetProjectsQueryKey: () => ["projects"],
  useCreateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProject: () => ({
    mutateAsync: projectApi.updateMock,
    isPending: false,
  }),
  useDeleteProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/lib/api/generated/notes/notes", () => ({
  getGetNotesQueryKey: () => ["notes"],
}));

vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspacesQueryKey: () => ["workspaces"],
  useGetWorkspaces: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          workspaces: [
            {
              workspaceId: "01K0000000000",
              name: "김민수의 워크스페이스",
            },
            { workspaceId: "01K0000000007", name: "제품 팀" },
          ],
        },
      },
    },
  }),
  useCreateWorkspace: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const props = {
  workspaceId: "01K0000000000",
  workspace: {
    workspaceId: "01K0000000000",
    name: "김민수의 워크스페이스",
    description: null,
    role: "ADMIN" as "ADMIN" | "MEMBER",
    agentAccessAllowed: true,
  },
  projects: [
    {
      projectId: "01K0000000001",
      name: "주간",
      workspaceId: "01K0000000000",
      description: null,
      createdAt: "",
      updatedAt: "",
    },
  ],
  selectedProjectId: null,
  onSelectProject: vi.fn(),
  onOpenSettings: vi.fn(),
  onCreateProject: vi.fn(),
};

function renderSidebar(overrides: Partial<typeof props> = {}) {
  const client = new QueryClient();
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <SidebarProvider>
          <WorkspaceSidebar {...props} {...overrides} />
        </SidebarProvider>
      </QueryClientProvider>
    ),
  };
}

function projectsResponse(name: string) {
  return {
    status: 200 as const,
    data: {
      success: true as const,
      data: {
        projects: [{ ...props.projects[0], name }],
      },
    },
  };
}

describe("WorkspaceSidebar", () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
    auth.isLoggingOut = false;
    logout.mockReset();
    window.localStorage.clear();
  });

  it("프로젝트가 없으면 라벨 있는 만들기 입구를 낸다", () => {
    const onCreateProject = vi.fn();
    renderSidebar({ projects: [], onCreateProject });

    fireEvent.click(screen.getByRole("button", { name: "프로젝트 만들기" }));
    expect(onCreateProject).toHaveBeenCalledOnce();
  });

  it("프로젝트가 있으면 빈 상태를 안 낸다", () => {
    renderSidebar();

    expect(
      screen.queryByRole("button", { name: "프로젝트 만들기" })
    ).toBeNull();
    expect(screen.getByRole("button", { name: "주간" })).toBeTruthy();
  });

  it("selects projects and exposes accessible CRUD dialogs", () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "주간" }));
    expect(props.onSelectProject).toHaveBeenCalledWith("01K0000000001");

    fireEvent.click(screen.getByRole("button", { name: "새 프로젝트" }));
    expect(props.onCreateProject).toHaveBeenCalledOnce();
  });

  it("이름 변경 응답을 목록 캐시에 바로 써 넣고 기다리지 않고 닫는다", async () => {
    projectApi.updateMock.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: { ...props.projects[0], name: "주간 회의" },
      },
    });
    const { client } = renderSidebar();
    client.setQueryData(["projects"], projectsResponse("주간"));

    fireEvent.click(screen.getByRole("button", { name: "주간 프로젝트 메뉴" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "이름 변경" }));

    const input = await screen.findByLabelText("프로젝트 이름");
    fireEvent.change(input, { target: { value: "주간 회의" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      const cached = client.getQueryData(["projects"]) as ReturnType<
        typeof projectsResponse
      >;
      expect(cached.data.data.projects[0].name).toBe("주간 회의");
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "프로젝트 이름 변경" })
      ).toBeNull()
    );
  });

  it("requires confirmation before deleting a project", async () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "주간 프로젝트 메뉴" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "삭제" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("주간");
  });

  it("멤버에게는 프로젝트 삭제 메뉴를 두지 않는다", async () => {
    renderSidebar({ workspace: { ...props.workspace, role: "MEMBER" } });

    fireEvent.click(screen.getByRole("button", { name: "주간 프로젝트 메뉴" }));
    await screen.findByRole("menuitem", { name: "이름 변경" });

    expect(screen.queryByRole("menuitem", { name: "삭제" })).toBeNull();
  });

  it("switches workspace", async () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "워크스페이스 전환" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /제품 팀/ }));
    expect(push).toHaveBeenCalledWith("/w/01K0000000007");
  });

  it("마지막으로 방문한 워크스페이스를 목록 맨 위에 둔다", async () => {
    window.localStorage.setItem("heymoa:last-workspace", "01K0000000007");
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "워크스페이스 전환" }));
    await screen.findByRole("menuitem", { name: /제품 팀/ });

    const items = screen
      .getAllByRole("menuitem")
      .slice(0, 2)
      .map((item) => item.textContent);
    expect(items).toEqual(["제품 팀", "김민수의 워크스페이스"]);
  });

  it("기억이 없으면 서버 순서를 그대로 둔다", async () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "워크스페이스 전환" }));
    await screen.findByRole("menuitem", { name: /제품 팀/ });

    const items = screen
      .getAllByRole("menuitem")
      .slice(0, 2)
      .map((item) => item.textContent);
    expect(items).toEqual(["김민수의 워크스페이스", "제품 팀"]);
  });

  it("puts the workspace switcher in the header and the user profile in the footer", () => {
    const { container } = renderSidebar();

    const header = container.querySelector('[data-slot="sidebar-header"]');
    expect(header).toContainElement(
      screen.getByRole("button", { name: "워크스페이스 전환" })
    );

    const footer = container.querySelector('[data-slot="sidebar-footer"]');
    const profile = screen.getByRole("button", {
      name: /김민수 minsu@example.com/,
    });
    expect(footer).toContainElement(profile);
    expect(profile.querySelector("svg.lucide-settings")).toBeInTheDocument();
  });

  it("keeps logout progress visible after the profile menu closes", async () => {
    const view = renderSidebar();
    fireEvent.click(
      screen.getByRole("button", {
        name: /김민수 minsu@example.com/,
      })
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "로그아웃" }));
    expect(logout).toHaveBeenCalledOnce();

    auth.isLoggingOut = true;
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <SidebarProvider>
          <WorkspaceSidebar {...props} />
        </SidebarProvider>
      </QueryClientProvider>
    );

    expect(screen.getByRole("button", { name: "로그아웃 중" })).toBeDisabled();
    expect(screen.getByText("잠시만 기다려 주세요")).toBeInTheDocument();
  });
});
