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
  deleteWorkspace: vi.fn(),
  replace: vi.fn(),
  role: undefined as "ADMIN" | "MEMBER" | undefined,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mutations.replace }),
}));
vi.mock("@/components/transcription/recording-provider", () => ({
  isWorkspaceRecordingActive: () => false,
  useRecording: () => ({ phase: "idle", session: null }),
}));
vi.mock("@/lib/account/deletion-api", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/account/deletion-api")
  >("@/lib/account/deletion-api");
  return {
    ...actual,
    useDeleteWorkspace: () => ({
      isPending: false,
      mutateAsync: mutations.deleteWorkspace,
    }),
  };
});
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
          role: mutations.role,
        },
      },
    },
  }),
  useGetWorkspaces: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          workspaces: [
            { workspaceId: "01K0000000007" },
            { workspaceId: "01K0000000009" },
          ],
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
    mutations.deleteWorkspace.mockReset().mockResolvedValue({ status: 204 });
    mutations.replace.mockReset();
    mutations.role = undefined;
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

  const renderForm = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceSettingsForm workspaceId="01K0000000007" />
      </QueryClientProvider>
    );

  // 워크스페이스 삭제는 관리자 전용이다(PRO-69). 서버도 관리자 여부를 다시 본다.
  it("MEMBER 에게는 워크스페이스 삭제 구역이 없다", () => {
    mutations.role = "MEMBER";
    renderForm();
    expect(
      screen.queryByRole("button", { name: "워크스페이스 삭제" })
    ).toBeNull();
  });

  it("이름을 정확히 입력해야 삭제가 켜지고, 지우면 남은 워크스페이스로 간다", async () => {
    mutations.role = "ADMIN";
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "워크스페이스 삭제" }));
    const confirm = screen.getByRole("button", {
      name: "삭제",
    });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/확인하려면/), {
      target: { value: "제품" },
    });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/확인하려면/), {
      target: { value: "제품 팀" },
    });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(mutations.replace).toHaveBeenCalledWith("/w/01K0000000009")
    );
    expect(mutations.deleteWorkspace).toHaveBeenCalledWith({
      workspaceId: "01K0000000007",
      workspaceName: "제품 팀",
    });
  });
});
