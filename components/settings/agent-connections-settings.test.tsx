import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentConnectionsSettings } from "@/components/settings/agent-connections-settings";
import { buildUrl } from "@/lib/api/fetcher";

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
  workspaces: [] as unknown[],
  workspacesRefetch: vi.fn(),
  refetch: vi.fn(),
}));

const PRODUCT_TEAM = {
  workspaceId: "01K0000000000",
  name: "제품팀",
  description: null,
  role: "ADMIN",
  agentAccessAllowed: true,
};
state.workspaces = [PRODUCT_TEAM];

const usages = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

const revoked = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock("@/lib/api/generated/agent-delegation/agent-delegation", () => ({
  getGetAgentDelegationsQueryKey: () => ["agent-delegations"],
  getGetAgentDelegationUsagesQueryKey: (delegationId: string) => [
    "usages",
    delegationId,
  ],
  getAgentDelegationUsages: usages.fetch,
  useGetAgentDelegations: () => {
    return {
      isLoading: false,
      isError: state.error,
      refetch: state.refetch,
      data: state.error
        ? undefined
        : {
            status: 200,
            data: { success: true, data: { delegations: state.delegations } },
          },
    };
  },
  useCreateAgentDelegation: (options: unknown) => {
    created.options = options;
    return {
      mutateAsync: created.mutateAsync,
      reset: created.reset,
      isPending: created.pending,
    };
  },
  useRevokeAgentDelegation: () => ({
    mutateAsync: revoked.mutateAsync,
    isPending: false,
  }),
}));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  useGetWorkspaces: () => ({
    isLoading: state.workspacesLoading,
    isError: state.workspacesError,
    refetch: state.workspacesRefetch,
    data:
      state.workspacesError || state.workspacesLoading
        ? undefined
        : {
            status: 200,
            data: { success: true, data: { workspaces: state.workspaces } },
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

function openTokenForm() {
  fireEvent.click(screen.getByRole("button", { name: "새 연결" }));
  fireEvent.click(screen.getByRole("button", { name: "개인 토큰 만들기" }));
}

describe("AgentConnectionsSettings", () => {
  afterEach(() => {
    cleanup();
    state.delegations = [];
    state.error = false;
    state.workspacesError = false;
    state.workspacesLoading = false;
    state.workspaces = [PRODUCT_TEAM];
    state.workspacesRefetch.mockReset();
    created.pending = false;
    created.mutateAsync.mockReset();
    usages.fetch.mockReset();
    revoked.mutateAsync.mockReset();
  });

  it("연결이 하나도 없으면 실패처럼 보이지 않는 빈 상태를 그린다", () => {
    renderSettings();

    expect(screen.getByText("아직 연결한 에이전트가 없습니다.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
    expect(screen.getByRole("button", { name: "새 연결" })).toBeTruthy();
  });

  it("연결할 워크스페이스를 못 읽으면 실패를 보이고 토큰을 만들지 못하게 한다", () => {
    state.workspacesError = true;
    renderSettings();

    openTokenForm();
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

  it("토큰을 받은 뒤 mutation 캐시에 남기지 않는다", async () => {
    created.mutateAsync.mockResolvedValue({
      status: 201,
      data: {
        success: true,
        data: { token: "hm_secret-token", delegation: {} },
      },
    });
    renderSettings();

    openTokenForm();
    fireEvent.change(screen.getByLabelText("연결 이름"), {
      target: { value: "노트북" },
    });
    fireEvent.click(screen.getByRole("button", { name: "토큰 만들기" }));

    expect(await screen.findByText("hm_secret-token")).toBeTruthy();
    expect(created.reset).toHaveBeenCalledTimes(1);
    expect(created.options).toEqual({
      mutation: {
        gcTime: 0,
        meta: { suppressErrorToast: ["AGENT_ACCESS_DISABLED"] },
      },
    });
  });

  it("할 일 변경을 켜고 만들면 허용을 보내고 안내도 바뀐다", async () => {
    created.mutateAsync.mockResolvedValue({
      status: 201,
      data: {
        success: true,
        data: { token: "hm_secret-token", delegation: {} },
      },
    });
    renderSettings();

    openTokenForm();
    const toggle = screen.getByRole("switch", {
      name: "할 일 변경 허용",
    });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(
      screen.getByText(/앱은 읽기와 화면 열기만 하고 아무것도 바꾸지 않습니다/)
    ).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.getByText(/만든 뒤 바꿀 수 없습니다/)).toBeTruthy();
    expect(
      screen.getByText(/앱은 내용을 읽고 화면을 열며, 할 일을 만들고 고칩니다/)
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("연결 이름"), {
      target: { value: "노트북" },
    });
    fireEvent.click(screen.getByRole("button", { name: "토큰 만들기" }));

    expect(await screen.findByText("hm_secret-token")).toBeTruthy();
    expect(created.mutateAsync).toHaveBeenCalledWith({
      data: {
        workspaceId: "01K0000000000",
        name: "노트북",
        allowTaskChanges: true,
      },
    });
  });

  it("새 토큰 화면은 에이전트마다 붙여 넣을 것 하나씩만 보인다", async () => {
    created.mutateAsync.mockResolvedValue({
      status: 201,
      data: {
        success: true,
        data: { token: "hm_secret-token", delegation: {} },
      },
    });
    renderSettings();

    openTokenForm();
    fireEvent.change(screen.getByLabelText("연결 이름"), {
      target: { value: "노트북" },
    });
    fireEvent.click(screen.getByRole("button", { name: "토큰 만들기" }));

    const issued = await screen.findByRole("region", { name: "새 토큰" });
    const blocks = Array.from(issued.querySelectorAll("pre")).map(
      (pre) => pre.textContent ?? ""
    );
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toMatch(
      /^claude mcp add --transport http heymoa \S*\/mcp --header "Authorization: Bearer hm_secret-token"$/
    );
    expect(blocks[2].split("\n")[0]).toBe(
      'd="${CODEX_HOME:-$HOME/.codex}" && mkdir -p "$d" && f="$d/config.toml" && (umask 077; touch "$f") && \\'
    );
    expect(blocks[2]).toContain(
      "{ codex mcp remove heymoa >/dev/null 2>&1 || {"
    );
    expect(blocks[2]).toContain("mcp_servers\\.heymoa[ \\t]*[].]/{s=1;next}");
    expect(blocks[2]).not.toContain("mv ");
    expect(blocks[2]).toContain(
      "cat >> \"$f\" <<'EOF'\n\n[mcp_servers.heymoa]"
    );
    expect(blocks[2]).toContain(
      'http_headers = { "Authorization" = "Bearer hm_secret-token" }'
    );
    expect(issued.textContent).not.toContain("HEYMOA_TOKEN");
  });

  it("토큰을 만드는 요청이 도는 동안 설정 창을 잠그게 한다", () => {
    created.pending = true;
    const onBusyChange = vi.fn();
    renderSettings(onBusyChange);

    openTokenForm();

    expect(onBusyChange).toHaveBeenLastCalledWith(true);
  });

  it("연결할 워크스페이스를 읽는 동안에는 빈 선택창 대신 자리를 잡아 둔다", () => {
    state.workspacesLoading = true;
    renderSettings();

    openTokenForm();

    expect(screen.getByLabelText("워크스페이스 목록 불러오는 중")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("새 연결을 만들 때 회의 전사도 에이전트가 읽는다고 알린다", () => {
    renderSettings();

    openTokenForm();

    expect(
      screen.getByText("회의 전사(참석자의 발화와 이름)도 이 앱이 읽습니다.")
    ).toBeTruthy();
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
      credentialKind: "PERSONAL_TOKEN",
      status,
      createdAt: "2026-09-20T09:00:00Z",
      lastUsedAt: null,
      expiresAt: "2026-12-29T13:00:00Z",
      revokedAt: status === "REVOKED" ? "2026-09-25T09:00:00Z" : null,
      revokeReason: status === "REVOKED" ? "USER" : null,
    });

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

  describe("OAuth 안내", () => {
    it("새 연결이 앱 고르기 탭을 열고, 탭마다 그 앱의 단계와 토큰 없는 명령만 보인다", () => {
      renderSettings();

      fireEvent.click(screen.getByRole("button", { name: "새 연결" }));

      const guide = screen.getByRole("region", { name: "OAuth 연결 안내" });
      expect(screen.queryByLabelText("연결 이름")).toBeNull();
      const mcpUrl = buildUrl("/mcp");
      const shown = () =>
        guide.querySelector<HTMLElement>("[role=tabpanel]:not([hidden])")!;
      const blocks = () =>
        Array.from(shown().querySelectorAll("pre")).map(
          (pre) => pre.textContent ?? ""
        );
      const pick = (name: string) => {
        const tab = within(guide).getByRole("tab", { name });
        fireEvent.pointerDown(tab, { pointerType: "mouse", button: 0 });
        fireEvent.pointerUp(tab, { pointerType: "mouse", button: 0 });
        fireEvent.click(tab);
      };

      expect(
        within(guide)
          .getByRole("tab", { name: "Claude 앱" })
          .getAttribute("aria-selected")
      ).toBe("true");
      expect(within(guide).getByText(/설정 › 커넥터를 엽니다/)).toBeTruthy();
      expect(blocks()).toEqual([mcpUrl]);

      pick("Claude Code");
      expect(blocks()).toEqual([
        `claude mcp add --transport http --scope user heymoa ${mcpUrl}`,
      ]);
      expect(within(shown()).queryByText(/설정 › 커넥터를 엽니다/)).toBeNull();

      pick("Codex");
      expect(blocks()).toEqual([`codex mcp add heymoa --url ${mcpUrl}`]);

      pick("ChatGPT");
      expect(blocks()).toEqual([mcpUrl]);
      expect(
        within(guide)
          .getByRole("link", { name: "쓸 수 있는 요금제 보기" })
          .getAttribute("href")
      ).toBe(
        "https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt"
      );

      expect(guide.textContent).not.toMatch(/Bearer|hm_|에이전트|MCP/);
      expect(within(guide).queryByLabelText("연결할 워크스페이스")).toBeNull();
    });

    it("브라우저 없는 환경이면 안내에서 개인 토큰 폼으로 가서 토큰을 만든다", async () => {
      created.mutateAsync.mockResolvedValue({
        status: 201,
        data: {
          success: true,
          data: { token: "hm_secret-token", delegation: {} },
        },
      });
      renderSettings();

      fireEvent.click(screen.getByRole("button", { name: "새 연결" }));
      fireEvent.click(screen.getByRole("button", { name: "개인 토큰 만들기" }));
      fireEvent.change(screen.getByLabelText("연결 이름"), {
        target: { value: "CI 에이전트" },
      });
      fireEvent.click(screen.getByRole("button", { name: "토큰 만들기" }));

      expect(await screen.findByText("hm_secret-token")).toBeTruthy();
      expect(created.mutateAsync).toHaveBeenCalledWith({
        data: {
          workspaceId: "01K0000000000",
          name: "CI 에이전트",
          allowTaskChanges: false,
        },
      });
    });

    it("연결 목록은 창으로 돌아오면 방금 읽었어도 다시 읽는다", () => {
      renderSettings();
      state.refetch.mockClear();

      window.dispatchEvent(new Event("focus"));

      expect(state.refetch).toHaveBeenCalledTimes(1);
    });

    it("OAuth 안내를 닫으면 연결 목록을 다시 읽는다", () => {
      const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
      renderSettings();

      fireEvent.click(screen.getByRole("button", { name: "새 연결" }));
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));

      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["agent-delegations"],
      });
      expect(
        screen.queryByRole("region", { name: "OAuth 연결 안내" })
      ).toBeNull();
      invalidate.mockRestore();
    });

    it("빈 목록은 주소를 등록하라고 안내한다", () => {
      renderSettings();

      expect(
        screen.getByText(
          "새 연결에 나온 주소를 에이전트에 등록하고 브라우저에서 허락하면 여기에 보입니다."
        )
      ).toBeTruthy();
    });
  });

  describe("자격 종류와 회수 사유", () => {
    const delegation = (
      over: Partial<{
        delegationId: string;
        name: string;
        tokenHint: string | null;
        credentialKind: "PERSONAL_TOKEN" | "OAUTH";
        status: "ACTIVE" | "EXPIRED" | "REVOKED";
        revokeReason:
          | "USER"
          | "MEMBERSHIP_ENDED"
          | "REFRESH_TOKEN_REUSED"
          | "AGENT_ACCESS_DISABLED"
          | "ADMIN"
          | null;
        allowTaskChanges: boolean;
      }>
    ) => ({
      delegationId: "01K00000000Q1",
      name: "노트북 Claude Code",
      workspaceId: "01K0000000000",
      workspaceName: "제품팀",
      tokenHint: "hm_Q7xKp2a",
      credentialKind: "PERSONAL_TOKEN",
      status: "ACTIVE",
      createdAt: "2026-09-20T09:00:00Z",
      lastUsedAt: null,
      expiresAt: "2026-12-29T13:00:00Z",
      revokedAt: null,
      revokeReason: null,
      allowTaskChanges: false,
      ...over,
    });

    it("개인 토큰 연결과 OAuth 연결이 한 목록에 종류와 함께 보이고 둘 다 회수된다", async () => {
      revoked.mutateAsync.mockResolvedValue({ status: 204 });
      state.delegations = [
        delegation({}),
        delegation({
          delegationId: "01K00000000Q2",
          name: "Codex",
          tokenHint: null,
          credentialKind: "OAUTH",
        }),
      ];
      renderSettings();

      const [token, oauth] = screen.getAllByRole("listitem");
      expect(within(token).getByText("개인 토큰")).toBeTruthy();
      expect(within(token).getByText("hm_Q7xKp2a…")).toBeTruthy();
      expect(within(oauth).getByText("OAuth")).toBeTruthy();
      expect(within(oauth).queryByText(/hm_/)).toBeNull();

      for (const [row, delegationId] of [
        [token, "01K00000000Q1"],
        [oauth, "01K00000000Q2"],
      ] as const) {
        fireEvent.click(within(row).getByRole("button", { name: "회수" }));
        const dialog = await screen.findByRole("alertdialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "회수" }));
        await waitFor(() =>
          expect(revoked.mutateAsync).toHaveBeenLastCalledWith({
            delegationId,
          })
        );
        await waitFor(() =>
          expect(screen.queryByRole("alertdialog")).toBeNull()
        );
      }
      expect(revoked.mutateAsync).toHaveBeenCalledTimes(2);
    });

    it("할 일 변경을 허용한 연결에만 허용 표시를 단다", () => {
      state.delegations = [
        delegation({ allowTaskChanges: true }),
        delegation({ delegationId: "01K00000000Q2", allowTaskChanges: false }),
      ];
      renderSettings();

      const [allowed, readOnly] = screen.getAllByRole("listitem");
      expect(within(allowed).getByText("할 일 변경 허용")).toBeTruthy();
      expect(within(readOnly).queryByText("할 일 변경 허용")).toBeNull();
    });

    it("지난 연결에 왜 끊겼는지 사유마다 다른 문구로 보이고 만료는 사유가 없다", () => {
      state.delegations = [
        delegation({
          delegationId: "01K00000000Q2",
          name: "직접 끊은 연결",
          status: "REVOKED",
          revokeReason: "USER",
        }),
        delegation({
          delegationId: "01K00000000Q3",
          name: "떠난 팀의 연결",
          status: "REVOKED",
          revokeReason: "MEMBERSHIP_ENDED",
        }),
        delegation({
          delegationId: "01K00000000Q4",
          name: "새어 나간 연결",
          tokenHint: null,
          credentialKind: "OAUTH",
          status: "REVOKED",
          revokeReason: "REFRESH_TOKEN_REUSED",
        }),
        delegation({
          delegationId: "01K00000000Q5",
          name: "만료된 연결",
          status: "EXPIRED",
        }),
        delegation({
          delegationId: "01K00000000Q6",
          name: "팀이 막은 연결",
          status: "REVOKED",
          revokeReason: "AGENT_ACCESS_DISABLED",
        }),
        delegation({
          delegationId: "01K00000000Q7",
          name: "관리자가 끊은 연결",
          status: "REVOKED",
          revokeReason: "ADMIN",
        }),
      ];
      renderSettings();

      fireEvent.click(screen.getByRole("button", { name: "지난 연결 6개" }));

      const past = screen.getByRole("list", { name: "지난 연결" });
      const rowOf = (name: string) =>
        within(past).getByText(name).closest("li") as HTMLElement;
      expect(
        within(rowOf("직접 끊은 연결")).getByText("직접 회수했습니다.")
      ).toBeTruthy();
      expect(
        within(rowOf("떠난 팀의 연결")).getByText(
          "워크스페이스를 떠나 끊겼습니다."
        )
      ).toBeTruthy();
      expect(
        within(rowOf("새어 나간 연결")).getByText(
          "토큰 재사용이 감지돼 끊겼습니다. 토큰이 새어 나갔을 수 있으니 에이전트에서 다시 연결하세요."
        )
      ).toBeTruthy();
      expect(
        within(rowOf("팀이 막은 연결")).getByText(
          "워크스페이스에서 MCP 연결을 막아 끊겼습니다."
        )
      ).toBeTruthy();
      expect(
        within(rowOf("관리자가 끊은 연결")).getByText("관리자가 끊었습니다.")
      ).toBeTruthy();
      expect(
        within(rowOf("만료된 연결")).queryByText(/했습니다|끊겼습니다/)
      ).toBeNull();
    });
  });

  describe("막힌 워크스페이스", () => {
    const BLOCKED = "관리자가 이 워크스페이스의 MCP 연결을 꺼 두었습니다.";
    const openForm = () => {
      renderSettings();
      openTokenForm();
      fireEvent.change(screen.getByLabelText("연결 이름"), {
        target: { value: "노트북" },
      });
    };
    const submitDisabled = () =>
      (screen.getByRole("button", { name: "토큰 만들기" }) as HTMLButtonElement)
        .disabled;

    it("기본 워크스페이스가 막혀 있으면 꺼짐으로 표시하고 안내를 띄워 만들지 못하게 하며, 막힌 것은 고를 수 없다", async () => {
      state.workspaces = [
        { ...PRODUCT_TEAM, agentAccessAllowed: false },
        {
          ...PRODUCT_TEAM,
          workspaceId: "01K0000000006",
          name: "영업팀",
          agentAccessAllowed: true,
        },
      ];
      openForm();

      const trigger = screen.getByLabelText("연결할 워크스페이스");
      expect(trigger.textContent).toContain("제품팀 (MCP 꺼짐)");
      expect(screen.getByRole("alert").textContent).toContain(BLOCKED);
      expect(submitDisabled()).toBe(true);

      fireEvent.click(trigger);
      const blockedOption = await screen.findByRole("option", {
        name: "제품팀 (MCP 꺼짐)",
      });
      expect(blockedOption.getAttribute("aria-disabled")).toBe("true");
      const sales = screen.getByRole("option", { name: "영업팀" });
      // base-ui `Select` 는 포인터로 고릅니다. `click` 만으로는 값이 안 바뀝니다.
      fireEvent.pointerDown(sales, { pointerType: "mouse", button: 0 });
      fireEvent.pointerUp(sales, { pointerType: "mouse", button: 0 });
      fireEvent.click(sales);

      await waitFor(() => expect(submitDisabled()).toBe(false));
      expect(screen.queryByText(BLOCKED)).toBeNull();
    });

    it("막힘 안내의 「다시 확인」은 워크스페이스를 다시 읽는다", () => {
      state.workspaces = [{ ...PRODUCT_TEAM, agentAccessAllowed: false }];
      openForm();

      fireEvent.click(screen.getByRole("button", { name: "다시 확인" }));

      expect(state.workspacesRefetch).toHaveBeenCalledTimes(1);
    });

    it("모든 워크스페이스가 막혀 있으면 선택 상자 없이 안내만 남는다", () => {
      state.workspaces = [{ ...PRODUCT_TEAM, agentAccessAllowed: false }];
      openForm();

      expect(screen.queryByLabelText("연결할 워크스페이스")).toBeNull();
      expect(screen.getByRole("alert").textContent).toContain(BLOCKED);
      expect(submitDisabled()).toBe(true);
    });

    it("만들기가 403 AGENT_ACCESS_DISABLED 로 거절되면 워크스페이스를 다시 읽는다", async () => {
      created.mutateAsync.mockRejectedValue({
        success: false,
        data: null,
        error: {
          code: "AGENT_ACCESS_DISABLED",
          message: "이 워크스페이스는 외부 에이전트 연결이 꺼져 있습니다.",
          details: null,
        },
      });
      openForm();

      fireEvent.click(screen.getByRole("button", { name: "토큰 만들기" }));

      await waitFor(() =>
        expect(state.workspacesRefetch).toHaveBeenCalledTimes(1)
      );
      expect(screen.queryByText("hm_", { exact: false })).toBeNull();
    });

    it("다른 이유로 거절되면 워크스페이스를 다시 읽지 않는다", async () => {
      created.mutateAsync.mockRejectedValue({
        success: false,
        data: null,
        error: {
          code: "BAD_REQUEST",
          message: "잘못된 요청입니다.",
          details: null,
        },
      });
      openForm();

      fireEvent.click(screen.getByRole("button", { name: "토큰 만들기" }));

      await waitFor(() => expect(created.mutateAsync).toHaveBeenCalled());
      expect(state.workspacesRefetch).not.toHaveBeenCalled();
    });
  });

  describe("사용 내역", () => {
    const delegation = {
      delegationId: "01K00000000Q1",
      name: "노트북 Claude Code",
      workspaceId: "01K0000000000",
      workspaceName: "제품팀",
      tokenHint: "hm_Q7xKp2a",
      credentialKind: "PERSONAL_TOKEN",
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

    it("처음엔 최근 8개만 보이고 더 보기로 8개씩 늘리며 회의 도구도 한국어 이름으로 보인다", async () => {
      state.delegations = [delegation];
      const rows = (from: number, count: number, tools: string[] = []) =>
        Array.from({ length: count }, (_, index) => ({
          usageId: `01K0000000V${String(from + index).padStart(2, "0")}`,
          toolName: tools[index] ?? "list_projects",
          outcome: "SUCCEEDED",
          resultCount: 1,
          occurredAt: "2026-10-03T06:15:00Z",
        }));
      usages.fetch
        .mockResolvedValueOnce(
          page(rows(0, 10, ["get_meeting_transcript", "list_meetings", "search", "update_tasks"]), {
            at: "2026-10-03T06:15:00Z",
            id: "01K0000000V09",
          })
        )
        .mockResolvedValueOnce(page(rows(10, 10), null));
      renderSettings();

      open();
      const history = await screen.findByRole("region", { name: "사용 내역" });
      expect(await within(history).findByText("회의 전사")).toBeTruthy();
      expect(within(history).getByText("회의 목록")).toBeTruthy();
      expect(within(history).getByText("검색")).toBeTruthy();
      expect(within(history).getByText("할 일 고치기")).toBeTruthy();
      expect(within(history).getAllByRole("listitem")).toHaveLength(8);

      fireEvent.click(within(history).getByRole("button", { name: "더 보기" }));

      await vi.waitFor(() =>
        expect(within(history).getAllByRole("listitem")).toHaveLength(16)
      );
      expect(usages.fetch).toHaveBeenCalledTimes(2);

      fireEvent.click(within(history).getByRole("button", { name: "더 보기" }));

      expect(within(history).getAllByRole("listitem")).toHaveLength(20);
      expect(usages.fetch).toHaveBeenCalledTimes(2);
      expect(
        within(history).queryByRole("button", { name: "더 보기" })
      ).toBeNull();
    });

    it("다음 쪽을 다시 읽어도 보이는 수는 한 번 더 보기만큼만 는다", async () => {
      state.delegations = [delegation];
      const rows = (from: number, count: number) =>
        Array.from({ length: count }, (_, index) => ({
          usageId: `01K0000000W${String(from + index).padStart(2, "0")}`,
          toolName: "list_projects",
          outcome: "SUCCEEDED",
          resultCount: 1,
          occurredAt: "2026-10-03T06:15:00Z",
        }));
      usages.fetch
        .mockResolvedValueOnce(
          page(rows(0, 20), { at: "2026-10-03T06:15:00Z", id: "01K0000000W19" })
        )
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce(page(rows(20, 10), null));
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
      await vi.waitFor(() =>
        expect(within(history).getAllByRole("listitem")).toHaveLength(8)
      );
      fireEvent.click(within(history).getByRole("button", { name: "더 보기" }));
      expect(within(history).getAllByRole("listitem")).toHaveLength(16);
      fireEvent.click(within(history).getByRole("button", { name: "더 보기" }));
      await within(history).findByRole("alert");

      fireEvent.click(within(history).getByRole("button", { name: "더 보기" }));

      await vi.waitFor(() =>
        expect(within(history).getAllByRole("listitem")).toHaveLength(24)
      );
    });

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
