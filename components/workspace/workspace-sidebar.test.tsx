import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const logout = vi.fn();
const auth = vi.hoisted(() => ({
  isLoggingOut: false,
}));
const recordingState = vi.hoisted(() => ({
  phase: "idle" as string,
  activeNoteId: undefined as string | undefined,
  session: null as null | { noteId: string },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/w/01K0000000000",
}));

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

vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recordingState,
}));

vi.mock("@/lib/api/generated/workspace-members/workspace-members", () => ({
  useGetWorkspaceMembers: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: { members: [{ userId: "01K0000000003" }, { userId: "01K1" }] },
      },
    },
  }),
}));

vi.mock("@/lib/api/generated/notifications/notifications", () => ({
  useGetNotifications: () => ({
    data: {
      status: 200,
      data: { success: true, data: { notifications: [], unreadCount: 3 } },
    },
  }),
}));

vi.mock("@/lib/api/generated/action-items/action-items", () => ({
  useGetActionItems: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          actionItems: [
            { actionItemId: "a1", dueAt: "2000-01-01T00:00:00Z" },
            { actionItemId: "a2", dueAt: null },
          ],
        },
      },
    },
  }),
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
      isDefault: false,
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
    expect(push).toHaveBeenCalledWith("/w/01K0000000007/meetings");
  });

  it("counts members, unread notifications, and overdue action items", () => {
    renderSidebar();

    expect(screen.getByText("멤버 2명")).toBeInTheDocument();
    // 배지는 「늦었다」는 뜻이다 — 기한 없는 항목은 세지 않는다.
    expect(
      screen.getByRole("button", { name: /액션 아이템\s*1/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /받은 알림\s*3/ })
    ).toBeInTheDocument();
  });

  it("surfaces the live row only while a recording is running", () => {
    const { rerender } = renderSidebar();
    expect(screen.queryByText("내가 기록 중")).toBeNull();

    recordingState.phase = "recording";
    recordingState.activeNoteId = "01K0000000002";
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <SidebarProvider>
          <WorkspaceSidebar {...props} />
        </SidebarProvider>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /기록 중인 회의/ }));
    expect(push).toHaveBeenCalledWith(
      "/w/01K0000000000/meetings/01K0000000002?view=full&tab=transcript"
    );
    recordingState.phase = "idle";
    recordingState.activeNoteId = undefined;
  });

  it("keeps logout progress visible after the profile menu closes", async () => {
    const view = renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "계정 메뉴" }));
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
