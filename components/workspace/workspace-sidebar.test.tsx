import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const logout = vi.fn();
const auth = vi.hoisted(() => ({
  isLoggingOut: false,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "01K0000000003", name: "김민수", email: "minsu@example.com" },
    isLoggingOut: auth.isLoggingOut,
    logout,
  }),
}));

vi.mock("@/lib/api/generated/projects/projects", () => ({
  getGetProjectsQueryKey: () => ["projects"],
  useCreateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
              isDefault: true,
            },
            { workspaceId: "01K0000000007", name: "제품 팀", isDefault: false },
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
    isDefault: true,
    role: "ADMIN" as const,
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
};

function renderSidebar() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <SidebarProvider>
        <WorkspaceSidebar {...props} />
      </SidebarProvider>
    </QueryClientProvider>
  );
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
  });

  it("selects projects and exposes accessible CRUD dialogs", () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "주간" }));
    expect(props.onSelectProject).toHaveBeenCalledWith("01K0000000001");

    fireEvent.click(screen.getByRole("button", { name: "새 프로젝트" }));
    expect(
      screen.getByRole("dialog", { name: "새 프로젝트 만들기" })
    ).toBeInTheDocument();
  });

  it("requires confirmation before deleting a project", async () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "주간 프로젝트 메뉴" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "삭제" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("주간");
  });

  it("switches workspace", async () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "워크스페이스 전환" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /제품 팀/ }));
    expect(push).toHaveBeenCalledWith("/w/01K0000000007");
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
