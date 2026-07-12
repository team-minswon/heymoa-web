import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { WorkspaceAppShell } from "@/components/workspace/workspace-app-shell";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
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
}));

vi.mock("@/lib/api/generated/workspace/workspace", () => ({
  getListWorkspacesQueryKey: () => ["workspaces"],
  useListWorkspaces: () => ({
    data: { status: 200, data: { success: true, data: { items: [] } } },
  }),
  useCreateWorkspace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetWorkspace: () => ({
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
  }),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { name: "김민수", email: "minsu@example.com" } }),
}));

vi.mock("@/lib/api/generated/folder/folder", () => ({
  getListWorkspaceFoldersQueryKey: () => ["folders"],
  useListWorkspaceFolders: () => ({
    data: { status: 200, data: { success: true, data: [] } },
  }),
  useCreateFolder: () => ({ mutateAsync: vi.fn() }),
  useUpdateFolder: () => ({ mutateAsync: vi.fn() }),
  useDeleteFolder: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/lib/api/generated/note/note", () => ({
  getListWorkspaceNotesQueryKey: () => ["notes"],
  useCreateNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("WorkspaceAppShell", () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
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

    const sidebarContainer = document.querySelector(
      '[data-slot="sidebar-container"]'
    );
    expect(sidebarContainer).toHaveClass("rounded-r-2xl", "overflow-hidden");
  });
});
