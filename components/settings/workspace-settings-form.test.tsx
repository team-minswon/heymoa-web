import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceSettingsForm } from "@/components/settings/workspace-settings-form";

const setDefaultWorkspace = vi.fn().mockResolvedValue({ status: 200 });

vi.mock("@/lib/api/generated/workspace/workspace", () => ({
  getGetWorkspaceQueryKey: (id: string) => ["workspace", id],
  getListWorkspacesQueryKey: () => ["workspaces"],
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
  useUpdateWorkspace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetDefaultWorkspace: () => ({
    mutateAsync: setDefaultWorkspace,
    isPending: false,
  }),
}));

describe("WorkspaceSettingsForm", () => {
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
      expect(setDefaultWorkspace).toHaveBeenCalledWith({
        workspaceId: "01K0000000007",
      })
    );
  });
});
