import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MembersSettings } from "@/components/settings/members-settings";
import { ApiError } from "@/lib/api/fetcher";

const state = vi.hoisted(() => ({
  myRole: "ADMIN" as "ADMIN" | "MEMBER",
  meJoinedLast: false,
  membersError: false,
  invitations: [] as unknown[],
  createError: null as unknown,
  createCalls: [] as unknown[],
  cancelMock: vi.fn(),
  invitationsEnabled: undefined as boolean | undefined,
  changeRoleCalls: [] as unknown[],
  changeRoleOptions: null as { mutation?: Record<string, unknown> } | null,
  removeCalls: [] as unknown[],
  replaceMock: vi.fn(),
  workspaces: [] as { workspaceId: string; name?: string }[],
  leaveCalls: [] as unknown[],
  leaveError: null as unknown,
  leaveHang: false,
  renameMock: vi.fn(),
  toastError: vi.fn(),
  renameArgs: [] as unknown[],
  recording: null as { activeWorkspaceId: string; phase: string } | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: state.replaceMock }),
}));
vi.mock("@/components/transcription/recording-provider", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/transcription/recording-provider")
  >("@/components/transcription/recording-provider");
  return {
    ...actual,
    useRecording: () => ({
      activeWorkspaceId: state.recording?.activeWorkspaceId ?? null,
      phase: state.recording?.phase ?? "idle",
      session: null,
    }),
  };
});
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  useGetWorkspaces: () => ({
    data: {
      status: 200,
      data: { success: true, data: { workspaces: state.workspaces } },
    },
  }),
  getGetWorkspacesQueryKey: () => ["workspaces"],
  getGetWorkspaceQueryKey: (id: string) => ["workspace", id],
  getGetWorkspaceGuestsQueryKey: (id: string) => ["guests", id],
  useGetWorkspaceGuests: () => ({
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    data: { status: 200, data: { success: true, data: { guests: [] } } },
  }),
  useDeleteWorkspaceGuest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useLinkWorkspaceGuest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePreviewWorkspaceGuestLink: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { userId: "user-12345" } }),
}));
vi.mock("@/lib/api/generated/workspace-members/workspace-members", () => ({
  getGetWorkspaceMembersQueryKey: (workspaceId: string) => [
    `/v1/workspaces/${workspaceId}/members`,
  ],
  useChangeWorkspaceMemberRole: (options?: {
    mutation?: { onSettled?: () => void };
  }) => ({
    isPending: false,
    mutate: (vars: unknown) => {
      state.changeRoleCalls.push(vars);
      state.changeRoleOptions = options ?? null;
      options?.mutation?.onSettled?.();
    },
  }),
  useRemoveWorkspaceMember: (options?: {
    mutation?: { onSettled?: () => void };
  }) => ({
    isPending: false,
    mutateAsync: async (vars: unknown) => {
      state.removeCalls.push(vars);
      options?.mutation?.onSettled?.();
      return { status: 204 };
    },
  }),
  getLeaveWorkspaceMutationKey: () => ["leaveWorkspace"],
  leaveWorkspace: async (
    workspaceId: string,
    body?: Record<string, unknown>
  ) => {
    state.leaveCalls.push({ workspaceId, ...body });
    if (state.leaveHang) return new Promise(() => {});
    if (state.leaveError) throw state.leaveError;
    return { status: 204 };
  },
  useGetWorkspaceMembers: () => ({
    isLoading: false,
    isError: state.membersError,
    refetch: vi.fn(),
    data: state.membersError
      ? undefined
      : {
          status: 200,
          data: {
            success: true,
            data: {
              members: (() => {
                const me = {
                  userId: "user-12345",
                  name: "테스트 유저",
                  email: "me@heymoa.com",
                  role: state.myRole,
                  joinedAt: "2026-07-01T00:00:00Z",
                  image: null,
                };
                const other = {
                  userId: "user-67890",
                  name: "김민수",
                  email: "minsu@heymoa.com",
                  role: "MEMBER" as const,
                  joinedAt: "2026-07-05T00:00:00Z",
                  image: null,
                };
                const third = {
                  userId: "user-24680",
                  name: "박서준",
                  displayName: "박서준",
                  accountName: "고래",
                  email: "seojun@heymoa.com",
                  role: "MEMBER" as const,
                  joinedAt: "2026-07-09T00:00:00Z",
                  image: null,
                };
                return state.meJoinedLast
                  ? [other, third, me]
                  : [me, other, third];
              })(),
            },
          },
        },
  }),
}));
vi.mock("@/lib/ui/toast", () => ({ toast: { error: state.toastError } }));

vi.mock("@/lib/workspace/use-rename-member", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/workspace/use-rename-member")
  >()),
  useRenameMember: (args: unknown) => {
    state.renameArgs.push(args);
    return { isPending: false, rename: state.renameMock };
  },
}));

vi.mock(
  "@/lib/api/generated/workspace-invitations/workspace-invitations",
  () => ({
    getGetWorkspaceInvitationsQueryKey: (id: string) => ["invitations", id],
    useGetWorkspaceInvitations: (
      _id: string,
      options?: { query?: { enabled?: boolean } }
    ) => {
      state.invitationsEnabled = options?.query?.enabled;
      return {
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
        data: {
          status: 200,
          data: { success: true, data: { invitations: state.invitations } },
        },
      };
    },
    useCreateWorkspaceInvitation: () => ({
      isPending: false,
      mutateAsync: async (vars: unknown) => {
        state.createCalls.push(vars);
        if (state.createError) throw state.createError;
        return { status: 201 };
      },
    }),
    useCancelWorkspaceInvitation: () => ({
      isPending: false,
      mutate: state.cancelMock,
    }),
  })
);

function pendingInvite(overrides: Record<string, unknown> = {}) {
  return {
    invitationId: "inv-1",
    inviteeName: "이초대",
    inviteeEmail: "invitee@heymoa.com",
    inviteeImage: null,
    role: "MEMBER",
    inviterName: "테스트 유저",
    createdAt: "2026-07-20T00:00:00Z",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    ...overrides,
  };
}

function renderSettings() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MembersSettings workspaceId="01K0000000000" />
    </QueryClientProvider>
  );
}

async function invite(email: string) {
  fireEvent.change(screen.getByLabelText("초대할 이메일"), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: "초대" }));
}

async function openMenu(label: string) {
  fireEvent.click(screen.getByRole("button", { name: `${label} 관리` }));
  return screen.findByRole("menu");
}

async function pickRole(label: string, option: string) {
  fireEvent.click(screen.getByLabelText(label));
  const item = await screen.findByRole("option", { name: option });
  // base-ui `Select` 는 포인터로 고릅니다. `click` 만으로는 값이 안 바뀝니다.
  fireEvent.pointerDown(item, { pointerType: "mouse", button: 0 });
  fireEvent.pointerUp(item, { pointerType: "mouse", button: 0 });
  fireEvent.click(item);
}

describe("MembersSettings", () => {
  beforeEach(() => {
    state.myRole = "ADMIN";
    state.meJoinedLast = false;
    state.membersError = false;
    state.invitations = [];
    state.createError = null;
    state.createCalls = [];
    state.cancelMock.mockReset();
    state.invitationsEnabled = undefined;
    state.changeRoleCalls = [];
    state.changeRoleOptions = null;
    state.removeCalls = [];
    state.replaceMock.mockReset();
    state.workspaces = [
      { workspaceId: "01K0000000000", name: "테스트 워크스페이스" },
      { workspaceId: "01K0000000006", name: "제품 팀" },
    ];
    state.leaveCalls = [];
    state.leaveError = null;
    state.leaveHang = false;
    state.recording = null;
    state.renameMock.mockReset();
    state.renameArgs = [];
  });
  afterEach(cleanup);

  it("멤버 목록을 이름·이메일·역할로 그린다", () => {
    renderSettings();
    expect(screen.getByText("테스트 유저")).toBeTruthy();
    expect(screen.getByText("minsu@heymoa.com")).toBeTruthy();
    expect(screen.getByText("(나)")).toBeTruthy();
  });

  it("가입이 늦어도 내 행을 맨 위로 올리고 나머지 순서는 서버 그대로 둔다", () => {
    state.meJoinedLast = true;
    renderSettings();

    const names = screen
      .getAllByRole("listitem")
      .map((row) => row.textContent ?? "");

    expect(names[0]).toContain("테스트 유저");
    expect(names[0]).toContain("(나)");
    expect(names[1]).toContain("김민수");
    expect(names[2]).toContain("박서준");
  });

  it("ADMIN이면 초대 폼을 보이고 MEMBER면 숨긴다", () => {
    const { rerender } = renderSettings();
    expect(screen.getByRole("button", { name: "초대" })).toBeTruthy();

    expect(state.invitationsEnabled).toBe(true);

    state.myRole = "MEMBER";
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );
    expect(screen.queryByRole("button", { name: "초대" })).toBeNull();
    expect(state.invitationsEnabled).toBe(false);
  });

  it("초대하면 mutation을 이메일·역할과 함께 부른다", async () => {
    renderSettings();
    await invite("new@heymoa.com");
    await waitFor(() =>
      expect(state.createCalls).toContainEqual({
        workspaceId: "01K0000000000",
        data: { email: "new@heymoa.com", role: "MEMBER" },
      })
    );
  });

  it("이미 멤버(409)면 인라인으로 서버 문구를 보인다", async () => {
    state.createError = {
      success: false,
      data: null,
      error: {
        code: "ALREADY_WORKSPACE_MEMBER",
        message: "이미 워크스페이스 멤버입니다.",
      },
    };
    renderSettings();
    await invite("junho@heymoa.app");
    await waitFor(() =>
      expect(screen.getByText("이미 워크스페이스 멤버입니다.")).toBeTruthy()
    );
  });

  it("초대가 429 로 거절되면 서버 문구를 보이고 폼은 잠그지 않는다", async () => {
    state.createError = new ApiError(
      429,
      {
        code: "RATE_LIMITED",
        message: "지금은 초대를 보낼 수 없습니다. 잠시 후 다시 시도해 주세요.",
      },
      null
    );
    renderSettings();
    await invite("junho@heymoa.app");
    await waitFor(() =>
      expect(
        screen.getByText(
          "지금은 초대를 보낼 수 없습니다. 잠시 후 다시 시도해 주세요."
        )
      ).toBeTruthy()
    );
    expect(
      (screen.getByRole("button", { name: "초대" }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });

  it("이메일을 고치면 지난 초대 오류가 사라진다", async () => {
    state.createError = {
      success: false,
      data: null,
      error: {
        code: "ALREADY_WORKSPACE_MEMBER",
        message: "이미 워크스페이스 멤버입니다.",
      },
    };
    renderSettings();
    await invite("junho@heymoa.app");
    await waitFor(() =>
      expect(screen.getByText("이미 워크스페이스 멤버입니다.")).toBeTruthy()
    );
    fireEvent.change(screen.getByLabelText("초대할 이메일"), {
      target: { value: "junho2@heymoa.app" },
    });
    expect(screen.queryByText("이미 워크스페이스 멤버입니다.")).toBeNull();
  });

  it("대기 초대의 취소가 mutation을 부른다", () => {
    state.invitations = [pendingInvite()];
    renderSettings();
    expect(screen.getByText("invitee@heymoa.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(state.cancelMock).toHaveBeenCalledWith({
      workspaceId: "01K0000000000",
      invitationId: "inv-1",
    });
  });

  it("미가입자 초대 행은 이메일을 주 텍스트로 보인다", () => {
    state.invitations = [
      pendingInvite({ inviteeName: null, inviteeEmail: "stranger@heymoa.dev" }),
    ];
    renderSettings();
    const email = screen.getByText("stranger@heymoa.dev");
    expect(email.className).toMatch(/font-medium/);
    expect(screen.getAllByText("stranger@heymoa.dev")).toHaveLength(1);
  });

  it("만료 지난 초대는 만료됨 배지를 보이고 취소 버튼은 남는다", () => {
    state.invitations = [pendingInvite({ expiresAt: "2026-07-01T00:00:00Z" })];
    renderSettings();
    expect(screen.getByText("만료됨")).toBeTruthy();
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
  });

  it("관리자에게는 모든 행에 관리 메뉴를, MEMBER 에게는 자기 행에만 보인다", async () => {
    renderSettings();
    expect(screen.getAllByLabelText(/ 역할$/)).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: / 관리$/ })).toHaveLength(3);
    const menu = await openMenu("김민수(minsu@heymoa.com)");
    expect(
      within(menu).getByRole("menuitem", { name: "이름 변경" })
    ).toBeTruthy();
    expect(
      within(menu).getByRole("menuitem", { name: "내보내기" })
    ).toBeTruthy();
    cleanup();

    state.myRole = "MEMBER";
    renderSettings();
    expect(screen.queryAllByLabelText(/ 역할$/)).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: / 관리$/ })).toHaveLength(1);
    const mine = await openMenu("테스트 유저(me@heymoa.com)");
    expect(
      within(mine).queryByRole("menuitem", { name: "내보내기" })
    ).toBeNull();
  });

  it("자기 행 메뉴에는 이름 변경만 있고 내보내기는 없다", async () => {
    renderSettings();
    const myRow = screen.getByText("테스트 유저").closest("li");
    if (!myRow) throw new Error("내 행을 찾지 못했다");

    const menu = await openMenu("테스트 유저(me@heymoa.com)");
    expect(
      within(menu).getByRole("menuitem", { name: "이름 변경" })
    ).toBeTruthy();
    expect(
      within(menu).queryByRole("menuitem", { name: "내보내기" })
    ).toBeNull();
    expect(
      within(myRow).getByLabelText("테스트 유저(me@heymoa.com) 역할")
    ).toBeTruthy();
  });

  it("역할·관리 메뉴 자리를 폭 고정으로 잡아 날짜 열이 어긋나지 않는다", () => {
    renderSettings();
    const rows = ["테스트 유저", "김민수"].map((name) => {
      const row = screen.getByText(name).closest("li");
      if (!row) throw new Error(`${name} 행을 찾지 못했다`);
      return row;
    });

    for (const row of rows) {
      const slots = [...row.querySelectorAll("div")].map((el) => el.className);
      expect(slots.some((cls) => cls.includes("w-[104px]"))).toBe(true);
      expect(slots.some((cls) => /(^| )w-8( |$)/.test(cls))).toBe(true);
    }
  });

  it("역할을 바꾸면 mutation을 올바른 인자로 부르고 목록을 무효화한다", async () => {
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    render(
      <QueryClientProvider client={client}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    await pickRole("김민수(minsu@heymoa.com) 역할", "관리자");

    expect(state.changeRoleCalls).toContainEqual({
      workspaceId: "01K0000000000",
      userId: "user-67890",
      data: { role: "ADMIN" },
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["/v1/workspaces/01K0000000000/members"],
    });
  });

  function clientWithPendingRoleChange(workspaceId: string) {
    const client = new QueryClient();
    void client
      .getMutationCache()
      .build(client, {
        mutationKey: ["changeWorkspaceMemberRole"],
        mutationFn: () => new Promise<void>(() => {}),
      })
      .execute({ workspaceId, userId: "user-67890" });
    return client;
  }

  it("한 행의 역할 변경이 진행 중이면 형제 행의 컨트롤도 잠긴다", async () => {
    const client = clientWithPendingRoleChange("01K0000000000");

    render(
      <QueryClientProvider client={client}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    for (const select of screen.getAllByLabelText(/ 역할$/)) {
      expect(select).toBeDisabled();
    }
    const menu = await openMenu("박서준(seojun@heymoa.com)");
    expect(
      within(menu).getByRole("menuitem", { name: "내보내기" })
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("다른 워크스페이스의 변경은 이 목록을 잠그지 않는다", async () => {
    const client = clientWithPendingRoleChange("01K0000000006");

    render(
      <QueryClientProvider client={client}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    for (const select of screen.getAllByLabelText(/ 역할$/)) {
      expect(select).not.toBeDisabled();
    }
    const menu = await openMenu("박서준(seojun@heymoa.com)");
    expect(
      within(menu).getByRole("menuitem", { name: "내보내기" })
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("자기를 MEMBER로 강등한 뒤 목록이 갱신되면 관리 UI가 사라진다", async () => {
    const { rerender } = renderSettings();

    await pickRole("테스트 유저(me@heymoa.com) 역할", "멤버");
    expect(state.changeRoleCalls).toContainEqual({
      workspaceId: "01K0000000000",
      userId: "user-12345",
      data: { role: "MEMBER" },
    });
    expect(state.changeRoleOptions?.mutation?.onError).toBeUndefined();
    expect(
      (
        state.changeRoleOptions?.mutation as
          | { meta?: { suppressErrorToast?: boolean } }
          | undefined
      )?.meta?.suppressErrorToast
    ).toBeFalsy();

    state.myRole = "MEMBER";
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    expect(screen.queryAllByLabelText(/ 역할$/)).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: / 관리$/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "초대" })).toBeNull();
  });

  it("추방은 확인 다이얼로그를 거친 뒤에만 mutation을 부르고, 성공하면 다이얼로그를 닫는다", async () => {
    renderSettings();
    const otherRow = screen.getByText("김민수").closest("li");
    if (!otherRow) throw new Error("김민수 행을 찾지 못했다");

    await openMenu("김민수(minsu@heymoa.com)");
    fireEvent.click(await screen.findByRole("menuitem", { name: "내보내기" }));

    const dialog = screen.getByRole("alertdialog");
    expect(state.removeCalls).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "내보내기" }));
    await waitFor(() =>
      expect(state.removeCalls).toContainEqual({
        workspaceId: "01K0000000000",
        userId: "user-67890",
      })
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});

describe("워크스페이스 나가기", () => {
  beforeEach(() => {
    state.myRole = "ADMIN";
    state.meJoinedLast = false;
    state.membersError = false;
    state.invitations = [];
    state.replaceMock.mockReset();
    state.workspaces = [
      { workspaceId: "01K0000000000", name: "테스트 워크스페이스" },
      { workspaceId: "01K0000000006", name: "제품 팀" },
    ];
    state.leaveCalls = [];
    state.leaveError = null;
    state.leaveHang = false;
  });
  afterEach(cleanup);

  function openLeaveDialog(typed = "테스트 워크스페이스") {
    fireEvent.click(
      screen.getByRole("button", { name: "워크스페이스 나가기" })
    );
    const dialog = screen.getByRole("alertdialog");
    fireEvent.change(within(dialog).getByLabelText(/확인하려면/), {
      target: { value: typed },
    });
    return dialog;
  }

  it("같은 워크스페이스의 역할 변경이 진행 중이면 나가기도 잠긴다", () => {
    const client = new QueryClient();
    void client
      .getMutationCache()
      .build(client, {
        mutationKey: ["changeWorkspaceMemberRole"],
        mutationFn: () => new Promise<void>(() => {}),
      })
      .execute({ workspaceId: "01K0000000000", userId: "user-67890" });

    render(
      <QueryClientProvider client={client}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    expect(
      screen.getByRole("button", { name: "워크스페이스 나가기" })
    ).toBeDisabled();
  });

  it("이 워크스페이스를 녹음 중이면 나가기가 잠기고 이유가 보인다", () => {
    state.recording = {
      activeWorkspaceId: "01K0000000000",
      phase: "recording",
    };

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    expect(
      screen.getByRole("button", { name: "워크스페이스 나가기" })
    ).toBeDisabled();
    expect(
      screen.getByText("녹음을 끝낸 뒤 나갈 수 있습니다.")
    ).toBeInTheDocument();
  });

  it("다른 워크스페이스를 녹음 중이면 잠그지 않는다", () => {
    state.recording = {
      activeWorkspaceId: "01K0000000006",
      phase: "recording",
    };

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    expect(
      screen.getByRole("button", { name: "워크스페이스 나가기" })
    ).toBeEnabled();
    expect(screen.queryByText("녹음을 끝낸 뒤 나갈 수 있습니다.")).toBeNull();
  });

  it("요청 중에는 Escape로 닫히지 않는다", async () => {
    const client = new QueryClient();
    // 같은 엘리먼트 참조로 rerender 하면 React 가 렌더를 건너뛰어 매번 새로 만듭니다.
    const view = () => (
      <QueryClientProvider client={client}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );
    render(view());
    const dialog = openLeaveDialog();

    state.leaveHang = true;
    fireEvent.click(within(dialog).getByRole("button", { name: "나가기" }));
    await waitFor(() => expect(state.leaveCalls).toHaveLength(1));

    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("MEMBER에게도 나가기를 보인다", () => {
    state.myRole = "MEMBER";
    renderSettings();

    expect(
      screen.getByRole("button", { name: "워크스페이스 나가기" })
    ).toBeTruthy();
  });

  it("확인을 거친 뒤에만 mutation을 부른다", async () => {
    renderSettings();
    const dialog = openLeaveDialog();
    expect(state.leaveCalls).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "나가기" }));

    await waitFor(() =>
      expect(state.leaveCalls).toContainEqual({
        workspaceId: "01K0000000000",
        workspaceName: "테스트 워크스페이스",
      })
    );
  });

  it("워크스페이스 이름이 다르면 나가기가 꺼져 있다", () => {
    renderSettings();
    const dialog = openLeaveDialog("테스트 워크스페이");

    expect(
      within(dialog).getByRole("button", { name: "나가기" })
    ).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/확인하려면/), {
      target: { value: "  테스트 워크스페이스 " },
    });
    expect(
      within(dialog).getByRole("button", { name: "나가기" })
    ).toBeEnabled();
  });

  it("나가면 남은 워크스페이스로 이동한다", async () => {
    renderSettings();
    const dialog = openLeaveDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "나가기" }));

    await waitFor(() =>
      expect(state.replaceMock).toHaveBeenCalledWith("/w/01K0000000006")
    );
  });

  it("나가면 목록 캐시에서 그 워크스페이스를 즉시 지운다", async () => {
    const client = new QueryClient();
    client.setQueryData(["workspaces"], {
      status: 200,
      data: {
        success: true,
        data: {
          workspaces: [
            { workspaceId: "01K0000000000" },
            { workspaceId: "01K0000000006" },
          ],
        },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );
    const dialog = openLeaveDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "나가기" }));

    await waitFor(() => {
      const cached = client.getQueryData(["workspaces"]) as {
        data: { data: { workspaces: { workspaceId: string }[] } };
      };
      expect(cached.data.data.workspaces.map((w) => w.workspaceId)).toEqual([
        "01K0000000006",
      ]);
    });
  });

  it("남은 워크스페이스가 없으면 홈으로 보낸다", async () => {
    state.workspaces = [
      { workspaceId: "01K0000000000", name: "테스트 워크스페이스" },
    ];
    renderSettings();
    const dialog = openLeaveDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "나가기" }));

    await waitFor(() => expect(state.replaceMock).toHaveBeenCalledWith("/"));
  });

  it("마지막 관리자면 서버 문구를 화면에 남기고 이동하지 않는다", async () => {
    state.leaveError = {
      success: false,
      data: null,
      error: {
        code: "LAST_WORKSPACE_ADMIN",
        message: "워크스페이스에는 관리자가 최소 한 명 있어야 합니다.",
      },
    };
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );
    const dialog = openLeaveDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "나가기" }));

    await waitFor(() =>
      expect(
        screen.getByText("워크스페이스에는 관리자가 최소 한 명 있어야 합니다.")
      ).toBeTruthy()
    );
    expect(state.replaceMock).not.toHaveBeenCalled();
    expect(
      client.getMutationCache().getAll()[0]?.options.meta?.suppressErrorToast
    ).toBe(true);
  });
});

describe("MembersSettings 이름 변경", () => {
  beforeEach(() => {
    state.myRole = "ADMIN";
    state.meJoinedLast = false;
    state.membersError = false;
    state.invitations = [];
    state.renameMock.mockReset();
    state.renameArgs = [];
  });
  afterEach(cleanup);

  async function openRename(label: string) {
    renderSettings();
    await openMenu(label);
    fireEvent.click(await screen.findByRole("menuitem", { name: "이름 변경" }));
    return screen.getByRole("textbox", {
      name: "이 워크스페이스에서 보일 이름",
    });
  }

  it("고친 이름이면 보조 줄에 계정 이름을 함께 보인다", () => {
    renderSettings();
    expect(
      screen.getByText("계정 이름 고래 · seojun@heymoa.com")
    ).toBeInTheDocument();
    expect(screen.getByText("minsu@heymoa.com")).toBeInTheDocument();
  });

  it("계정 이름을 placeholder 와 안내로 보이고, 비워 저장하면 계정 이름으로 되돌린다", async () => {
    state.renameMock.mockResolvedValue(null);
    const input = await openRename("박서준(seojun@heymoa.com)");
    expect(input).toHaveValue("박서준");
    expect(input).toHaveAttribute("placeholder", "고래");
    expect(input).toHaveAttribute("maxLength", "30");
    expect(
      screen.getByText("비우면 계정 이름(고래)으로 보입니다.")
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(state.renameMock).toHaveBeenCalledWith(""));
    await waitFor(() =>
      expect(
        screen.queryByRole("textbox", { name: "이 워크스페이스에서 보일 이름" })
      ).toBeNull()
    );
    expect(state.renameArgs.at(-1)).toMatchObject({
      workspaceId: "01K0000000000",
      member: {
        userId: "user-24680",
        displayName: "박서준",
        accountName: "고래",
      },
    });
  });

  it("서버가 표시 이름을 안 줘도(배포 전) 계정 이름을 이름으로 보고 빈 입력에서 시작한다", async () => {
    const input = await openRename("김민수(minsu@heymoa.com)");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "김민수");
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("실패하면 닫지 않고 서버 문구를 보인다", async () => {
    state.renameMock.mockResolvedValue(
      "워크스페이스를 변경할 권한이 없습니다."
    );
    const input = await openRename("김민수(minsu@heymoa.com)");
    fireEvent.change(input, { target: { value: "민수" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "워크스페이스를 변경할 권한이 없습니다."
    );
    expect(
      screen.getByRole("textbox", { name: "이 워크스페이스에서 보일 이름" })
    ).toHaveValue("민수");
  });

  it("저장 중에도 닫을 수 있고, 닫은 뒤 실패하면 토스트로 알린다", async () => {
    let fail: (message: string) => void = () => {};
    state.renameMock.mockReturnValue(
      new Promise<string>((resolve) => (fail = resolve))
    );
    state.toastError.mockReset();
    const input = await openRename("김민수(minsu@heymoa.com)");
    fireEvent.change(input, { target: { value: "민수" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("textbox", { name: "이 워크스페이스에서 보일 이름" })
      ).toBeNull()
    );
    fail("연결이 끊겼습니다.");
    await waitFor(() =>
      expect(state.toastError).toHaveBeenCalledWith("연결이 끊겼습니다.")
    );
  });
});
