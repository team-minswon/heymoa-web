import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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

const usages = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.mock("@/lib/api/generated/agent-delegation/agent-delegation", () => ({
  getGetAgentDelegationsQueryKey: () => ["agent-delegations"],
  getGetAgentDelegationUsagesQueryKey: (delegationId: string) => [
    "usages",
    delegationId,
  ],
  getAgentDelegationUsages: usages.fetch,
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
    usages.fetch.mockReset();
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

  describe("지난 연결", () => {
    const row = (delegationId: string, name: string, status: string) => ({
      delegationId,
      name,
      workspaceId: "01K0000000000",
      workspaceName: "제품팀",
      tokenHint: "hm_Q7xKp2a",
      status,
      createdAt: "2026-09-20T09:00:00Z",
      lastUsedAt: null,
      expiresAt: "2026-12-29T13:00:00Z",
      revokedAt: status === "REVOKED" ? "2026-09-25T09:00:00Z" : null,
      revokeReason: status === "REVOKED" ? "USER" : null,
    });

    // 끊긴 연결은 지우지 않아 쌓인다 — 살아 있는 연결이 그 사이에 묻히지 않게 접어 둔다
    it("회수·만료된 연결은 지난 연결로 접히고 펼치면 보인다", () => {
      state.delegations = [
        row("01K00000000Q1", "쓰는 연결", "ACTIVE"),
        row("01K00000000Q2", "회수한 연결", "REVOKED"),
        row("01K00000000Q3", "만료된 연결", "EXPIRED"),
      ];
      renderSettings();

      expect(screen.getByText("쓰는 연결")).toBeTruthy();
      expect(screen.queryByText("회수한 연결")).toBeNull();
      expect(screen.queryByText("만료된 연결")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "지난 연결 2개" }));

      const past = screen.getByRole("list", { name: "지난 연결" });
      expect(within(past).getByText("회수한 연결")).toBeTruthy();
      expect(within(past).getByText("만료된 연결")).toBeTruthy();
      expect(within(past).queryByText("쓰는 연결")).toBeNull();
    });

    it("지난 연결만 있으면 실패처럼 보이지 않는 빈 상태와 지난 연결을 함께 보인다", () => {
      state.delegations = [row("01K00000000Q2", "회수한 연결", "REVOKED")];
      renderSettings();

      expect(screen.getByText("지금 연결된 에이전트가 없습니다.")).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "지난 연결 1개" })
      ).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("사용 내역", () => {
    const delegation = {
      delegationId: "01K00000000Q1",
      name: "노트북 Claude Code",
      workspaceId: "01K0000000000",
      workspaceName: "제품팀",
      tokenHint: "hm_Q7xKp2a",
      status: "ACTIVE",
      createdAt: "2026-09-20T09:00:00Z",
      lastUsedAt: "2026-09-30T13:00:00Z",
      expiresAt: "2026-12-29T13:00:00Z",
      revokedAt: null,
      revokeReason: null,
    };
    const page = (
      rows: Array<Record<string, unknown>>,
      next: { at: string; id: string } | null
    ) => ({
      status: 200,
      data: {
        success: true,
        data: {
          usages: rows,
          hasMore: next !== null,
          nextOccurredAt: next?.at ?? null,
          nextUsageId: next?.id ?? null,
        },
      },
    });
    const open = () =>
      fireEvent.click(screen.getByRole("button", { name: "사용 내역" }));

    // 도구 이름은 사람이 읽는 말로, 건수와 실패는 줄마다. 다음 쪽은 직전 응답의 커서 둘을 함께 싣는다
    it("펼치면 도구 이름·건수·실패가 보이고 더 보기가 직전 커서로 다음 쪽을 읽는다", async () => {
      state.delegations = [delegation];
      usages.fetch
        .mockResolvedValueOnce(
          page(
            [
              {
                usageId: "01K0000000U00",
                toolName: "list_project_items",
                outcome: "SUCCEEDED",
                resultCount: 12,
                occurredAt: "2026-09-30T13:00:00Z",
              },
              {
                usageId: "01K0000000U01",
                toolName: "get_project_item",
                outcome: "FAILED",
                resultCount: null,
                occurredAt: "2026-09-30T12:30:00Z",
              },
            ],
            { at: "2026-09-30T12:30:00Z", id: "01K0000000U01" }
          )
        )
        .mockResolvedValueOnce(
          page(
            [
              {
                usageId: "01K0000000U02",
                toolName: "new_tool_from_server",
                outcome: "SUCCEEDED",
                resultCount: null,
                occurredAt: "2026-09-30T12:00:00Z",
              },
            ],
            null
          )
        );
      renderSettings();

      open();
      const history = await screen.findByRole("region", { name: "사용 내역" });
      expect(
        await within(history).findByText("프로젝트 항목 목록")
      ).toBeTruthy();
      expect(within(history).getByText("12건")).toBeTruthy();
      expect(within(history).getByText("항목 상세")).toBeTruthy();
      expect(within(history).getByText("실패")).toBeTruthy();
      expect(usages.fetch).toHaveBeenCalledWith(
        "01K00000000Q1",
        undefined,
        expect.anything()
      );

      fireEvent.click(within(history).getByRole("button", { name: "더 보기" }));

      // 모르는 도구 이름은 빈칸이 아니라 그대로 보인다
      expect(
        await within(history).findByText("new_tool_from_server")
      ).toBeTruthy();
      expect(usages.fetch).toHaveBeenLastCalledWith(
        "01K00000000Q1",
        {
          afterOccurredAt: "2026-09-30T12:30:00Z",
          afterUsageId: "01K0000000U01",
        },
        expect.anything()
      );
      expect(
        within(history).queryByRole("button", { name: "더 보기" })
      ).toBeNull();
    });

    // 아직 쓰지 않은 연결이다 — 실패가 아니므로 경고도 재시도도 없다
    it("내역이 없으면 실패처럼 보이지 않는 빈 상태를 그린다", async () => {
      state.delegations = [delegation];
      usages.fetch.mockResolvedValueOnce(page([], null));
      renderSettings();

      open();

      expect(
        await screen.findByText(
          "아직 이 연결로 에이전트가 부른 도구가 없습니다."
        )
      ).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    // 다음 쪽 실패가 읽어 둔 내역을 가리면 안 된다. 다시 시도는 실패한 그 쪽을 다시 부른다
    it("더 보기가 실패해도 읽어 둔 내역은 남고 더 보기로 그 쪽을 다시 읽는다", async () => {
      state.delegations = [delegation];
      const next = { at: "2026-09-30T13:00:00Z", id: "01K0000000U00" };
      usages.fetch
        .mockResolvedValueOnce(
          page(
            [
              {
                usageId: "01K0000000U00",
                toolName: "list_projects",
                outcome: "SUCCEEDED",
                resultCount: 3,
                occurredAt: "2026-09-30T13:00:00Z",
              },
            ],
            next
          )
        )
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce(page([], null));
      render(
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <AgentConnectionsSettings workspaceId="01K0000000000" />
        </QueryClientProvider>
      );

      open();
      const history = await screen.findByRole("region", { name: "사용 내역" });
      await within(history).findByText("프로젝트 목록");
      fireEvent.click(within(history).getByRole("button", { name: "더 보기" }));

      expect((await within(history).findByRole("alert")).textContent).toContain(
        "다음 내역을 불러오지 못했습니다."
      );
      expect(within(history).getByText("프로젝트 목록")).toBeTruthy();

      fireEvent.click(within(history).getByRole("button", { name: "더 보기" }));

      await vi.waitFor(() => expect(usages.fetch).toHaveBeenCalledTimes(3));
      expect(usages.fetch).toHaveBeenLastCalledWith(
        "01K00000000Q1",
        { afterOccurredAt: next.at, afterUsageId: next.id },
        expect.anything()
      );
      await vi.waitFor(() =>
        expect(within(history).queryByRole("alert")).toBeNull()
      );
      expect(within(history).getByText("프로젝트 목록")).toBeTruthy();
    });

    it("내역을 못 읽으면 빈 상태가 아니라 실패와 재시도를 그린다", async () => {
      state.delegations = [delegation];
      usages.fetch.mockRejectedValue(new Error("boom"));
      render(
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <AgentConnectionsSettings workspaceId="01K0000000000" />
        </QueryClientProvider>
      );

      open();

      expect((await screen.findByRole("alert")).textContent).toContain(
        "사용 내역을 불러오지 못했습니다."
      );
      expect(
        screen.queryByText("아직 이 연결로 에이전트가 부른 도구가 없습니다.")
      ).toBeNull();
    });
  });
});
