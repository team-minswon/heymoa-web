import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentConnectionsSettings } from "@/components/settings/agent-connections-settings";

const created = vi.hoisted(() => ({
  pending: false,
  options: undefined as unknown,
  reset: vi.fn(),
  mutateAsync: vi.fn(),
}));

const state = vi.hoisted(() => ({
  delegations: [] as unknown[],
  error: false,
  workspacesError: false,
  workspacesLoading: false,
}));

vi.mock("@/lib/api/generated/agent-delegation/agent-delegation", () => ({
  getGetAgentDelegationsQueryKey: () => ["agent-delegations"],
  useGetAgentDelegations: () => ({
    isLoading: false,
    isError: state.error,
    refetch: vi.fn(),
    data: state.error
      ? undefined
      : {
          status: 200,
          data: { success: true, data: { delegations: state.delegations } },
        },
  }),
  useCreateAgentDelegation: (options: unknown) => {
    created.options = options;
    return {
      mutateAsync: created.mutateAsync,
      reset: created.reset,
      isPending: created.pending,
    };
  },
  useRevokeAgentDelegation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  useGetWorkspaces: () => ({
    isLoading: state.workspacesLoading,
    isError: state.workspacesError,
    refetch: vi.fn(),
    data:
      state.workspacesError || state.workspacesLoading
        ? undefined
        : {
            status: 200,
            data: {
              success: true,
              data: {
                workspaces: [{ workspaceId: "01K0000000000", name: "제품팀" }],
              },
            },
          },
  }),
}));

function renderSettings(onBusyChange?: (busy: boolean) => void) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AgentConnectionsSettings
        workspaceId="01K0000000000"
        onBusyChange={onBusyChange}
      />
    </QueryClientProvider>
  );
}

describe("AgentConnectionsSettings", () => {
  afterEach(() => {
    cleanup();
    state.delegations = [];
    state.error = false;
    state.workspacesError = false;
    state.workspacesLoading = false;
    created.pending = false;
  });

  // 아직 아무것도 안 한 상태는 실패가 아니다 — 경고(role=alert)도 재시도도 없어야 한다
  it("연결이 하나도 없으면 실패처럼 보이지 않는 빈 상태를 그린다", () => {
    renderSettings();

    expect(screen.getByText("아직 연결한 에이전트가 없습니다.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
    expect(screen.getByRole("button", { name: "새 연결" })).toBeTruthy();
  });

  // 실패를 빈 선택지로 삼키면 보이지 않는 기본 워크스페이스로 토큰이 나간다
  it("맡길 워크스페이스를 못 읽으면 실패를 보이고 토큰을 만들지 못하게 한다", () => {
    state.workspacesError = true;
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "새 연결" }));
    fireEvent.change(screen.getByLabelText("연결 이름"), {
      target: { value: "노트북" },
    });

    expect(screen.getByRole("alert").textContent).toContain(
      "워크스페이스 목록을 불러오지 못했습니다."
    );
    expect(
      (screen.getByRole("button", { name: "토큰 만들기" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  // 원문 토큰은 이 화면의 지역 상태에만 있어야 한다 — mutation 캐시에 남으면 창을 닫아도 남는다
  it("토큰을 받은 뒤 mutation 캐시에 남기지 않는다", async () => {
    created.mutateAsync.mockResolvedValue({
      status: 201,
      data: {
        success: true,
        data: { token: "hm_secret-token", delegation: {} },
      },
    });
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "새 연결" }));
    fireEvent.change(screen.getByLabelText("연결 이름"), {
      target: { value: "노트북" },
    });
    fireEvent.click(screen.getByRole("button", { name: "토큰 만들기" }));

    expect(await screen.findByText("hm_secret-token")).toBeTruthy();
    expect(created.reset).toHaveBeenCalledTimes(1);
    expect(created.options).toEqual({ mutation: { gcTime: 0 } });
  });

  it("토큰을 만드는 요청이 도는 동안 설정 창을 잠그게 한다", () => {
    created.pending = true;
    const onBusyChange = vi.fn();
    renderSettings(onBusyChange);

    fireEvent.click(screen.getByRole("button", { name: "새 연결" }));

    expect(onBusyChange).toHaveBeenLastCalledWith(true);
  });

  it("맡길 워크스페이스를 읽는 동안에는 빈 선택창 대신 자리를 잡아 둔다", () => {
    state.workspacesLoading = true;
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "새 연결" }));

    expect(screen.getByLabelText("워크스페이스 목록 불러오는 중")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("목록을 못 읽으면 빈 상태가 아니라 실패와 재시도를 그린다", () => {
    state.error = true;
    renderSettings();

    expect(screen.getByRole("alert").textContent).toContain(
      "연결 목록을 불러오지 못했습니다."
    );
    expect(screen.queryByText("아직 연결한 에이전트가 없습니다.")).toBeNull();
  });
});
