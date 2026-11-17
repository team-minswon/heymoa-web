import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceIntegrationsSettings } from "@/components/settings/workspace-integrations-settings";

const toast = vi.hoisted(() => ({ error: vi.fn() }));
const refresh = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/lib/ui/toast", () => ({ toast }));
vi.mock("@/lib/mocks/enable-mocking", () => ({
  shouldEnableMocking: () => false,
}));
vi.mock("@/lib/api/fetcher", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/fetcher")>()),
  refreshAuthOnce: refresh.run,
}));

const WORKSPACE_ID = "01K0000000000";

const state = vi.hoisted(() => ({
  myRole: "ADMIN" as "ADMIN" | "MEMBER" | null,
  membersLoaded: true,
  membersError: false,
  integrations: [] as unknown[],
  integrationsLoading: false,
  integrationsError: false,
  disconnectMock: vi.fn(),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { userId: "user-12345", name: "테스트 유저" } }),
}));
vi.mock(
  "@/lib/api/generated/workspace-integration/workspace-integration",
  () => ({
    getGetWorkspaceIntegrationsQueryKey: (id: string) => ["integrations", id],
    useGetWorkspaceIntegrations: () => ({
      isLoading: state.integrationsLoading,
      isError: state.integrationsError,
      refetch: vi.fn(),
      data: state.integrationsError
        ? undefined
        : {
            status: 200,
            data: { success: true, data: { integrations: state.integrations } },
          },
    }),
    useDisconnectWorkspaceIntegration: () => ({
      mutate: state.disconnectMock,
      isPending: false,
      variables: undefined,
    }),
  })
);
vi.mock("@/lib/api/generated/workspace-members/workspace-members", () => ({
  useGetWorkspaceMembers: () => ({
    isError: state.membersError,
    refetch: vi.fn(),
    data: state.membersError
      ? undefined
      : state.membersLoaded
        ? {
            status: 200,
            data: {
              success: true,
              data: {
                members: state.myRole
                  ? [
                      {
                        userId: "user-12345",
                        role: state.myRole,
                        name: "테스트 유저",
                      },
                    ]
                  : [],
              },
            },
          }
        : undefined,
  }),
}));

function linear(connected: boolean) {
  return {
    provider: "LINEAR",
    connected,
    connectedBy: connected ? "김민수" : null,
    connectedAt: connected ? "2026-06-02T00:00:00Z" : null,
  };
}
function github(connected: boolean) {
  return {
    provider: "GITHUB",
    connected,
    connectedBy: null,
    connectedAt: null,
  };
}

function renderPanel(client = new QueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceIntegrationsSettings workspaceId={WORKSPACE_ID} />
    </QueryClientProvider>
  );
}

describe("WorkspaceIntegrationsSettings", () => {
  beforeEach(() => {
    state.myRole = "ADMIN";
    state.membersLoaded = true;
    state.membersError = false;
    state.integrations = [linear(true), github(false)];
    state.integrationsLoading = false;
    state.integrationsError = false;
    state.disconnectMock.mockReset();
    toast.error.mockReset();
    refresh.run.mockReset();
  });
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "heymoaDesktop");
  });

  function desktop(bridge: object) {
    Object.defineProperty(window, "heymoaDesktop", {
      value: bridge,
      configurable: true,
    });
  }

  it("두 provider가 항상 렌더되고 연결 상태를 보인다", () => {
    renderPanel();
    expect(screen.getByText("Linear")).toBeTruthy();
    expect(screen.getByText("GitHub")).toBeTruthy();
    expect(screen.getByText("연결됨")).toBeTruthy();
    expect(screen.getByText("연결되지 않음")).toBeTruthy();
    expect(screen.getByText(/김민수/)).toBeTruthy();
  });

  it("연결 상태에만 색을 준다 — 연결됨은 success, 연결되지 않음은 무채색", () => {
    renderPanel();

    const connected = screen.getByText("연결됨");
    const disconnected = screen.getByText("연결되지 않음");

    expect(connected.className).toContain("bg-[var(--el-success)]/10");
    expect(connected.className).toContain("text-[var(--el-success-strong)]");
    expect(disconnected.className).not.toContain("--el-success");
    const disconnectButton = screen.getByRole("button", { name: "연결 해제" });
    expect(disconnectButton.className).toContain("bg-destructive/10");
    expect(disconnectButton.className).toContain(
      "text-[var(--el-error-strong)]"
    );
    expect(
      screen.getByRole("button", { name: "연결" }).className
    ).not.toContain("--el-success");
    const icons = Array.from(document.querySelectorAll("svg.lucide-link-2"));
    const iconClasses = icons.map((icon) => icon.getAttribute("class") ?? "");
    expect(iconClasses.some((c) => c.includes("--el-success-strong"))).toBe(
      true
    );
    expect(
      iconClasses.some((c) => c.includes("text-[var(--el-success)]"))
    ).toBe(false);
  });

  it("ADMIN이면 연결·해제 버튼을 주고 해제가 mutation을 부른다", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "연결" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "연결 해제" }));
    expect(state.disconnectMock).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      provider: "LINEAR",
    });
  });

  it("MEMBER면 버튼 없이 상태만 + 안내 Alert를 보인다", () => {
    state.myRole = "MEMBER";
    renderPanel();
    expect(screen.queryByRole("button", { name: "연결" })).toBeNull();
    expect(screen.queryByRole("button", { name: "연결 해제" })).toBeNull();
    expect(screen.getByText(/관리자만 연동을 연결하거나 해제할 수 있습니다/)).toBeTruthy();
  });

  it("역할이 아직 안 정해졌으면(멤버 로딩) 버튼을 그리지 않는다", () => {
    state.myRole = null;
    state.membersLoaded = false;
    renderPanel();
    expect(screen.queryByRole("button", { name: "연결" })).toBeNull();
    expect(screen.queryByRole("button", { name: "연결 해제" })).toBeNull();
    expect(screen.queryByText(/관리자만 연동을 연결하거나 해제할 수 있습니다/)).toBeNull();
  });

  it("역할 조회가 실패하면 조작을 숨기고 사유·재시도를 보인다", () => {
    state.membersError = true;
    renderPanel();
    expect(screen.getByText(/권한을 확인하지 못해/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "연결 해제" })).toBeNull();
    expect(screen.queryByText(/관리자만 연동을 연결하거나 해제할 수 있습니다/)).toBeNull();
  });

  it("목록 로딩 중엔 스켈레톤을 보인다", () => {
    state.integrationsLoading = true;
    renderPanel();
    expect(screen.queryByText("Linear")).toBeNull();
  });
  it("keeps all cards locked until successful native connection refetch completes", async () => {
    let finish!: (value: { status: "success" }) => void;
    let finishRefetch!: () => void;
    const beginConnection = vi.fn(
      () =>
        new Promise<{ status: "success" }>((resolve) => {
          finish = resolve;
        })
    );
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishRefetch = resolve;
        })
    );
    desktop({ beginConnection });
    renderPanel(client);
    const connect = screen.getByRole("button", { name: "연결" });
    const disconnect = screen.getByRole("button", { name: "연결 해제" });
    fireEvent.click(connect);
    expect(beginConnection).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      provider: "GITHUB",
    });
    expect(connect).toBeDisabled();
    expect(disconnect).toBeDisabled();
    fireEvent.click(connect);
    expect(beginConnection).toHaveBeenCalledTimes(1);
    await act(async () => finish({ status: "success" }));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["integrations", WORKSPACE_ID],
    });
    expect(connect).toBeDisabled();
    await act(async () => finishRefetch());
    expect(connect).not.toBeDisabled();
    expect(disconnect).not.toBeDisabled();
    expect(refresh.run).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("native cancellation and rejection both allow retry without web refresh or stale invalidation", async () => {
    const beginConnection = vi
      .fn()
      .mockResolvedValueOnce({ status: "cancelled" })
      .mockRejectedValueOnce(new Error("IPC unavailable"))
      .mockResolvedValueOnce({ status: "cancelled" });
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    desktop({ beginConnection });
    renderPanel(client);
    const connect = screen.getByRole("button", { name: "연결" });
    fireEvent.click(connect);
    await waitFor(() => expect(connect).not.toBeDisabled());
    expect(toast.error).not.toHaveBeenCalled();
    fireEvent.click(connect);
    await waitFor(() => expect(connect).not.toBeDisabled());
    expect(toast.error).toHaveBeenCalledTimes(1);
    fireEvent.click(connect);
    await waitFor(() => expect(connect).not.toBeDisabled());
    expect(beginConnection).toHaveBeenCalledTimes(3);
    expect(invalidate).not.toHaveBeenCalled();
    expect(refresh.run).not.toHaveBeenCalled();
  });

  it("an old desktop app cannot fall through to web connection OAuth", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    desktop({});
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "연결" }));
    expect(toast.error).toHaveBeenCalledWith(
      "앱을 업데이트한 뒤 다시 연결해 주세요.",
      { action: { label: "새 버전 보기", onClick: expect.any(Function) } }
    );
    expect(refresh.run).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "연결" })).not.toBeDisabled();
    toast.error.mock.calls.at(-1)?.[1].action.onClick();
    expect(open).toHaveBeenCalledWith(
      "https://github.com/team-minswon/homebrew-tap/releases",
      "_blank",
      "noopener,noreferrer"
    );
    open.mockRestore();
  });
});
