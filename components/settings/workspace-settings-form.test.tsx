import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSettingsForm } from "@/components/settings/workspace-settings-form";

const mutations = vi.hoisted(() => ({
  changeDefaultWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspaceQueryKey: (id: string) => ["workspace", id],
  getGetWorkspacesQueryKey: () => ["workspaces"],
  useGetWorkspace: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          workspaceId: "01K0000000007",
          name: "제품 팀",
          description: null,
          isDefault: false,
        },
      },
    },
  }),
  useUpdateWorkspace: () => ({
    mutateAsync: mutations.updateWorkspace,
    isPending: false,
  }),
  useChangeDefaultWorkspace: () => ({
    mutateAsync: mutations.changeDefaultWorkspace,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({ toast }));

describe("WorkspaceSettingsForm", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mutations.changeDefaultWorkspace.mockReset();
    mutations.updateWorkspace.mockReset();
    mutations.changeDefaultWorkspace.mockResolvedValue({ status: 200 });
    mutations.updateWorkspace.mockResolvedValue({ status: 200 });
    toast.error.mockReset();
    toast.success.mockReset();
  });

  it("changes default only through the explicit command", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceSettingsForm workspaceId="01K0000000007" />
      </QueryClientProvider>
    );
    fireEvent.click(
      screen.getByRole("button", { name: "기본 워크스페이스로 설정" })
    );
    await waitFor(() =>
      expect(mutations.changeDefaultWorkspace).toHaveBeenCalledWith({
        data: { workspaceId: "01K0000000007" },
      })
    );
    expect(toast.success).toHaveBeenCalledWith(
      "기본 워크스페이스로 설정했습니다.",
      { id: "workspace-settings-default" }
    );
  });

  it("reports save failures through Sonner without adding page feedback", async () => {
    mutations.updateWorkspace.mockRejectedValueOnce(new Error("network"));

    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceSettingsForm workspaceId="01K0000000007" />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByLabelText("워크스페이스 이름")).toHaveValue("제품 팀")
    );
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "워크스페이스 정보를 저장하지 못했습니다.",
        { id: "workspace-settings-save" }
      )
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
