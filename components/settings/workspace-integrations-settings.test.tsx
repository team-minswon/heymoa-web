import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceIntegrationsSettings } from "@/components/settings/workspace-integrations-settings";

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
vi.mock("@/lib/api/generated/workspace-integration/workspace-integration", () => ({
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
}));
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
                ? [{ userId: "user-12345", role: state.myRole, name: "테스트 유저" }]
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
  return { provider: "GITHUB", connected, connectedBy: null, connectedAt: null };
}

function renderPanel() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
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
  });
  afterEach(cleanup);

  it("두 provider가 항상 렌더되고 연결 상태를 보인다", () => {
    renderPanel();
    expect(screen.getByText("Linear")).toBeTruthy();
    expect(screen.getByText("GitHub")).toBeTruthy();
    expect(screen.getByText("연결됨")).toBeTruthy();
    expect(screen.getByText("연결되지 않음")).toBeTruthy();
    expect(screen.getByText(/김민수/)).toBeTruthy();
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
    expect(screen.getByText(/관리자만 할 수 있습니다/)).toBeTruthy();
  });

  it("역할이 아직 안 정해졌으면(멤버 로딩) 버튼을 그리지 않는다", () => {
    state.myRole = null;
    state.membersLoaded = false;
    renderPanel();
    expect(screen.queryByRole("button", { name: "연결" })).toBeNull();
    expect(screen.queryByRole("button", { name: "연결 해제" })).toBeNull();
    // 안내 Alert도 아직 안 뜬다(역할 불명).
    expect(screen.queryByText(/관리자만 할 수 있습니다/)).toBeNull();
  });

  it("역할 조회가 실패하면 조작을 숨기고 사유·재시도를 보인다", () => {
    // members 실패를 빈 목록으로 접으면 ADMIN이 조작을 영영 못 본다 — 사유와 재시도를 준다.
    state.membersError = true;
    renderPanel();
    expect(screen.getByText(/권한을 확인하지 못해/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "연결 해제" })).toBeNull();
    // 관리자 안내(MEMBER용)도 뜨지 않는다(역할 불명).
    expect(screen.queryByText(/관리자만 할 수 있습니다/)).toBeNull();
  });

  it("목록 로딩 중엔 스켈레톤을 보인다", () => {
    state.integrationsLoading = true;
    renderPanel();
    expect(screen.queryByText("Linear")).toBeNull();
  });
});
