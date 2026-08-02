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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspaceQueryKey: (id: string) => ["workspace", id],
  getGetWorkspacesQueryKey: () => ["workspaces"],
  useDeleteWorkspace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetWorkspaceSuspense: () => ({
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

  it("changes default through the row switch", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceSettingsForm workspaceId="01K0000000007" />
      </QueryClientProvider>
    );
    // 저장 버튼이 없다 — 스위치를 켜는 것이 곧 명령이다(design.pen).
    fireEvent.click(screen.getByRole("switch", { name: "기본 워크스페이스" }));
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
    // 값을 떠나면 저장한다 — 누를 버튼이 없다.
    const name = screen.getByLabelText("워크스페이스 이름");
    fireEvent.change(name, { target: { value: "제품 팀 2" } });
    fireEvent.blur(name);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "워크스페이스 정보를 저장하지 못했습니다.",
        { id: "workspace-settings-save" }
      )
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("빈 이름은 저장하지 않고 왜 안 갔는지를 그 자리에 적는다", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceSettingsForm workspaceId="01K0000000007" />
      </QueryClientProvider>
    );
    await waitFor(() =>
      expect(screen.getByLabelText("워크스페이스 이름")).toHaveValue("제품 팀")
    );

    const name = screen.getByLabelText("워크스페이스 이름");
    fireEvent.change(name, { target: { value: "  " } });
    fireEvent.blur(name);

    // 화면이 「변경은 바로 저장됩니다」라고 말하므로, 조용히 안 보내면 저장된 줄 안다.
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "워크스페이스 이름을 입력해 주세요."
      )
    );
    expect(mutations.updateWorkspace).not.toHaveBeenCalled();
  });

  it("연속 blur 저장이 겹치지 않고 마지막 값이 마지막에 쓰인다", async () => {
    // 둘 다 폼 전체를 보낸다. 겹쳐서 응답이 역순으로 오면 먼저 보낸 옛 값이 최종값이 된다.
    // 그래서 **완료 순서**를 본다 — 겹치면 start 둘이 붙어 찍힌다.
    const order: string[] = [];
    mutations.updateWorkspace.mockImplementation(async () => {
      order.push("start");
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push("end");
      return { status: 200 };
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspaceSettingsForm workspaceId="01K0000000007" />
      </QueryClientProvider>
    );
    await waitFor(() =>
      expect(screen.getByLabelText("워크스페이스 이름")).toHaveValue("제품 팀")
    );

    const name = screen.getByLabelText("워크스페이스 이름");
    fireEvent.change(name, { target: { value: "제품 팀 A" } });
    fireEvent.blur(name);

    const description = screen.getByLabelText("워크스페이스 설명");
    fireEvent.change(description, { target: { value: "설명 B" } });
    fireEvent.blur(description);

    await waitFor(() =>
      expect(mutations.updateWorkspace).toHaveBeenCalledTimes(2)
    );
    await waitFor(() => expect(order).toHaveLength(4));
    // 직렬이면 start·end 가 짝지어 나온다. 겹치면 start 둘이 연달아 찍히고,
    // 그때 응답이 역순으로 오면 먼저 보낸 옛 값이 최종값이 된다.
    expect(order).toEqual(["start", "end", "start", "end"]);
  });
});
