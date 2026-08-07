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
  updateWorkspace: vi.fn(),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspaceQueryKey: (id: string) => ["workspace", id],
  getGetWorkspacesQueryKey: () => ["workspaces"],
  useGetWorkspaceSuspense: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          workspaceId: "01K0000000007",
          name: "제품 팀",
          description: null,
        },
      },
    },
  }),
  useUpdateWorkspace: () => ({
    mutateAsync: mutations.updateWorkspace,
    isPending: false,
  }),
}));

vi.mock("@/lib/ui/toast", () => ({ toast }));

describe("WorkspaceSettingsForm", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mutations.updateWorkspace.mockReset();
    mutations.updateWorkspace.mockResolvedValue({ status: 200 });
    toast.error.mockReset();
    toast.success.mockReset();
  });

  /**
   * 「기본 워크스페이스로 설정」 카드가 여기 있었다. 그 명령이 사라지면서(APP-401) 이 화면은
   * 이름·설명만 다룬다 — design.pen 설정 > 일반에서도 같은 행을 지웠다.
   */
  it("기본 워크스페이스 명령을 그리지 않는다", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceSettingsForm workspaceId="01K0000000007" />
      </QueryClientProvider>
    );
    expect(
      screen.queryByRole("button", { name: "기본 워크스페이스로 설정" })
    ).toBeNull();
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
