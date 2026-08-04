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

const state = vi.hoisted(() => ({
  myRole: "ADMIN" as "ADMIN" | "MEMBER",
  /** 서버는 가입순으로 내려주므로 내가 첫 줄이 아닐 수 있다. 그 경우를 재현한다. */
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
  });
  afterEach(cleanup);

  it("멤버 목록을 이름·이메일·역할로 그린다", () => {
    renderSettings();
    expect(screen.getByText("테스트 유저")).toBeTruthy();
    expect(screen.getByText("minsu@heymoa.com")).toBeTruthy();
    expect(screen.getByText("(나)")).toBeTruthy();
  });

  // 계약은 가입순이라 늦게 합류하면 내 행이 목록 아래로 밀린다. 「나」 배지와 역할이 붙은
  // 행이라 제일 먼저 보여야 한다.
  it("가입이 늦어도 내 행을 맨 위로 올리고 나머지 순서는 서버 그대로 둔다", () => {
    state.meJoinedLast = true;
    renderSettings();

    const names = screen
      .getAllByRole("listitem")
      .map((row) => row.textContent ?? "");

    expect(names[0]).toContain("테스트 유저");
    expect(names[0]).toContain("(나)");
    // 나를 뽑아 올린 것뿐이고 남은 둘은 서버가 준 가입순 그대로다.
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
    // ADMIN 전용 초대 목록 조회는 MEMBER에겐 아예 나가지 않는다.
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
    state.invitations = [
      pendingInvite({ expiresAt: "2026-07-01T00:00:00Z" }),
    ];
    renderSettings();
    expect(screen.getByText("만료됨")).toBeTruthy();
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
  });

  it("관리자에게만 역할 드롭다운과 추방 버튼을 보인다", () => {
    const { rerender } = renderSettings();
    // 나 + 김민수 + 박서준 = 3개 select.
    expect(screen.getAllByLabelText(/ 역할$/)).toHaveLength(3);
    // 내 행은 빠지니 추방 버튼은 2개.
    expect(screen.getAllByRole("button", { name: / 내보내기$/ })).toHaveLength(
      2
    );

    state.myRole = "MEMBER";
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );
    expect(screen.queryAllByLabelText(/ 역할$/)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /내보내기/ })).toBeNull();
  });

  it("자기 행에는 추방 버튼을 그리지 않는다", () => {
    renderSettings();
    const myRow = screen.getByText("테스트 유저").closest("li");
    if (!myRow) throw new Error("내 행을 찾지 못했다");

    expect(
      within(myRow).queryByRole("button", { name: /내보내기/ })
    ).toBeNull();
    // 자기 역할은 select로 바꿀 수 있어야 한다 — 자기 강등 흐름이 이걸로 된다.
    expect(within(myRow).getByLabelText("테스트 유저(me@heymoa.com) 역할")).toBeTruthy();
  });

  it("역할을 바꾸면 mutation을 올바른 인자로 부르고 목록을 무효화한다", () => {
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    render(
      <QueryClientProvider client={client}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByLabelText("김민수(minsu@heymoa.com) 역할"), {
      target: { value: "ADMIN" },
    });

    expect(state.changeRoleCalls).toContainEqual({
      workspaceId: "01K0000000000",
      userId: "user-67890",
      data: { role: "ADMIN" },
    });
    // onSettled로 걸려 있어야 실패해도 재조회된다(APP-187).
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["/v1/workspaces/01K0000000000/members"],
    });
  });

  /**
   * 이 파일은 생성 훅을 목으로 갈아끼워 mutation이 캐시에 올라가지 않는다. 잠금은 행이 아니라
   * 캐시를 보고 판정하므로, 끝나지 않는 mutation을 하나 띄워 진행 중 상태를 만든다.
   */
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

  it("한 행의 역할 변경이 진행 중이면 형제 행의 컨트롤도 잠긴다", () => {
    const client = clientWithPendingRoleChange("01K0000000000");

    render(
      <QueryClientProvider client={client}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    // 진행 중인 행뿐 아니라 전부 잠긴다. 아직 invalidate되지 않은 낡은 목록으로 두 번째
    // 조작을 시작하면 "ADMIN 최소 1명" 판정이 요청 도착 순서에 따라 달라진다.
    for (const select of screen.getAllByLabelText(/ 역할$/)) {
      expect(select).toBeDisabled();
    }
    for (const button of screen.getAllByRole("button", { name: / 내보내기$/ })) {
      expect(button).toBeDisabled();
    }
  });

  // QueryClient는 앱 전역이고 mutation은 언마운트로 취소되지 않는다. 키만 보고 세면 A에서
  // 시작한 변경이 B의 멤버 탭을 잠그고, A의 요청이 멈추면 B가 계속 잠긴 채로 남는다.
  it("다른 워크스페이스의 변경은 이 목록을 잠그지 않는다", () => {
    const client = clientWithPendingRoleChange("01K0000000006");

    render(
      <QueryClientProvider client={client}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    for (const select of screen.getAllByLabelText(/ 역할$/)) {
      expect(select).not.toBeDisabled();
    }
    for (const button of screen.getAllByRole("button", { name: / 내보내기$/ })) {
      expect(button).not.toBeDisabled();
    }
  });

  // canManage는 멤버 목록에서 나온다 — 목록이 새로 내려오면 관리 UI는 저절로 사라져야 하고,
  // 그 실패(예: 마지막 관리자 409)를 컴포넌트가 직접 토스트로 띄우면 전역 토스트와 겹친다.
  it("자기를 MEMBER로 강등한 뒤 목록이 갱신되면 관리 UI가 사라진다", () => {
    const { rerender } = renderSettings();

    fireEvent.change(screen.getByLabelText("테스트 유저(me@heymoa.com) 역할"), {
      target: { value: "MEMBER" },
    });
    expect(state.changeRoleCalls).toContainEqual({
      workspaceId: "01K0000000000",
      userId: "user-12345",
      data: { role: "MEMBER" },
    });
    // 실패(마지막 관리자 409 등)는 전역 MutationCache가 토스트로 띄운다 — 이 컴포넌트가
    // suppressErrorToast나 자기 onError로 가로채면 안 된다.
    expect(state.changeRoleOptions?.mutation?.onError).toBeUndefined();
    expect(
      (state.changeRoleOptions?.mutation as { meta?: { suppressErrorToast?: boolean } } | undefined)
        ?.meta?.suppressErrorToast
    ).toBeFalsy();

    // 서버가 강등을 받아들이고 목록이 새로 내려온 상태를 재현한다.
    state.myRole = "MEMBER";
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    expect(screen.queryAllByLabelText(/ 역할$/)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /내보내기/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "초대" })).toBeNull();
  });

  it("추방은 확인 다이얼로그를 거친 뒤에만 mutation을 부르고, 성공하면 다이얼로그를 닫는다", async () => {
    renderSettings();
    const otherRow = screen.getByText("김민수").closest("li");
    if (!otherRow) throw new Error("김민수 행을 찾지 못했다");

    fireEvent.click(
      within(otherRow).getByRole("button", { name: "김민수(minsu@heymoa.com) 내보내기" })
    );

    const dialog = screen.getByRole("alertdialog");
    expect(state.removeCalls).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "내보내기" }));
    await waitFor(() =>
      expect(state.removeCalls).toContainEqual({
        workspaceId: "01K0000000000",
        userId: "user-67890",
      })
    );
    // `note-delete-dialog.tsx`와 같은 패턴 — 성공이 확인된 뒤에야 닫는다.
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull()
    );
  });
});
