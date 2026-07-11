import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "01K0000000003", name: "김민수", email: "minsu@example.com" },
  }),
}));

vi.mock("@/lib/api/generated/folder/folder", () => ({
  getListWorkspaceFoldersQueryKey: () => ["folders"],
  useCreateFolder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateFolder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteFolder: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/lib/api/generated/note/note", () => ({
  getListWorkspaceNotesQueryKey: () => ["notes"],
}));

const props = {
  workspaceId: "01K0000000000",
  workspace: {
    workspaceId: "01K0000000000",
    name: "김민수의 워크스페이스",
  },
  folders: [{ folderId: "01K0000000001", name: "주간" }],
  selectedFolderId: null,
  onSelectFolder: vi.fn(),
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

  it("selects folders and exposes accessible CRUD dialogs", () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "주간" }));
    expect(props.onSelectFolder).toHaveBeenCalledWith("01K0000000001");

    fireEvent.click(screen.getByRole("button", { name: "새 폴더" }));
    expect(
      screen.getByRole("dialog", { name: "새 폴더 만들기" })
    ).toBeInTheDocument();
  });

  it("requires confirmation before deleting a folder", async () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "주간 폴더 메뉴" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "삭제" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("주간");
  });
});
